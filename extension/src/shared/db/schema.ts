import Dexie, { type Table } from 'dexie'
import type { Invoice, NipRule, Settings } from '../types'

export class PufkaDB extends Dexie {
  invoices!: Table<Invoice>
  nipRules!: Table<NipRule>
  settings!: Table<Settings>

  constructor() {
    super('pufka')

    this.version(1).stores({
      // Indeksy: klucz główny + pola do filtrowania/sortowania
      invoices: [
        'ksefNumer',      // klucz główny
        'invoiceNumber',
        'sellerNip',      // potrzebne do reguł klasyfikacji
        'issueDate',      // sortowanie
        'paymentStatus',  // filtrowanie
        'category',       // filtrowanie
        'downloaded',     // filtrowanie
        'invoiceType',    // filtrowanie po typie
        'fetchedAt',      // sortowanie po czasie dodania
      ].join(', '),

      nipRules: 'nip',
      settings: 'key',
    })
  }
}

// Singleton — jeden egzemplarz w każdym kontekście (SW, side panel, popup)
export const db = new PufkaDB()
