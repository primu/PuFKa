import { jsPDF } from 'jspdf'
import { parseInvoiceXml } from '../xml/parser'
import { TEMPLATES, LABELS, type TemplateConfig, type Labels } from './templates/config'
import type { ParsedInvoice } from '../types'

const PAGE_HEIGHT = 297  // A4 mm
const MARGIN_BOTTOM = 12

// ─── Publiczne API ──────────────────────────────────────────────────

export async function generatePdf(
  xmlRaw: string,
  templateKey: string = 'standard-pl',
  ksefNumer: string = ''
): Promise<Blob> {
  const invoice = parseInvoiceXml(xmlRaw, ksefNumer)
  const cfg     = TEMPLATES[templateKey] ?? TEMPLATES['standard-pl']
  const doc     = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const lbl     = LABELS[cfg.language]

  renderInvoice(invoice, doc, cfg, lbl)

  return doc.output('blob')
}

// ─── Główny renderer ────────────────────────────────────────────────

function renderInvoice(
  inv: ParsedInvoice,
  doc: jsPDF,
  cfg: TemplateConfig,
  lbl: Labels
): void {
  let y = cfg.marginTop

  y = renderHeader(inv, doc, cfg, lbl, y)
  y = addSeparator(doc, cfg, y)

  if (inv.correctedInvoice) {
    y = renderCorrectionInfo(inv, doc, cfg, lbl, y)
    y = addSeparator(doc, cfg, y)
  }

  if (inv.advanceInvoiceKsefNumer) {
    y = renderAdvanceLink(inv, doc, cfg, lbl, y)
    y = addSeparator(doc, cfg, y)
  }

  y = renderParties(inv, doc, cfg, lbl, y)
  y = addSeparator(doc, cfg, y)

  if (inv.thirdParties?.length) {
    y = renderThirdParties(inv, doc, cfg, lbl, y)
    y = addSeparator(doc, cfg, y)
  }

  if (inv.periodFrom || inv.issueDateTime) {
    y = renderPeriod(inv, doc, cfg, lbl, y)
    y = addSeparator(doc, cfg, y)
  }

  if (inv.lineItems?.length) {
    y = renderLineItems(inv, doc, cfg, lbl, y)
    y = addSeparator(doc, cfg, y)
  }

  if (inv.order) {
    y = renderOrder(inv, doc, cfg, lbl, y)
    y = addSeparator(doc, cfg, y)
  }

  if (inv.vatSummary.length > 0) {
    y = renderVatSummary(inv, doc, cfg, lbl, y)
    y = addSeparator(doc, cfg, y)
  }

  if (inv.settlement) {
    y = renderSettlement(inv, doc, cfg, lbl, y)
    y = addSeparator(doc, cfg, y)
  }

  if (inv.payment) {
    y = renderPayment(inv, doc, cfg, lbl, y)
    y = addSeparator(doc, cfg, y)
  }

  if (inv.transportConditions) {
    y = renderTransport(inv, doc, cfg, lbl, y)
    y = addSeparator(doc, cfg, y)
  }

  if (inv.additionalNotes?.length) {
    y = renderNotes(inv, doc, cfg, lbl, y)
    y = addSeparator(doc, cfg, y)
  }

  if (inv.footer) {
    renderFooter(inv, doc, cfg, lbl, y)
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

// TODO: Phase polish — zamień na embedded Roboto/DejaVu font w base64
function stripDiacritics(str: string): string {
  return str
    .replace(/ą/g, 'a').replace(/Ą/g, 'A')
    .replace(/ć/g, 'c').replace(/Ć/g, 'C')
    .replace(/ę/g, 'e').replace(/Ę/g, 'E')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .replace(/ń/g, 'n').replace(/Ń/g, 'N')
    .replace(/ó/g, 'o').replace(/Ó/g, 'O')
    .replace(/ś/g, 's').replace(/Ś/g, 'S')
    .replace(/ź/g, 'z').replace(/Ź/g, 'Z')
    .replace(/ż/g, 'z').replace(/Ż/g, 'Z')
}

// Skrót: strip diacritics + null-safe
function sd(str: string | undefined | null): string {
  return stripDiacritics(str ?? '')
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_HEIGHT - MARGIN_BOTTOM) {
    doc.addPage()
    return 12
  }
  return y
}

function addSeparator(doc: jsPDF, cfg: TemplateConfig, y: number): number {
  y = ensureSpace(doc, y, 3)
  doc.setDrawColor(cfg.colorAccent)
  doc.setLineWidth(0.2)
  doc.line(cfg.marginLeft, y, cfg.marginRight, y)
  return y + 2
}

function text(
  doc: jsPDF,
  content: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: 'left' | 'right' | 'center' = 'left'
): number {
  doc.setFontSize(size)
  doc.setTextColor(color)
  doc.text(stripDiacritics(content), x, y, { align })
  return y + size * 0.4  // przybliżony line height w mm
}

function label(doc: jsPDF, cfg: TemplateConfig, txt: string, x: number, y: number): number {
  return text(doc, txt, x, y, cfg.fontSizeSmall, cfg.colorMuted)
}

function fmt(n: number | undefined | null, decimals = 2): string {
  if (n === undefined || n === null) return ''
  return n.toFixed(decimals).replace('.', ',')
}

function fmtVatRate(rate: string): string {
  const numeric = ['23', '8', '5', '0']
  if (numeric.includes(rate)) return `${rate}%`
  if (rate === 'zw') return 'zw.'
  if (rate === 'np') return 'n.p.'
  if (rate === 'oo') return 'o.o.'
  return rate
}

// ─── Sekcje ─────────────────────────────────────────────────────────

function renderHeader(
  inv: ParsedInvoice,
  doc: jsPDF,
  cfg: TemplateConfig,
  lbl: Labels,
  y: number
): number {
  y = ensureSpace(doc, y, 20)

  const titleMap: Record<string, string> = {
    VAT:     lbl.invoice,
    ZAL:     lbl.advance,
    ROZ:     lbl.settlement,
    KOR:     lbl.correction,
    KOR_ROZ: lbl.correctionSettl,
    KOR_ZAL: lbl.correctionAdv,
  }
  const title = titleMap[inv.rodzajFaktury] ?? lbl.invoice

  doc.setFontSize(cfg.fontSizeTitle)
  doc.setTextColor(cfg.colorTitle)
  doc.setFont('helvetica', 'bold')
  doc.text(sd(`${title}  nr ${inv.invoiceNumber}`), cfg.marginLeft, y)
  doc.setFont('helvetica', 'normal')

  // Data wystawienia (prawy górny róg)
  doc.setFontSize(cfg.fontSizeBody)
  doc.setTextColor(cfg.colorText)
  doc.text(sd(inv.issueDate), cfg.marginRight, y, { align: 'right' })

  y += cfg.fontSizeTitle * 0.5

  // Linia KSeF
  if (cfg.showKsefNumber || cfg.showKsefDate || cfg.showFormVariant) {
    const parts: string[] = []
    if (cfg.showKsefNumber)  parts.push(`${lbl.ksefNumber}: ${inv.ksefNumer}`)
    if (cfg.showFormVariant) parts.push('FA(3)')
    if (cfg.showKsefDate)    parts.push(`${lbl.receivedAt}: ${inv.dataWytworzeniaFa}`)

    doc.setFontSize(cfg.fontSizeSmall)
    doc.setTextColor(cfg.colorMuted)
    doc.text(sd(parts.join('  |  ')), cfg.marginLeft, y)
    y += cfg.fontSizeSmall * 0.5
  }

  return y + 1
}

function renderCorrectionInfo(
  inv: ParsedInvoice,
  doc: jsPDF,
  cfg: TemplateConfig,
  lbl: Labels,
  y: number
): number {
  y = ensureSpace(doc, y, 16)
  const cor = inv.correctedInvoice!

  y = label(doc, cfg, sd(`${lbl.correctionOf}: ${cor.number}  (${cor.date})`), cfg.marginLeft, y)
  y = label(doc, cfg, `${lbl.correctionKsef}: ${cor.ksefNumer}`, cfg.marginLeft, y)
  if (inv.correctionReason) {
    y = label(doc, cfg, sd(`${lbl.correctionReason}: ${inv.correctionReason}`), cfg.marginLeft, y)
  }
  return y
}

function renderAdvanceLink(
  inv: ParsedInvoice,
  doc: jsPDF,
  cfg: TemplateConfig,
  lbl: Labels,
  y: number
): number {
  y = ensureSpace(doc, y, 6)
  y = label(doc, cfg, `${lbl.advanceKsef}: ${inv.advanceInvoiceKsefNumer}`, cfg.marginLeft, y)
  return y
}

function renderParties(
  inv: ParsedInvoice,
  doc: jsPDF,
  cfg: TemplateConfig,
  lbl: Labels,
  y: number
): number {
  y = ensureSpace(doc, y, 20)

  const midX = (cfg.marginLeft + cfg.marginRight) / 2

  // Nagłówki kolumn
  doc.setFontSize(cfg.fontSizeSmall)
  doc.setTextColor(cfg.colorMuted)
  doc.setFont('helvetica', 'bold')
  doc.text(lbl.seller, cfg.marginLeft, y)
  doc.text(lbl.buyer, midX + 2, y)
  doc.setFont('helvetica', 'normal')
  y += cfg.fontSizeSmall * 0.5

  const renderParty = (party: typeof inv.seller, x: number, maxWidth: number): number => {
    let py = y

    // Nazwa
    doc.setFontSize(cfg.fontSizeBody)
    doc.setTextColor(cfg.colorText)
    const nameLines = doc.splitTextToSize(sd(party.name), maxWidth)
    doc.text(nameLines, x, py)
    py += (nameLines as string[]).length * cfg.fontSizeBody * 0.38

    // NIP + Adres
    doc.setFontSize(cfg.fontSizeSmall)
    doc.setTextColor(cfg.colorMuted)

    const nipLine = party.noNip
      ? lbl.noNip
      : party.nip ? `${lbl.nip}: ${party.nip}` : ''

    if (nipLine) {
      doc.text(nipLine, x, py)
      py += cfg.fontSizeSmall * 0.38
    }

    const addrLines = doc.splitTextToSize(sd(party.address), maxWidth)
    doc.text(addrLines, x, py)
    py += (addrLines as string[]).length * cfg.fontSizeSmall * 0.38

    // Dane kontaktowe
    if (party.contactEmail) py = label(doc, cfg, sd(party.contactEmail), x, py)
    if (party.contactPhone) py = label(doc, cfg, sd(party.contactPhone), x, py)

    return py
  }

  const halfWidth = (cfg.marginRight - cfg.marginLeft) / 2 - 4
  const yAfterSeller = renderParty(inv.seller, cfg.marginLeft, halfWidth)
  const yAfterBuyer  = renderParty(inv.buyer, midX + 2, halfWidth)

  return Math.max(yAfterSeller, yAfterBuyer) + 1
}

function renderThirdParties(
  inv: ParsedInvoice,
  doc: jsPDF,
  cfg: TemplateConfig,
  lbl: Labels,
  y: number
): number {
  for (const tp of inv.thirdParties!) {
    y = ensureSpace(doc, y, 8)
    y = label(doc, cfg,
      sd(`${lbl.thirdParty} (${tp.role}): ${tp.name}  ${lbl.nip}: ${tp.nip ?? lbl.noNip}  ${tp.address}`),
      cfg.marginLeft, y
    )
  }
  return y
}

function renderPeriod(
  inv: ParsedInvoice,
  doc: jsPDF,
  cfg: TemplateConfig,
  lbl: Labels,
  y: number
): number {
  y = ensureSpace(doc, y, 6)
  if (inv.periodFrom) {
    y = label(doc, cfg, `${lbl.period}: ${inv.periodFrom} – ${inv.periodTo ?? ''}`, cfg.marginLeft, y)
  }
  if (inv.issueDateTime) {
    y = label(doc, cfg, `${lbl.date}: ${inv.issueDateTime}`, cfg.marginLeft, y)
  }
  return y
}

function renderLineItems(
  inv: ParsedInvoice,
  doc: jsPDF,
  cfg: TemplateConfig,
  lbl: Labels,
  y: number
): number {
  const items = inv.lineItems!
  const ml = cfg.marginLeft
  const mr = cfg.marginRight
  const W  = mr - ml

  // Szerokość kolumny Netto (tylko w trybie 'full') — osobna zmienna unika problemów z TypeScript
  const netColW = cfg.lineItemColumns === 'full' ? 16 : 0

  const nameW = cfg.lineItemColumns === 'compact'
    ? W - 6 - 10 - 12 - 20 - 12 - 18
    : W - 6 - 10 - 12 - 20 - 12 - netColW - 18

  const COL = { lp: 6, name: nameW, unit: 10, qty: 12, price: 20, vat: 12, gross: 18 }

  // Nagłówek tabeli
  y = ensureSpace(doc, y, 6)
  doc.setFontSize(cfg.fontSizeMicro)
  doc.setTextColor(cfg.colorMuted)
  doc.setFont('helvetica', 'bold')

  let x = ml
  doc.text(lbl.lp,    x, y); x += COL.lp
  doc.text(lbl.name,  x, y); x += COL.name
  doc.text(lbl.unit,  x, y); x += COL.unit
  doc.text(lbl.qty,       x + COL.qty,   y, { align: 'right' }); x += COL.qty
  doc.text(lbl.unitPrice, x + COL.price, y, { align: 'right' }); x += COL.price
  doc.text(lbl.vatRate,   x + COL.vat,   y, { align: 'right' }); x += COL.vat
  if (cfg.lineItemColumns === 'full') {
    doc.text(lbl.net,   x + netColW, y, { align: 'right' }); x += netColW
  }
  doc.text(lbl.gross, x + COL.gross, y, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  y += cfg.fontSizeMicro * 0.4

  // Wiersze
  for (const item of items) {
    y = ensureSpace(doc, y, 5)
    doc.setFontSize(cfg.fontSizeBody)
    doc.setTextColor(cfg.colorText)

    x = ml
    const nameLines = doc.splitTextToSize(sd(item.name), COL.name - 1)
    const rowH = (nameLines as string[]).length * cfg.fontSizeBody * 0.38 + 0.5

    doc.text(String(item.no), x, y); x += COL.lp
    doc.text(nameLines,       x, y); x += COL.name

    const secondLine = y + cfg.fontSizeBody * 0.38

    // GTU + Procedura + PKWiU jako suffix pod nazwą
    const tags: string[] = []
    if (item.gtu)       tags.push(item.gtu)
    if (item.procedure) tags.push(item.procedure)
    if (item.pkwiu)     tags.push(`PKWiU: ${item.pkwiu}`)
    if (tags.length) {
      doc.setFontSize(cfg.fontSizeSmall)
      doc.setTextColor(cfg.colorMuted)
      doc.text(tags.join(' '), cfg.marginLeft + COL.lp, secondLine)
    }

    doc.setFontSize(cfg.fontSizeBody)
    doc.setTextColor(cfg.colorText)

    doc.text(sd(item.unit ?? ''),         x, y, { align: 'left' });            x += COL.unit
    doc.text(fmt(item.quantity),          x + COL.qty,   y, { align: 'right' }); x += COL.qty
    doc.text(fmt(item.unitPriceGross),    x + COL.price, y, { align: 'right' }); x += COL.price
    doc.text(fmtVatRate(item.vatRate),    x + COL.vat,   y, { align: 'right' }); x += COL.vat
    if (cfg.lineItemColumns === 'full') {
      doc.text(fmt(item.netAmount),       x + netColW,   y, { align: 'right' }); x += netColW
    }
    // Brutto per wiersz: FA(3) nie zawsze zawiera P_11B — pozostawione puste (TODO)
    doc.text('', x + COL.gross, y, { align: 'right' })

    y += rowH
  }

  return y
}

function renderOrder(
  inv: ParsedInvoice,
  doc: jsPDF,
  cfg: TemplateConfig,
  lbl: Labels,
  y: number
): number {
  const order = inv.order!
  y = ensureSpace(doc, y, 8)

  doc.setFontSize(cfg.fontSizeSmall)
  doc.setTextColor(cfg.colorMuted)
  doc.setFont('helvetica', 'bold')
  doc.text(sd(`${lbl.order}  (${lbl.orderTotal}: ${fmt(order.totalValue)} ${inv.currency})`), cfg.marginLeft, y)
  doc.setFont('helvetica', 'normal')
  y += cfg.fontSizeSmall * 0.45

  for (const line of order.lines) {
    y = ensureSpace(doc, y, 4)
    doc.setFontSize(cfg.fontSizeBody)
    doc.setTextColor(cfg.colorText)
    const row = sd(`${line.no}. ${line.name}  ${line.unit ?? ''} ${fmt(line.quantity)} x ${fmt(line.unitPrice)}  ${fmtVatRate(line.vatRate ?? '')}  netto: ${fmt(line.netAmount)}  VAT: ${fmt(line.vatAmount)}`)
    const lines = doc.splitTextToSize(row, cfg.marginRight - cfg.marginLeft)
    doc.text(lines, cfg.marginLeft, y)
    y += (lines as string[]).length * cfg.fontSizeBody * 0.38
  }
  return y
}

function renderVatSummary(
  inv: ParsedInvoice,
  doc: jsPDF,
  cfg: TemplateConfig,
  lbl: Labels,
  y: number
): number {
  y = ensureSpace(doc, y, 8)

  doc.setFontSize(cfg.fontSizeSmall)
  doc.setTextColor(cfg.colorMuted)
  doc.setFont('helvetica', 'bold')
  doc.text(lbl.vatSummary, cfg.marginLeft, y)
  doc.setFont('helvetica', 'normal')
  y += cfg.fontSizeSmall * 0.45

  for (const line of inv.vatSummary) {
    y = ensureSpace(doc, y, 4)
    doc.setFontSize(cfg.fontSizeBody)
    doc.setTextColor(cfg.colorText)
    const row = `${fmtVatRate(line.rate)}:  netto ${fmt(line.net)}  VAT ${fmt(line.vat)} ${inv.currency}`
    doc.text(row, cfg.marginRight - 5, y, { align: 'right' })
    y += cfg.fontSizeBody * 0.38
  }

  // Razem brutto
  y = ensureSpace(doc, y, 5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(cfg.fontSizeBody)
  doc.text(`${lbl.total}: ${fmt(inv.grossAmount)} ${inv.currency}`, cfg.marginRight - 5, y, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  return y + cfg.fontSizeBody * 0.45
}

function renderSettlement(
  inv: ParsedInvoice,
  doc: jsPDF,
  cfg: TemplateConfig,
  lbl: Labels,
  y: number
): number {
  const s = inv.settlement!
  y = ensureSpace(doc, y, 10)

  if (s.charges?.length) {
    y = label(doc, cfg, `${lbl.charges}:`, cfg.marginLeft, y)
    for (const c of s.charges) y = label(doc, cfg, sd(`  ${c.reason}: ${fmt(c.amount)}`), cfg.marginLeft, y)
    if (s.totalCharges) y = label(doc, cfg, `${lbl.totalCharges}: ${fmt(s.totalCharges)}`, cfg.marginLeft, y)
  }
  if (s.discounts?.length) {
    y = label(doc, cfg, `${lbl.discounts}:`, cfg.marginLeft, y)
    for (const d of s.discounts) y = label(doc, cfg, sd(`  ${d.reason}: ${fmt(d.amount)}`), cfg.marginLeft, y)
    if (s.totalDiscounts) y = label(doc, cfg, `${lbl.totalDiscounts}: ${fmt(s.totalDiscounts)}`, cfg.marginLeft, y)
  }
  if (s.amountDue)      y = label(doc, cfg, `${lbl.amountDue}: ${fmt(s.amountDue)} ${inv.currency}`, cfg.marginLeft, y)
  if (s.amountToSettle) y = label(doc, cfg, `${lbl.amountToSettle}: ${fmt(s.amountToSettle)} ${inv.currency}`, cfg.marginLeft, y)
  return y
}

function renderPayment(
  inv: ParsedInvoice,
  doc: jsPDF,
  cfg: TemplateConfig,
  lbl: Labels,
  y: number
): number {
  const p = inv.payment!
  y = ensureSpace(doc, y, 10)

  const parts: string[] = [`${lbl.payment}:`]
  if (p.paymentForm) parts.push(sd(`${lbl.paymentForm}: ${p.paymentForm}`))
  if (p.paid)        parts.push(`v ${p.paidDate ?? ''}`)  // '✓' nie jest w Latin-1

  y = label(doc, cfg, parts.join('  '), cfg.marginLeft, y)

  if (p.dueDates?.length) {
    const dates = p.dueDates.map((d) => `${d.date}${d.description ? ` (${sd(d.description)})` : ''}`).join(', ')
    y = label(doc, cfg, `${lbl.paymentDue}: ${dates}`, cfg.marginLeft, y)
  }

  if (p.bankAccounts?.length) {
    for (const acc of p.bankAccounts) {
      const line = `${lbl.bankAccount}: ${acc.number}${acc.bankName ? `  ${lbl.bankName}: ${sd(acc.bankName)}` : ''}`
      y = label(doc, cfg, line, cfg.marginLeft, y)
    }
  }

  if (p.factoringAccounts?.length) {
    for (const acc of p.factoringAccounts) {
      y = label(doc, cfg, `${lbl.factoringAccount}: ${acc.number}`, cfg.marginLeft, y)
    }
  }

  if (p.discount) {
    y = label(doc, cfg, sd(`${lbl.discount}: ${p.discount.conditions} / ${p.discount.amount}`), cfg.marginLeft, y)
  }

  if (p.partialPayments?.length) {
    for (const pp of p.partialPayments) {
      y = label(doc, cfg, `${lbl.partialPayment}: ${fmt(pp.amount)} ${inv.currency}  ${pp.date}`, cfg.marginLeft, y)
    }
  }

  return y
}

function renderTransport(
  inv: ParsedInvoice,
  doc: jsPDF,
  cfg: TemplateConfig,
  lbl: Labels,
  y: number
): number {
  const t = inv.transportConditions!
  y = ensureSpace(doc, y, 10)

  const parts: string[] = [`${lbl.transport}:`]
  if (t.transportType)  parts.push(sd(`${lbl.transportType}: ${t.transportType}`))
  if (t.departureDate)  parts.push(t.departureDate)
  if (t.arrivalDate)    parts.push(`-> ${t.arrivalDate}`)
  y = label(doc, cfg, parts.join('  '), cfg.marginLeft, y)

  const route: string[] = []
  if (t.shipFrom)    route.push(sd(`Z: ${t.shipFrom}`))
  if (t.shipThrough) route.push(sd(`Przez: ${t.shipThrough}`))
  if (t.shipTo)      route.push(sd(`Do: ${t.shipTo}`))
  if (route.length)  y = label(doc, cfg, route.join('  '), cfg.marginLeft, y)

  return y
}

function renderNotes(
  inv: ParsedInvoice,
  doc: jsPDF,
  cfg: TemplateConfig,
  lbl: Labels,
  y: number
): number {
  y = ensureSpace(doc, y, 6)
  doc.setFontSize(cfg.fontSizeSmall)
  doc.setTextColor(cfg.colorMuted)
  doc.setFont('helvetica', 'bold')
  doc.text(lbl.notes, cfg.marginLeft, y)
  doc.setFont('helvetica', 'normal')
  y += cfg.fontSizeSmall * 0.4

  for (const note of inv.additionalNotes!) {
    y = ensureSpace(doc, y, 4)
    y = label(doc, cfg, sd(`${note.key}: ${note.value}`), cfg.marginLeft, y)
  }
  return y
}

function renderFooter(
  inv: ParsedInvoice,
  doc: jsPDF,
  cfg: TemplateConfig,
  lbl: Labels,
  y: number
): number {
  y = ensureSpace(doc, y, 6)
  y = label(doc, cfg, sd(`${lbl.footer}: ${inv.footer}`), cfg.marginLeft, y)
  return y
}
