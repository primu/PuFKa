import { XmlFetcher } from './fetcher'
import { injectBadge, updateBadge, type BadgeData } from './badge'
import { applyFilter, applyFilterToAll, type FilterState } from './filter'
import type { Message, Invoice } from '../shared/types'

const SELECTORS = {
  invoiceList:      'app-invoice-list',
  matRow:           'tr[mat-row]',
  ksefNumberCell:   '.cdk-column-ksefNumber',
  invoiceNumberCell: '.cdk-column-invoiceNumber',
}

// Atrybut znacznika — zapobiega podwójnemu przetwarzaniu wiersza
const PROCESSED_ATTR = 'data-pufka-processed'

// Aktualne filtry (synchronizowane z side panel przez wiadomości)
let currentFilter: FilterState = { category: null, paymentStatus: null }

// Fetcher z callbackiem aktualizującym badge po pobraniu XML
const fetcher = new XmlFetcher((ksefNumer, xmlRaw) => {
  sendMessage<Invoice | null>({
    type: 'XML_FETCHED',
    payload: { ksefNumer, xmlRaw },
  }).then((invoice) => {
    if (invoice) {
      updateBadge(ksefNumer, {
        paymentStatus: invoice.paymentStatus,
        category: invoice.category,
        downloaded: invoice.downloaded,
      })
      applyRowFilter(ksefNumer, invoice, currentFilter)
    }
  })
})

// Oczekujące wiersze do przetworzenia (batching przez requestIdleCallback)
const pendingRows: HTMLElement[] = []

function processPendingRows(): void {
  const rows = pendingRows.splice(0)
  rows.forEach(processRow)
}

function scheduleProcessing(): void {
  if (pendingRows.length === 0) return
  if ('requestIdleCallback' in window) {
    requestIdleCallback(processPendingRows, { timeout: 200 })
  } else {
    setTimeout(processPendingRows, 0)
  }
}

async function processRow(row: HTMLElement): Promise<void> {
  const ksefNumerCell = row.querySelector(SELECTORS.ksefNumberCell)
  const ksefNumer = ksefNumerCell?.textContent?.trim()
  if (!ksefNumer) return

  row.setAttribute(PROCESSED_ATTR, ksefNumer)

  // Wstrzyknij placeholder natychmiast
  injectBadge(row, ksefNumer, null)

  // Zapytaj SW o dane z cache
  const invoice = await sendMessage<Invoice | null>({
    type: 'GET_INVOICE',
    payload: { ksefNumer },
  })

  if (invoice) {
    // Dane w DB — zaktualizuj badge natychmiast
    updateBadge(ksefNumer, {
      paymentStatus: invoice.paymentStatus,
      category: invoice.category,
      downloaded: invoice.downloaded,
    })
    applyRowFilter(ksefNumer, invoice, currentFilter)
  } else {
    // Brak w DB — dodaj do kolejki pobierania
    fetcher.enqueue(ksefNumer)
  }
}

function applyRowFilter(
  ksefNumer: string,
  invoice: Pick<Invoice, 'category' | 'paymentStatus'>,
  filter: FilterState
): void {
  const row = document.querySelector<HTMLElement>(
    `tr[mat-row][${PROCESSED_ATTR}="${ksefNumer}"]`
  )
  if (row) applyFilter(row, invoice, filter)
}

function observeRows(container: Element): void {
  const observer = new MutationObserver((mutations) => {
    let hasNewRows = false
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (
          node instanceof HTMLElement &&
          node.matches(SELECTORS.matRow) &&
          !node.hasAttribute(PROCESSED_ATTR)
        ) {
          pendingRows.push(node)
          hasNewRows = true
        }
      }
    }
    if (hasNewRows) scheduleProcessing()
  })

  observer.observe(container, { childList: true, subtree: true })

  // Przetwórz wiersze już istniejące w DOM
  container.querySelectorAll<HTMLElement>(
    `${SELECTORS.matRow}:not([${PROCESSED_ATTR}])`
  ).forEach((row) => pendingRows.push(row))
  scheduleProcessing()
}

function waitForInvoiceList(): void {
  const existing = document.querySelector(SELECTORS.invoiceList)
  if (existing) {
    observeRows(existing)
    return
  }

  const observer = new MutationObserver(() => {
    const el = document.querySelector(SELECTORS.invoiceList)
    if (el) {
      observer.disconnect()
      observeRows(el)
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

// Nasłuchuj wiadomości z service workera i side panel
chrome.runtime.onMessage.addListener((msg: Message) => {
  if (msg.type === 'INVOICE_UPDATED') {
    const { ksefNumer, data } = msg.payload as {
      ksefNumer: string
      data: BadgeData
    }
    updateBadge(ksefNumer, data)
  }

  if (msg.type === 'SET_FILTER') {
    currentFilter = msg.payload as FilterState
    applyFilterToAll(currentFilter)
  }
})

function injectStyles(): void {
  if (document.getElementById('pufka-styles')) return
  const style = document.createElement('style')
  style.id = 'pufka-styles'
  style.textContent = `
    .pufka-badges {
      display: inline-flex;
      gap: 3px;
      margin-left: 6px;
      vertical-align: middle;
    }
    .pufka-badge {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
      line-height: 16px;
      white-space: nowrap;
    }
    .pufka-badge--paid    { background: #d4edda; color: #155724; }
    .pufka-badge--unpaid  { background: #f8d7da; color: #721c24; }
    .pufka-badge--unknown { background: #e2e3e5; color: #383d41; }
    .pufka-badge--costs   { background: #cce5ff; color: #004085; }
    .pufka-badge--goods   { background: #fff3cd; color: #856404; }
    .pufka-badge--dl      { background: #d6d8d9; color: #1b1e21; }
    .pufka-badge--loading { background: #e2e3e5; color: #6c757d; }
  `
  document.head.appendChild(style)
}

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

// Eksportuj applyFilterToAll do użycia przez side panel (przez wiadomości)
export { applyFilterToAll, type FilterState }

// Inicjalizacja
injectStyles()
waitForInvoiceList()
