import Dexie, { type Table } from 'dexie'
import type { Invoice, NipRule, Settings } from '../types'

export class PufkaDB extends Dexie {
  invoices!: Table<Invoice>
  nipRules!: Table<NipRule>
  settings!: Table<Settings>

  constructor() {
    super('pufka')

    this.version(1).stores({
      invoices: 'ksefNumer, invoiceNumber, sellerNip, issueDate, paymentStatus, category, downloaded, invoiceType, fetchedAt',
      nipRules: 'nip',
      settings: 'key',
    })

    this.version(2).stores({
      // Indeksy: klucz główny + pola do filtrowania/sortowania
      invoices: [
        'ksefNumer',       // klucz główny
        'invoiceNumber',
        'sellerNip',       // potrzebne do reguł klasyfikacji
        'issueDate',       // sortowanie
        'paymentStatus',   // filtrowanie
        'category',        // filtrowanie
        'downloadedXml',   // filtrowanie
        'downloadedPdf',   // filtrowanie
        'invoiceType',     // filtrowanie po typie
        'fetchedAt',       // sortowanie po czasie dodania
      ].join(', '),

      nipRules: 'nip',
      settings: 'key',
    }).upgrade((tx) =>
      tx.table('invoices').toCollection().modify((inv: Record<string, unknown>) => {
        inv.downloadedXml = inv['downloaded'] ?? false
        inv.downloadedPdf = false
        delete inv['downloaded']
      })
    )
  }
}

// Singleton — jeden egzemplarz w każdym kontekście (SW, side panel, popup)
export const db = new PufkaDB()
