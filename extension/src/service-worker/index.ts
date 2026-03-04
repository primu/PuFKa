import { handleMessage } from './messages'
import { initDownloadTracker } from './downloads'
import type { Message } from '../shared/types'

// Otwórz side panel po kliknięciu ikony rozszerzenia
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

// Po instalacji/aktualizacji — wstrzyknij content script do już otwartych kart KSeF
// (bez tego user musiałby ręcznie odświeżyć stronę)
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ url: 'https://ap.ksef.mf.gov.pl/web/*' }, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content/index.ts'],
        }).catch(() => {
          // Karta może być chroniona (np. chrome://) — ignoruj
        })
      }
    }
  })
})

// Obsługa wiadomości (content script + side panel)
chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    // handleMessage zwraca Promise — musimy zwrócić true żeby zachować kanał
    handleMessage(message)
      .then(sendResponse)
      .catch((err) => {
        console.error('[PuFKa SW] Błąd obsługi wiadomości:', err)
        sendResponse(null)
      })
    return true // async response
  }
)

// Śledzenie pobrań użytkownika
initDownloadTracker()

console.log('[PuFKa SW] Uruchomiony')
