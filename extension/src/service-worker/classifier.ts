import { db } from '../shared/db/schema'
import { getSetting } from '../shared/db/queries'
import type { ParsedInvoice, Category, KeywordRules } from '../shared/types'
import { DEFAULT_KEYWORD_RULES } from '../shared/types'

export async function classify(
  invoice: ParsedInvoice
): Promise<{ category: Category; categoryAutoApplied: boolean }> {

  // 1. Reguła NIP (najwyższy priorytet)
  if (invoice.seller.nip) {
    const nipRule = await db.nipRules.get(invoice.seller.nip)
    if (nipRule) {
      return { category: nipRule.category, categoryAutoApplied: true }
    }
  }

  // 2. Słowa kluczowe w pozycjach faktury
  const rules: KeywordRules =
    (await getSetting<KeywordRules>('keywordRules')) ?? DEFAULT_KEYWORD_RULES

  const texts = extractSearchableText(invoice)

  if (matchesAny(texts, rules.costs)) {
    return { category: 'costs', categoryAutoApplied: true }
  }
  if (matchesAny(texts, rules.goods)) {
    return { category: 'goods', categoryAutoApplied: true }
  }

  return { category: null, categoryAutoApplied: false }
}

function extractSearchableText(invoice: ParsedInvoice): string[] {
  const texts: string[] = []

  // Pozycje FaWiersz (VAT, ROZ)
  if (invoice.lineItems) {
    texts.push(...invoice.lineItems.map((item) => item.name.toLowerCase()))
  }

  // Pozycje zamówienia (ZAL)
  if (invoice.order?.lines) {
    texts.push(...invoice.order.lines.map((line) => line.name.toLowerCase()))
  }

  // Nazwa sprzedawcy jako fallback
  texts.push(invoice.seller.name.toLowerCase())

  return texts
}

function matchesAny(texts: string[], keywords: string[]): boolean {
  return keywords.some((kw) =>
    texts.some((text) => text.includes(kw.toLowerCase()))
  )
}
