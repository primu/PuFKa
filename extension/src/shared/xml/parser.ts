import { XMLParser } from 'fast-xml-parser'
import type {
  ParsedInvoice, PaymentStatus, InvoiceType,
  Party, ThirdParty, LineItem, Order, OrderLine,
  VatSummaryLine, Settlement, Payment, DueDate, BankAccount,
  PartialPayment, Note, TransportConditions, Annotations,
} from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>

// ─── Stałe ────────────────────────────────────────────────────────

const PAYMENT_FORM_MAP: Record<string, string> = {
  '1': 'gotówka',
  '2': 'karta',
  '3': 'bon',
  '4': 'czek',
  '5': 'kredyt',
  '6': 'przelew',
  '7': 'mobilna',
}

// Pola które mogą wystąpić wielokrotnie — zawsze tablica
const ARRAY_TAGS = [
  'Podmiot3', 'FaWiersz', 'DodatkowyOpis',
  'Obciazenia', 'Odliczenia', 'ZaplataCzesciowa',
  'TerminPlatnosci', 'RachunekBankowy', 'RachunekBankowyFaktora',
  'ZamowienieWiersz',
]

// Pary P_13_* / P_14_* dla stawek VAT
const VAT_RATE_MAP: Array<{ suffix: string; rate: string; noVat?: boolean }> = [
  { suffix: '1', rate: '23' },
  { suffix: '2', rate: '8' },
  { suffix: '3', rate: '5' },
  { suffix: '4', rate: '0' },
  { suffix: '6', rate: 'zw' },
  { suffix: '7', rate: 'np', noVat: true },
  { suffix: '8', rate: 'oo', noVat: true },
]

// ─── Instancja parsera ────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,            // usuwa prefiksy przestrzeni nazw z tagów
  isArray: (tagName) => ARRAY_TAGS.includes(tagName),
})

// ─── Funkcje pomocnicze ───────────────────────────────────────────

/** Bezpieczna konwersja na string — NIP, nazwy */
const str = (v: unknown): string => (v == null ? '' : String(v))

/** Konwersja na number z fallbackiem 0 */
const num = (v: unknown): number =>
  v == null || v === '' ? 0 : Number(v)

/** Konwersja na number | undefined */
const opt = (v: unknown): number | undefined =>
  v != null && v !== '' ? Number(v) : undefined

/** Łączy AdresL1 + opcjonalne AdresL2 */
function parseAddress(adres: Rec | undefined): string {
  if (!adres) return ''
  const l1 = str(adres.AdresL1)
  const l2 = adres.AdresL2 ? str(adres.AdresL2) : ''
  return l2 ? `${l1}\n${l2}` : l1
}

// ─── Strony ───────────────────────────────────────────────────────

function parseParty(podmiot: Rec): Party {
  const dane: Rec = podmiot.DaneIdentyfikacyjne ?? {}
  const nip = dane.NIP != null ? str(dane.NIP) : undefined
  const noNip = dane.BrakID === 1 || dane.BrakID === '1'
  const corrAddress = podmiot.AdresKoresp
    ? parseAddress(podmiot.AdresKoresp)
    : undefined
  const contact: Rec | undefined = podmiot.DaneKontaktowe

  return {
    ...(nip ? { nip } : {}),
    ...(noNip ? { noNip: true } : {}),
    name: str(dane.Nazwa),
    address: parseAddress(podmiot.Adres),
    ...(corrAddress ? { correspondenceAddress: corrAddress } : {}),
    ...(contact?.Email ? { contactEmail: str(contact.Email) } : {}),
    ...(contact?.Telefon ? { contactPhone: str(contact.Telefon) } : {}),
  }
}

function parseThirdParties(podmiot3: Rec[]): ThirdParty[] {
  return podmiot3.map((p) => ({
    ...parseParty(p),
    role: str(p.Rola),
  }))
}

// ─── Pozycje ──────────────────────────────────────────────────────

