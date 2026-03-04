import type { PaymentStatus, Category, BadgeData } from '../shared/types'

export type { BadgeData }

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  paid:    'Zapłacona',
  unpaid:  'Do zapłaty',
  unknown: '?',
}

const CATEGORY_LABELS: Record<NonNullable<Category>, string> = {
  costs: 'Koszty',
  goods: 'Towary',
}

export function injectBadge(
  row: HTMLElement,
  ksefNumer: string,
  data: BadgeData | null
): void {
  const cell = row.querySelector('.cdk-column-invoiceNumber')
  if (!cell) return

  // Usuń stary kontener jeśli istnieje
  cell.querySelector('.pufka-badges')?.remove()

  const container = document.createElement('span')
  container.className = 'pufka-badges'
  container.dataset.ksefNumer = ksefNumer

  if (data === null) {
    // Placeholder podczas ładowania
    const placeholder = document.createElement('span')
    placeholder.className = 'pufka-badge pufka-badge--loading'
    placeholder.textContent = '…'
    container.appendChild(placeholder)
  } else {
    renderBadges(container, data)
  }

  cell.appendChild(container)
}

export function updateBadge(ksefNumer: string, data: BadgeData): void {
  const container = document.querySelector<HTMLElement>(
    `.pufka-badges[data-ksef-numer="${ksefNumer}"]`
  )
  if (!container) return

  container.innerHTML = ''
  renderBadges(container, data)
}

function renderBadges(container: HTMLElement, data: BadgeData): void {
  // Badge statusu płatności
  if (data.paymentStatus) {
    const badge = document.createElement('span')
    const cls = data.paymentStatus === 'paid' ? 'paid'
              : data.paymentStatus === 'unpaid' ? 'unpaid' : 'unknown'
    badge.className = `pufka-badge pufka-badge--${cls}`
    badge.textContent = PAYMENT_LABELS[data.paymentStatus]
    container.appendChild(badge)
  }

  // Badge kategorii
  if (data.category) {
    const badge = document.createElement('span')
    badge.className = `pufka-badge pufka-badge--${data.category}`
    badge.textContent = CATEGORY_LABELS[data.category]
    container.appendChild(badge)
  }

  // Badge pobrania XML
  if (data.downloadedXml) {
    const badge = document.createElement('span')
    badge.className = 'pufka-badge pufka-badge--dl-xml'
    badge.textContent = '↓XML'
    badge.title = 'Pobrana jako XML'
    container.appendChild(badge)
  }

  // Badge pobrania PDF
  if (data.downloadedPdf) {
    const badge = document.createElement('span')
    badge.className = 'pufka-badge pufka-badge--dl-pdf'
    badge.textContent = '↓PDF'
    badge.title = 'Pobrana jako PDF'
    container.appendChild(badge)
  }
}
