import { db } from '../shared/db/schema'
import {
  upsertInvoice,
  getInvoice,
  updateInvoice,
  upsertNipRule,
} from '../shared/db/queries'
import { parseInvoiceXml } from '../shared/xml/parser'
import { classify } from './classifier'
import { withKeepalive } from './keepalive'
import { arrayBufferToBase64 } from '../shared/utils/base64'
import type { Message, Invoice, MessageType, ProgressMessage } from '../shared/types'

export async function handleMessage(msg: Message): Promise<unknown> {
  switch (msg.type as MessageType) {

    case 'CHECK_CACHE': {
      const { ksefNumer } = msg.payload as { ksefNumer: string }
      const existing = await db.invoices.get(ksefNumer)
      return !!existing
    }

    case 'GET_INVOICE': {
      const { ksefNumer } = msg.payload as { ksefNumer: string }
      return (await db.invoices.get(ksefNumer)) ?? null
    }

    case 'GET_INVOICES': {
      const {
        category,
        paymentStatus,
        invoiceType,
        limit = 200,
        offset = 0,
      } = (msg.payload ?? {}) as {
        category?: string
        paymentStatus?: string
        invoiceType?: string
        limit?: number
        offset?: number
      }

      const invoices = await db.invoices.orderBy('issueDate').reverse().toArray()

      // Filtrowanie po stronie JS (Dexie nie obsługuje compound indexes bez deklaracji)
      return invoices
        .filter((inv) => {
          if (category && inv.category !== category) return false
          if (paymentStatus && inv.paymentStatus !== paymentStatus) return false
          if (invoiceType && inv.invoiceType !== invoiceType) return false
          return true
        })
        .slice(offset, offset + limit)
    }

    case 'XML_FETCHED': {
      const { ksefNumer, xmlRaw } = msg.payload as {
        ksefNumer: string
        xmlRaw: string
      }

      const parsed = parseInvoiceXml(xmlRaw, ksefNumer)
      const { category, categoryAutoApplied } = await classify(parsed)

      const invoice: Invoice = {
        ksefNumer,
        invoiceNumber:         parsed.invoiceNumber,
        issueDate:             parsed.issueDate,
        grossAmount:           parsed.grossAmount,
        currency:              parsed.currency,
        sellerNip:             parsed.seller.nip ?? '',
        sellerName:            parsed.seller.name,
        xmlRaw,
        paymentStatus:         parsed.paymentStatus,
        paymentStatusOverride: false,
        downloadedXml:         false,
        downloadedPdf:         false,
        category,
        categoryAutoApplied,
        fetchedAt:             Date.now(),
        invoiceType:           parsed.rodzajFaktury,
      }

      await upsertInvoice(invoice)

      notifyTabs({
        type: 'INVOICE_UPDATED',
        payload: {
          ksefNumer,
          data: {
            paymentStatus: invoice.paymentStatus,
            category:      invoice.category,
            downloadedXml: invoice.downloadedXml,
            downloadedPdf: invoice.downloadedPdf,
          },
        },
      })

      return invoice
    }

    case 'SET_CATEGORY': {
      const { ksefNumer, category, updateNipRule } = msg.payload as {
        ksefNumer: string
        category: 'costs' | 'goods'
        updateNipRule: boolean
      }

      await updateInvoice(ksefNumer, { category, categoryAutoApplied: false })

      if (updateNipRule) {
        const invoice = await db.invoices.get(ksefNumer)
        if (invoice?.sellerNip) {
          await upsertNipRule({
            nip:        invoice.sellerNip,
            category,
            sellerName: invoice.sellerName,
            updatedAt:  Date.now(),
          })
        }
      }

      return { ok: true }
    }

    case 'SET_STATUS': {
      const { ksefNumer, paymentStatus } = msg.payload as {
        ksefNumer: string
        paymentStatus: 'paid' | 'unpaid' | 'unknown'
      }
      await updateInvoice(ksefNumer, { paymentStatus, paymentStatusOverride: true })
      return { ok: true }
    }

    case 'GENERATE_PDF': {
      const { ksefNumer, template } = msg.payload as {
        ksefNumer: string
        template: string
      }
      const invoice = await db.invoices.get(ksefNumer)
      if (!invoice) throw new Error(`Faktura ${ksefNumer} nie znaleziona w DB`)

      // Import dynamiczny — unikamy ładowania jsPDF gdy niepotrzebny
      const { generatePdf } = await import('../shared/pdf/generator')
      const blob = await generatePdf(invoice.xmlRaw, template)

      // Blob nie może być przesłany przez sendMessage — konwertujemy do base64
      const arrayBuffer = await blob.arrayBuffer()
      const base64 = arrayBufferToBase64(arrayBuffer)
      return { base64, filename: `${invoice.invoiceNumber.replace(/\//g, '-')}.pdf` }
    }

    case 'GENERATE_ZIP': {
      const { ksefNumery, format, template } = msg.payload as {
        ksefNumery: string[]
        format: 'xml' | 'pdf' | 'both'
        template: string
      }

      return withKeepalive(async () => {
        const { buildZip } = await import('../shared/zip/builder')
        const invoices = await Promise.all(
          ksefNumery.map((k) => db.invoices.get(k))
        ).then((results) => results.filter((inv): inv is Invoice => inv != null))

        const total = invoices.length
        const zip = await buildZip(invoices, format, template, (current) => {
          sendProgressToAllContexts({ operation: 'GENERATE_ZIP', current, total })
        })

        const arrayBuffer = await zip.arrayBuffer()
        const base64 = arrayBufferToBase64(arrayBuffer)
        return { base64, filename: 'faktury-pufka.zip' }
      })
    }

    case 'SEND_EMAIL': {
      const { to, format, ksefNumery, template } = msg.payload as {
        to: string
        format: 'xml' | 'pdf' | 'both'
        ksefNumery: string[]
        template: string
      }

      const invoices = await Promise.all(
        ksefNumery.map((k) => db.invoices.get(k))
      ).then((results) => results.filter((inv): inv is Invoice => inv != null))

      const account = await db.settings.get('account')
      const token = (account?.value as { token?: string })?.token

      const attachments = await Promise.all(
        invoices.map(async (inv) => {
          const entry: Record<string, unknown> = { name: inv.invoiceNumber }
          if (format !== 'pdf') entry.xml = inv.xmlRaw
          if (format !== 'xml') {
            const { generatePdf } = await import('../shared/pdf/generator')
            const blob = await generatePdf(inv.xmlRaw, template)
            const ab = await blob.arrayBuffer()
            entry.pdf = arrayBufferToBase64(ab)
          }
          return entry
        })
      )

      const resp = await fetch('https://api.pufka.app/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ to, format, invoices: attachments }),
      })

      if (!resp.ok) throw new Error(`Email API error: ${resp.status}`)
      return { ok: true }
    }

    case 'MARK_XML_DOWNLOADED': {
      const { ksefNumery } = msg.payload as { ksefNumery: string[] }
      for (const ksefNumer of ksefNumery) {
        await db.invoices.update(ksefNumer, { downloadedXml: true })
        const inv = await db.invoices.get(ksefNumer)
        if (inv) {
          notifyTabs({
            type: 'INVOICE_UPDATED',
            payload: {
              ksefNumer,
              data: {
                paymentStatus: inv.paymentStatus,
                category:      inv.category,
                downloadedXml: inv.downloadedXml,
                downloadedPdf: inv.downloadedPdf,
              },
            },
          })
        }
      }
      return { ok: true }
    }

    case 'MARK_PDF_DOWNLOADED': {
      const { ksefNumery } = msg.payload as { ksefNumery: string[] }
      for (const ksefNumer of ksefNumery) {
        await db.invoices.update(ksefNumer, { downloadedPdf: true })
        const inv = await db.invoices.get(ksefNumer)
        if (inv) {
          notifyTabs({
            type: 'INVOICE_UPDATED',
            payload: {
              ksefNumer,
              data: {
                paymentStatus: inv.paymentStatus,
                category:      inv.category,
                downloadedXml: inv.downloadedXml,
                downloadedPdf: inv.downloadedPdf,
              },
            },
          })
        }
      }
      return { ok: true }
    }

    default:
      console.warn('[PuFKa SW] Nieznany typ wiadomości:', msg.type)
      return null
  }
}

// Wyślij wiadomość do wszystkich zakładek z KSeF
function notifyTabs(message: Message): void {
  chrome.tabs.query(
    { url: 'https://ap.ksef.mf.gov.pl/web/*' },
    (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // Tab może być zamknięty — ignoruj błąd
          })
        }
      })
    }
  )
}

function sendProgressToAllContexts(progress: ProgressMessage): void {
  chrome.runtime.sendMessage({
    type: 'PROGRESS',
    payload: progress,
  }).catch(() => {
    // Side panel może być zamknięty — ignoruj
  })
}