function parseLineItems(rows: Rec[]): LineItem[] {
  return rows.map((r) => ({
    no: num(r.NrWierszaFa),
    name: str(r.P_7),
    ...(r.Indeks != null ? { index: str(r.Indeks) } : {}),
    ...(r.GTIN != null ? { gtin: str(r.GTIN) } : {}),
    ...(r.PKWiU != null ? { pkwiu: str(r.PKWiU) } : {}),
    ...(r.CN != null ? { cn: str(r.CN) } : {}),
    ...(r.PKOB != null ? { pkob: str(r.PKOB) } : {}),
    ...(r.P_8A != null ? { unit: str(r.P_8A) } : {}),
    ...(r.P_8B != null ? { quantity: opt(r.P_8B) } : {}),
    ...(r.P_9B != null ? { unitPriceGross: opt(r.P_9B) } : {}),
    ...(r.P_10 != null ? { unitDiscount: opt(r.P_10) } : {}),
    netAmount: opt(r.P_11A ?? r.P_11),  // P_11A (z rabatem) lub P_11 (bez)
    vatRate: str(r.P_12),
    ...(r.KwotaAkcyzy != null ? { exciseTax: opt(r.KwotaAkcyzy) } : {}),
    ...(r.GTU != null ? { gtu: str(r.GTU) } : {}),
    ...(r.Procedura != null ? { procedure: str(r.Procedura) } : {}),
  }))
}

function parseOrderLines(rows: Rec[]): OrderLine[] {
  return rows.map((r) => ({
    no: num(r.NrWierszaZam),
    name: str(r.P_7Z),
    ...(r.P_8AZ != null ? { unit: str(r.P_8AZ) } : {}),
    ...(r.P_8BZ != null ? { quantity: opt(r.P_8BZ) } : {}),
    ...(r.P_9AZ != null ? { unitPrice: opt(r.P_9AZ) } : {}),
    ...(r.P_11NettoZ != null ? { netAmount: opt(r.P_11NettoZ) } : {}),
    ...(r.P_11VatZ != null ? { vatAmount: opt(r.P_11VatZ) } : {}),
    ...(r.P_12Z != null ? { vatRate: str(r.P_12Z) } : {}),
  }))
}

// ─── Podsumowanie VAT ─────────────────────────────────────────────

function parseVatSummary(fa: Rec): VatSummaryLine[] {
  const result: VatSummaryLine[] = []
  for (const { suffix, rate, noVat } of VAT_RATE_MAP) {
    const net = fa[`P_13_${suffix}`]
    if (net == null) continue
    result.push({
      rate,
      net: num(net),
      vat: noVat ? 0 : num(fa[`P_14_${suffix}`]),
    })
  }
  return result
}

// ─── Rozliczenie ──────────────────────────────────────────────────

function parseSettlement(roz: Rec | undefined): Settlement | undefined {
  if (!roz) return undefined
  const result: Settlement = {}

  if ((roz.Obciazenia as Rec[] | undefined)?.length) {
    result.charges = (roz.Obciazenia as Rec[]).map((o) => ({
      amount: num(o.Kwota),
      reason: str(o.Powod),
    }))
    result.totalCharges = opt(roz.SumaObciazen)
  }
  if ((roz.Odliczenia as Rec[] | undefined)?.length) {
    result.discounts = (roz.Odliczenia as Rec[]).map((o) => ({
      amount: num(o.Kwota),
      reason: str(o.Powod),
    }))
    result.totalDiscounts = opt(roz.SumaOdliczen)
  }
  if (roz.DoZaplaty != null) result.amountDue = opt(roz.DoZaplaty)
  if (roz.DoRozliczenia != null) result.amountToSettle = opt(roz.DoRozliczenia)

  return Object.keys(result).length ? result : undefined
}

// ─── Płatność ─────────────────────────────────────────────────────

