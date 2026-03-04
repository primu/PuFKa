import { db } from '../shared/db/schema'

// Scenariusz 1: KSeF używa bezpośredniego URL API jako download URL
const KSEF_API_URL_PATTERN =
  /\/webs\/api\/v2\/invoices\/ksef\/([^?#/]+)/

// Scenariusz 2: KSeF tworzy blob URL (XHR→blob→a.click) — dopasowanie po nazwie pliku
// Format nazwy: NIP(10)-Data(8)-Hex(12)-Check(2).xml
const KSEF_FILENAME_PATTERN =
  /(\d{10}-\d{8}-[0-9A-F]{12}-[0-9A-Z]{2})\.xml$/i

// Śledź download ID z blob URL KSeF (żeby filtrować onChanged)
const pendingKsefDownloads = new Set<number>()

async function markDownloaded(ksefNumer: string): Promise<void> {
  try {
    await db.invoices.update(ksefNumer, { downloaded: true })
    chrome.tabs.query(
      { url: 'https://ap.ksef.mf.gov.pl/web/*' },
      (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'INVOICE_UPDATED',
              payload: { ksefNumer, data: { downloaded: true } },
            }).catch(() => {})
          }
        })
      }
    )
  } catch (err) {
    console.warn('[PuFKa SW] Błąd aktualizacji flagi downloaded:', err)
  }
}

export function initDownloadTracker(): void {
  chrome.downloads.onCreated.addListener(async (item) => {
    // Scenariusz 1: bezpośredni URL do API KSeF
    const urlMatch = item.url.match(KSEF_API_URL_PATTERN)
    if (urlMatch) {
      await markDownloaded(decodeURIComponent(urlMatch[1]))
      return
    }

    // Scenariusz 2: blob URL z domeny KSeF — czekaj na finalizację nazwy pliku
    if (item.url.startsWith('blob:https://ap.ksef.mf.gov.pl/')) {
      pendingKsefDownloads.add(item.id)
    }
  })

  // Gdy nazwa pliku jest znana — wyciągnij numer KSeF
  chrome.downloads.onChanged.addListener(async (delta) => {
    if (!delta.filename?.current) return
    const isPending = pendingKsefDownloads.has(delta.id)
    if (!isPending) return

    pendingKsefDownloads.delete(delta.id)
    const match = delta.filename.current.match(KSEF_FILENAME_PATTERN)
    if (match) {
      await markDownloaded(match[1])
    }
  })
}
