import { db } from './schema'
import type { Invoice, NipRule, Category, PaymentStatus } from '../types'

// Faktury
export const getInvoice = (ksefNumer: string) =>
  db.invoices.get(ksefNumer)

export const getInvoices = () =>
  db.invoices.orderBy('issueDate').reverse().toArray()

export const getInvoicesByCategory = (category: Category) =>
  db.invoices.where('category').equals(category ?? 'null').toArray()

export const getInvoicesByStatus = (status: PaymentStatus) =>
  db.invoices.where('paymentStatus').equals(status).toArray()

export const upsertInvoice = (invoice: Invoice) =>
  db.invoices.put(invoice)

export const updateInvoice = (
  ksefNumer: string,
  changes: Partial<Invoice>
) => db.invoices.update(ksefNumer, changes)

// Reguły NIP
export const getNipRule = (nip: string) =>
  db.nipRules.get(nip)

export const getAllNipRules = () =>
  db.nipRules.toArray()

export const upsertNipRule = (rule: NipRule) =>
  db.nipRules.put(rule)

export const deleteNipRule = (nip: string) =>
  db.nipRules.delete(nip)

// Ustawienia
export const getSetting = async <T>(key: string): Promise<T | null> => {
  const row = await db.settings.get(key)
  return row ? (row.value as T) : null
}

export const setSetting = (key: string, value: unknown) =>
  db.settings.put({ key, value })