function parsePayment(p: Rec | undefined): Payment | undefined {
  if (!p) return undefined
  const result: Payment = {}

  if (p.Zaplacono === 1 || p.Zaplacono === '1') {
    result.paid = true
    if (p.DataZaplaty) result.paidDate = str(p.DataZaplaty)
  }

  if (p.FormaPlatnosci != null) {
    const key = str(p.FormaPlatnosci)
    result.paymentForm = PAYMENT_FORM_MAP[key] ?? key
  }

  if ((p.TerminPlatnosci as Rec[] | undefined)?.length) {
    result.dueDates = (p.TerminPlatnosci as Rec[]).map((t): DueDate => {
      const dd: DueDate = { date: str(t.Termin) }
      if (t.TerminOpis) {
        const to: Rec = t.TerminOpis
        const parts = [
          to.Ilosc ? str(to.Ilosc) : '',
          to.Jednostka ? str(to.Jednostka) : '',
          to.ZdarzeniePoczatkowe ? str(to.ZdarzeniePoczatkowe) : '',
        ].filter(Boolean)
        if (parts.length) dd.description = parts.join(' ')
      }
      return dd
    })
  }

  if ((p.RachunekBankowy as Rec[] | undefined)?.length) {
    result.bankAccounts = (p.RachunekBankowy as Rec[]).map((r): BankAccount => ({
      number: str(r.NrRB),
      ...(r.RachunekWlasnyBanku === 1 || r.RachunekWlasnyBanku === '1'
        ? { bankOwned: true }
        : {}),
      ...(r.NazwaBanku ? { bankName: str(r.NazwaBanku) } : {}),
    }))
  }

  if ((p.RachunekBankowyFaktora as Rec[] | undefined)?.length) {
    result.factoringAccounts = (p.RachunekBankowyFaktora as Rec[]).map(
      (r): BankAccount => ({
        number: str(r.NrRB),
        ...(r.RachunekWlasnyBanku === 1 || r.RachunekWlasnyBanku === '1'
          ? { bankOwned: true }
          : {}),
      }),
    )
  }

  if ((p.ZaplataCzesciowa as Rec[] | undefined)?.length) {
    result.partialPayments = (p.ZaplataCzesciowa as Rec[]).map(
      (z): PartialPayment => {
        const key = z.FormaPlatnosci != null ? str(z.FormaPlatnosci) : undefined
        return {
          amount: num(z.KwotaZaplatyCzesciowej),
          date: str(z.DataZaplatyCzesciowej),
          ...(key ? { paymentForm: PAYMENT_FORM_MAP[key] ?? key } : {}),
        }
      },
    )
  }

  if (p.Skonto) {
    result.discount = {
      conditions: str(p.Skonto.WarunkiSkonta),
      amount: str(p.Skonto.WysokoscSkonta),
    }
  }

  if (p.OpisPlatnosci) result.otherPaymentDesc = str(p.OpisPlatnosci)

  return Object.keys(result).length ? result : undefined
}

// ─── Transport ────────────────────────────────────────────────────

function parseTransport(
  warunki: Rec | undefined,
): TransportConditions | undefined {
  if (!warunki?.Transport) return undefined
  const t: Rec = warunki.Transport

  return {
    ...(warunki.NrPartiiTowaru != null
      ? { batchNumber: str(warunki.NrPartiiTowaru) }
      : {}),
    ...(warunki.KursUmowny != null
      ? { contractRate: opt(warunki.KursUmowny) }
      : {}),
    ...(warunki.WalutaUmowna
      ? { contractCurrency: str(warunki.WalutaUmowna) }
      : {}),
    ...(t.RodzajTransportu != null
      ? { transportType: str(t.RodzajTransportu) }
      : {}),
    ...(t.OpisLadunku ? { cargoDescription: str(t.OpisLadunku) } : {}),
    ...(t.DataGodzRozpTransportu
      ? { departureDate: str(t.DataGodzRozpTransportu) }
      : {}),
    ...(t.DataGodzZakTransportu
      ? { arrivalDate: str(t.DataGodzZakTransportu) }
      : {}),
    ...(t.WysylkaZ?.AdresL1 ? { shipFrom: str(t.WysylkaZ.AdresL1) } : {}),
    ...(t.WysylkaPrzez?.AdresL1
      ? { shipThrough: str(t.WysylkaPrzez.AdresL1) }
      : {}),
    ...(t.WysylkaDo?.AdresL1 ? { shipTo: str(t.WysylkaDo.AdresL1) } : {}),
  }
}

// ─── Adnotacje ────────────────────────────────────────────────────

