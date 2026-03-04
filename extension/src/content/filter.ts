import type { PaymentStatus, Category, FilterState } from '../shared/types'

export type { FilterState }

export function applyFilter(
  row: HTMLElement,
  invoice: { category: Category; paymentStatus: PaymentStatus },
  filter: FilterState
): void {
  const visible = matchesFilter(invoice, filter)
  row.style.display = visible ? '' : 'none'
}

export function applyFilterToAll(filter: FilterState): void {
  document.querySelectorAll<HTMLElement>('tr[mat-row][data-pufka-processed]').forEach((row) => {
    const hasPaid    = row.querySelector('.pufka-badge--paid') !== null
    const hasUnpaid  = row.querySelector('.pufka-badge--unpaid') !== null
    const hasCosts   = row.querySelector('.pufka-badge--costs') !== null
    const hasGoods   = row.querySelector('.pufka-badge--goods') !== null

    const invoice = {
      paymentStatus: (hasPaid ? 'paid' : hasUnpaid ? 'unpaid' : 'unknown') as PaymentStatus,
      category: (hasCosts ? 'costs' : hasGoods ? 'goods' : null) as Category,
    }
    applyFilter(row, invoice, filter)
  })
}

function matchesFilter(
  invoice: { category: Category; paymentStatus: PaymentStatus },
  filter: FilterState
): boolean {
  if (filter.paymentStatus && invoice.paymentStatus !== filter.paymentStatus) {
    return false
  }
  if (filter.category === 'uncategorized' && invoice.category !== null) {
    return false
  }
  if (
    filter.category &&
    filter.category !== 'uncategorized' &&
    invoice.category !== filter.category
  ) {
    return false
  }
  return true
}
