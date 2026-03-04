import { db } from '../shared/db/schema'

const KSEF_INVOICE_URL_PATTERN =
  /\/webs\/api\/v2\/invoices\/ksef\/([^?#/]+)/

export function initDownloadTracker(): void {
  chrome.downloads.onCreated.addListener(async (item) => {
    // Tylko pobierania z domeny KSeF
    const match = item.url.match(KSEF_INVOICE_URL_PATTERN)
    if (!match) return

    const ksefNumer = decodeURIComponent(match[1])

    try {
      await db.invoices.update(ksefNumer, { downloaded: true })

      // Powiadom content script żeby zaktualizował badge
      chrome.tabs.query(
        { url: 'https://ap.ksef.mf.gov.pl/web/*' },
        (tabs) => {
          tabs.forEach((tab) => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, {
                type: 'INVOICE_UPDATED',
                payload: {
                  ksefNumer,
                  data: { downloaded: true },
                },
              }).catch(() => {})
            }
          })
        }
      )
    } catch (err) {
      console.warn('[PuFKa SW] Błąd aktualizacji flagi downloaded:', err)
    }
  })
}