function parseAnnotations(
  adnotacje: Rec | undefined,
  fa: Rec,
): Annotations | undefined {
  if (!adnotacje) return undefined
  const a: Annotations = {}

  if (num(adnotacje.P_16) === 1) a.cashMethod = true
  if (num(adnotacje.P_17) === 1) a.selfBilling = true
  if (num(adnotacje.P_18) === 1) a.reverseCharge = true
  if (num(adnotacje.P_18A) === 1) a.splitPayment = true
  if (num(adnotacje.NoweSrodkiTransportu?.P_22) === 1) a.newMeansOfTransport = true
  if (num(adnotacje.P_23) === 1) a.triangulation = true
  if (num(adnotacje.PMarzy?.P_PMarzy) === 1) a.marginProcedure = true
  if (fa.ZwrotAkcyzy === 1 || fa.ZwrotAkcyzy === '1') a.exciseTaxRefund = true

  const zwolnienie: Rec | undefined = adnotacje.Zwolnienie
  if (zwolnienie?.P_19A) a.vatExemption = str(zwolnienie.P_19A)

  return Object.keys(a).length ? a : undefined
}

// ─── Dodatkowy opis ───────────────────────────────────────────────

function parseNotes(dodOp: Rec[]): Note[] {
  return dodOp.map((d, idx) => ({
    no: d.NrWiersza != null ? num(d.NrWiersza) : idx + 1,
    key: str(d.Klucz),
    value: str(d.Wartosc),
  }))
}

// ─── Status płatności ─────────────────────────────────────────────

function extractPaymentStatusFromFa(fa: Rec): PaymentStatus {
  const p: Rec | undefined = fa.Platnosc
  if (!p) return 'unknown'
  // ZnacznikZaplatyCzesciowej=2 → status nieznany (częściowe płatności nieśledzone)
  if (num(p.ZnacznikZaplatyCzesciowej) === 2) return 'unknown'
  if (p.Zaplacono === 1 || p.Zaplacono === '1') return 'paid'
  return 'unpaid'
}

// ─── API publiczne ────────────────────────────────────────────────

/**
 * Parsuje pełny XML FA(3) → ParsedInvoice.
 * Obsługuje typy: VAT, ZAL, ROZ, KOR, KOR_ROZ, KOR_ZAL.
 */
