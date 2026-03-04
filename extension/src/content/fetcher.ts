import type { Message } from '../shared/types'

const MAX_CONCURRENT = 5

export class XmlFetcher {
  private queue: string[] = []        // ksefNumery oczekujące na pobranie
  private inFlight = new Set<string>()
  private onFetched: (ksefNumer: string, xmlRaw: string) => void

  constructor(onFetched: (ksefNumer: string, xmlRaw: string) => void) {
    this.onFetched = onFetched
  }

  // Dodaje KSeF numer do kolejki (jeśli nie jest już w locie)
  async enqueue(ksefNumer: string): Promise<void> {
    if (this.inFlight.has(ksefNumer)) return
    if (this.queue.includes(ksefNumer)) return

    // Sprawdź cache w service workerze
    const cached = await sendMessage<boolean>({
      type: 'CHECK_CACHE',
      payload: { ksefNumer },
    })
    if (cached) return   // XML już w DB — nie pobieraj ponownie

    this.queue.push(ksefNumer)
    this.drain()
  }

  private drain(): void {
    while (
      this.queue.length > 0 &&
      this.inFlight.size < MAX_CONCURRENT
    ) {
      const ksefNumer = this.queue.shift()!
      this.inFlight.add(ksefNumer)
      this.fetchOne(ksefNumer)
        .then((xmlRaw) => {
          this.onFetched(ksefNumer, xmlRaw)
        })
        .catch((err) => {
          console.warn(`[PuFKa] Błąd pobierania XML dla ${ksefNumer}:`, err)
        })
        .finally(() => {
          this.inFlight.delete(ksefNumer)
          this.drain()  // zwolnił się slot — pobierz następny
        })
    }
  }

  private fetchOne(ksefNumer: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open(
        'GET',
        `https://ap.ksef.mf.gov.pl/webs/api/v2/invoices/ksef/${ksefNumer}`
      )
      xhr.setRequestHeader('Accept', 'application/octet-stream')
      xhr.withCredentials = true
      xhr.responseType = 'text'

      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve(xhr.responseText)
        } else if (xhr.status === 401 || xhr.status === 403) {
          reject(new Error(`Brak autoryzacji (${xhr.status}) — użytkownik może nie być zalogowany`))
        } else {
          reject(new Error(`HTTP ${xhr.status} dla ${ksefNumer}`))
        }
      }

      xhr.onerror = () => reject(new Error('Network error'))
      xhr.ontimeout = () => reject(new Error('Timeout'))
      xhr.timeout = 30_000   // 30s timeout

      xhr.send()
    })
  }
}

// Helper do komunikacji z service workerem
function sendMessage<T>(message: Message): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError)
      } else {
        resolve(response as T)
      }
    })
  })
}
