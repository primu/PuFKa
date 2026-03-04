import { db } from '../shared/db/schema'
import type { BadgeData } from '../shared/types'

// Scenariusz 1: KSeF używa bezpośredniego URL API jako download URL
const KSEF_API_URL_PATTERN =
  /\/webs\/api\/v2\/invoices\/ksef\/([^?#/]+)/

// Scenariusz 2: KSeF tworzy blob URL (XHR→blob→a.click) — dopasowanie po nazwie pliku
// Format nazwy: NIP(10)-Data(8)-Hex(12)-Check(2).xml
const KSEF_FILENAME_PATTERN =
  /(\d{10}-\d{8}-[0-9A-F]{12}-[0-9A-Z]{2})\.xml$/i

// Śledź download ID z blob URL KSeF (żeby filtrować onChanged)
const pendingKsefDownloads = new Set<number>()

function notifyBadgeUpdate(ksefNumer: string, data: BadgeData): void {
  chrome.tabs.query(
    { url: 'https://ap.ksef.mf.gov.pl/web/*' },
    (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'INVOICE_UPDATED',
            payload: { ksefNumer, data },
          }).catch(() => {})
        }
      })
    }
  )
}

async function markXmlDownloaded(ksefNumer: string): Promise<void> {
  try {
    await db.invoices.update(ksefNumer, { downloadedXml: true })

    // Czytaj pełny rekord żeby wysłać kompletne BadgeData do content script
    const invoice = await db.invoices.get(ksefNumer)
    if (!invoice) return

    notifyBadgeUpdate(ksefNumer, {
      paymentStatus: invoice.paymentStatus,
      category:      invoice.category,
      downloadedXml: invoice.downloadedXml,
      downloadedPdf: invoice.downloadedPdf,
    })
  } catch (err) {
    console.warn('[PuFKa SW] Błąd aktualizacji flagi downloadedXml:', err)
  }
}

export function initDownloadTracker(): void {
  chrome.downloads.onCreated.addListener(async (item) => {
    // Scenariusz 1: URL zawiera numer KSeF — oznacz natychmiast
    const urlMatch = item.url.match(KSEF_API_URL_PATTERN)
    if (urlMatch) {
      await markXmlDownloaded(decodeURIComponent(urlMatch[1]))
      // Bez return — scenariusz 2 działa równolegle jako weryfikacja przez nazwę pliku
    }

    // Scenariusz 2: każde pobieranie z domeny KSeF — sprawdź też przez nazwę pliku
    if (item.url.includes('ap.ksef.mf.gov.pl')) {
      pendingKsefDownloads.add(item.id)
    }
  })

  // Gdy nazwa pliku jest znana — wyciągnij numer KSeF
  chrome.downloads.onChanged.addListener(async (delta) => {
    if (!delta.filename?.current) return
    if (!pendingKsefDownloads.has(delta.id)) return

    pendingKsefDownloads.delete(delta.id)
    const match = delta.filename.current.match(KSEF_FILENAME_PATTERN)
    if (match) {
      await markXmlDownloaded(match[1])
    }
  })
}