export function parseInvoiceXml(
  xmlRaw: string,
  ksefNumer: string,
): ParsedInvoice {
  const root: Rec = xmlParser.parse(xmlRaw)
  const faktura: Rec = root.Faktura ?? root
  const naglowek: Rec = faktura.Naglowek ?? {}
  const fa: Rec = faktura.Fa ?? {}
  const podmiot1: Rec = faktura.Podmiot1 ?? {}
  const podmiot2: Rec = faktura.Podmiot2 ?? {}
  const podmiot3: Rec[] = faktura.Podmiot3 ?? []
  const stopka: Rec = faktura.Stopka ?? {}

  const rodzajFaktury = str(fa.RodzajFaktury) as InvoiceType

  const result: ParsedInvoice = {
    rodzajFaktury,
    ksefNumer,
    dataWytworzeniaFa: str(naglowek.DataWytworzeniaFa),
    ...(naglowek.SystemInfo ? { systemInfo: str(naglowek.SystemInfo) } : {}),
    invoiceNumber: str(fa.P_2),
    issueDate: str(fa.P_1),
    currency: str(fa.KodWaluty),
    grossAmount: num(fa.P_15),
    seller: parseParty(podmiot1),
    buyer: parseParty(podmiot2),
    ...(podmiot3.length ? { thirdParties: parseThirdParties(podmiot3) } : {}),
    vatSummary: parseVatSummary(fa),
    paymentStatus: extractPaymentStatusFromFa(fa),
  }

  // Pozycje (VAT, ROZ)
  if ((fa.FaWiersz as Rec[] | undefined)?.length) {
    result.lineItems = parseLineItems(fa.FaWiersz as Rec[])
  }

  // Zamówienie (ZAL)
  if (fa.Zamowienie) {
    const zam: Rec = fa.Zamowienie
    result.order = {
      totalValue: num(zam.WartoscZamowienia),
      lines: parseOrderLines((zam.ZamowienieWiersz as Rec[]) ?? []),
    } satisfies Order
  }

  // Rozliczenie
  const settlement = parseSettlement(fa.Rozliczenie)
  if (settlement) result.settlement = settlement

  // Płatność
  const payment = parsePayment(fa.Platnosc)
  if (payment) result.payment = payment

  // Daty — korekta i ROZ mają P_6 zamiast okresu
  if (fa.P_6 != null) result.issueDateTime = str(fa.P_6)
  if (fa.OkresFa) {
    result.periodFrom = str(fa.OkresFa.P_6_Od)
    result.periodTo = str(fa.OkresFa.P_6_Do)
  }

  // Flagi (WZ, TP)
  if (fa.WZ === 1 || fa.WZ === '1') result.hasWZ = true
  if (fa.TP === 1 || fa.TP === '1') result.linkedTransaction = true

  // Faktura korygowana (KOR/KOR_ROZ/KOR_ZAL)
  if (fa.PrzyczynaKorekty) {
    result.correctionReason = str(fa.PrzyczynaKorekty)
  }
  if (fa.DaneFaKorygowanej) {
    const dfk: Rec = fa.DaneFaKorygowanej
    result.correctedInvoice = {
      date: str(dfk.DataWystFaKorygowanej),
      number: str(dfk.NrFaKorygowanej),
      ksefNumer: str(dfk.NrKSeFFaKorygowanej),
    }
  }

  // Faktura zaliczkowa — link do ZAL (ROZ)
  if (fa.FakturaZaliczkowa?.NrKSeFFaZaliczkowej) {
    result.advanceInvoiceKsefNumer = str(
      fa.FakturaZaliczkowa.NrKSeFFaZaliczkowej,
    )
  }

  // Dodatkowy opis
  if ((fa.DodatkowyOpis as Rec[] | undefined)?.length) {
    result.additionalNotes = parseNotes(fa.DodatkowyOpis as Rec[])
  }

  // Stopka
  const stopkaText = stopka.Informacje?.StopkaFaktury
  if (stopkaText != null) result.footer = str(stopkaText)

  // Transport
  const transport = parseTransport(fa.WarunkiTransakcji)
  if (transport) result.transportConditions = transport

  // Adnotacje
  const annotations = parseAnnotations(fa.Adnotacje, fa)
  if (annotations) result.annotations = annotations

  return result
}

/** Szybka ekstrakcja statusu płatności bez pełnego parsowania. */
export function extractPaymentStatus(xmlRaw: string): PaymentStatus {
  const root: Rec = xmlParser.parse(xmlRaw)
  const faktura: Rec = root.Faktura ?? root
  return extractPaymentStatusFromFa(faktura.Fa ?? {})
}

/** Zwraca NIP sprzedawcy (Podmiot1) lub null. */
export function extractSellerNip(xmlRaw: string): string | null {
  const root: Rec = xmlParser.parse(xmlRaw)
  const faktura: Rec = root.Faktura ?? root
  const nip = faktura.Podmiot1?.DaneIdentyfikacyjne?.NIP
  return nip != null ? str(nip) : null
}

/** Zwraca nazwy pozycji — FaWiersz.P_7 lub ZamowienieWiersz.P_7Z. */
export function extractLineItemNames(xmlRaw: string): string[] {
  const root: Rec = xmlParser.parse(xmlRaw)
  const faktura: Rec = root.Faktura ?? root
  const fa: Rec = faktura.Fa ?? {}
  const names: string[] = []

  if ((fa.FaWiersz as Rec[] | undefined)?.length) {
    for (const w of fa.FaWiersz as Rec[]) {
      if (w.P_7 != null) names.push(str(w.P_7))
    }
  }

  if ((fa.Zamowienie?.ZamowienieWiersz as Rec[] | undefined)?.length) {
    for (const w of fa.Zamowienie.ZamowienieWiersz as Rec[]) {
      if (w.P_7Z != null) names.push(str(w.P_7Z))
    }
  }

  return names
}
