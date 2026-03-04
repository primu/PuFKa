// ─── Typy domenowe ───────────────────────────────────────────────

export type PaymentStatus = 'paid' | 'unpaid' | 'unknown'
export type Category = 'costs' | 'goods' | null
export type InvoiceType =
  | 'VAT'       // faktura pełna
  | 'ZAL'       // zaliczkowa
  | 'ROZ'       // rozliczeniowa
  | 'KOR'       // korygująca
  | 'KOR_ROZ'   // korygująca rozliczenia
  | 'KOR_ZAL'   // korygująca zaliczkową

// ─── Faktura (rekord w DB) ────────────────────────────────────────

export interface Invoice {
  // klucz główny
  ksefNumer: string

  // podstawowe dane (z listy KSeF — dostępne bez XML)
  invoiceNumber: string
  issueDate: string           // YYYY-MM-DD
  grossAmount: number
  currency: string
  sellerNip: string
  sellerName: string

  // pełny XML — zachowany do przyszłego użytku
  xmlRaw: string

  // status płatności (z XML)
  paymentStatus: PaymentStatus
  paymentStatusOverride: boolean  // true = ustawiony ręcznie przez użytkownika

  // znaczniki pobrania (osobno dla XML i PDF)
  downloadedXml: boolean
  downloadedPdf: boolean

  // klasyfikacja
  category: Category
  categoryAutoApplied: boolean    // true = ustawiona przez regułę NIP/słowo kluczowe

  // metadane
  fetchedAt: number               // timestamp ms
  invoiceType: InvoiceType
}

// ─── Reguła NIP ──────────────────────────────────────────────────

export interface NipRule {
  nip: string                     // klucz główny
  category: 'costs' | 'goods'
  sellerName: string              // zapamiętana dla czytelności w UI
  updatedAt: number
}

// ─── Ustawienia ──────────────────────────────────────────────────

export interface Settings {
  key: string                     // klucz główny
  value: unknown
}

// Klucze ustawień:
// 'account'         → { email: string, token: string } | null
// 'defaultTemplate' → 'standard-pl' | 'standard-en' | 'simplified' | 'utilities'
// 'keywordRules'    → KeywordRules
// 'filterState'     → FilterState

export interface KeywordRules {
  costs: string[]
  goods: string[]
}

export const DEFAULT_KEYWORD_RULES: KeywordRules = {
  costs: ['prąd', 'energia', 'czynsz', 'najem', 'paliwo', 'telefon',
          'internet', 'ubezpieczenie', 'usługa', 'abonament', 'opłata'],
  goods: ['towar', 'produkt', 'materiał', 'część', 'sprzęt', 'artykuł'],
}

// ─── Sparsowana faktura (wynik parsera XML) ───────────────────────
// Używana wewnętrznie przez parser i generator PDF — nie zapisywana w DB

export interface ParsedInvoice {
  // Nagłówek
  rodzajFaktury: InvoiceType
  ksefNumer: string
  dataWytworzeniaFa: string
  systemInfo?: string

  // Podstawowe
  invoiceNumber: string           // Fa.P_2
  issueDate: string               // Fa.P_1
  issueDateTime?: string          // Fa.P_6 (pojedyncza data — KOR, ROZ)
  periodFrom?: string             // Fa.OkresFa.P_6_Od
  periodTo?: string               // Fa.OkresFa.P_6_Do
  currency: string
  grossAmount: number             // Fa.P_15

  // Strony
  seller: Party
  buyer: Party
  thirdParties?: ThirdParty[]

  // Pozycje
  lineItems?: LineItem[]          // FaWiersz (VAT, ROZ)
  order?: Order                   // Zamowienie (ZAL)

  // Podsumowanie VAT
  vatSummary: VatSummaryLine[]

  // Rozliczenie
  settlement?: Settlement

  // Płatność
  payment?: Payment

  // Korekta
  correctionReason?: string
  correctedInvoice?: CorrectedInvoice

  // Rozliczeniowa
  advanceInvoiceKsefNumer?: string

  // Dodatkowe
  additionalNotes?: Note[]
  footer?: string
  transportConditions?: TransportConditions
  hasWZ?: boolean                 // WZ: 1
  linkedTransaction?: boolean     // TP: 1
  annotations?: Annotations

  // Status płatności (obliczony przez parser)
  paymentStatus: PaymentStatus
}

export interface Party {
  nip?: string
  noNip?: boolean
  name: string
  address: string
  correspondenceAddress?: string
  contactEmail?: string
  contactPhone?: string
}

export interface ThirdParty extends Party {
  role: string                    // Rola
}

export interface LineItem {
  no: number
  name: string                    // P_7
  index?: string                  // Indeks
  gtin?: string
  pkwiu?: string
  cn?: string
  pkob?: string
  unit?: string                   // P_8A
  quantity?: number               // P_8B
  unitPriceGross?: number         // P_9B
  unitDiscount?: number           // P_10
  netAmount?: number              // P_11A lub P_11
  vatRate: string                 // P_12 (np. "23", "8", "zw", "np")
  exciseTax?: number              // KwotaAkcyzy
  gtu?: string                    // GTU_01..GTU_13
  procedure?: string              // np. WSTO_EE
}

export interface Order {
  totalValue: number
  lines: OrderLine[]
}

export interface OrderLine {
  no: number
  name: string                    // P_7Z
  unit?: string                   // P_8AZ
  quantity?: number               // P_8BZ
  unitPrice?: number              // P_9AZ
  netAmount?: number              // P_11NettoZ
  vatAmount?: number              // P_11VatZ
  vatRate?: string                // P_12Z
}

export interface VatSummaryLine {
  rate: string                    // "23", "8", "5", "0", "zw", "np"
  net: number
  vat: number
}

export interface Settlement {
  charges?: { amount: number; reason: string }[]
  totalCharges?: number
  discounts?: { amount: number; reason: string }[]
  totalDiscounts?: number
  amountDue?: number
  amountToSettle?: number         // DoRozliczenia (KOR_ROZ)
}

export interface Payment {
  paid?: boolean                  // Zaplacono = 1
  paidDate?: string
  paymentForm?: string
  dueDates?: DueDate[]
  bankAccounts?: BankAccount[]
  factoringAccounts?: BankAccount[]
  partialPayments?: PartialPayment[]
  discount?: { conditions: string; amount: string }
  otherPaymentDesc?: string
}

export interface DueDate {
  date: string
  description?: string            // TerminOpis (ilość, jednostka, zdarzenie)
}

export interface BankAccount {
  number: string
  bankOwned?: boolean             // RachunekWlasnyBanku
  bankName?: string               // NazwaBanku
}

export interface PartialPayment {
  amount: number
  date: string
  paymentForm?: string
}

export interface CorrectedInvoice {
  date: string
  number: string
  ksefNumer: string
}

export interface Note {
  no: number
  key: string
  value: string
}

export interface TransportConditions {
  batchNumber?: string
  contractRate?: number
  contractCurrency?: string
  transportType?: string
  cargoDescription?: string
  departureDate?: string
  arrivalDate?: string
  shipFrom?: string
  shipThrough?: string
  shipTo?: string
}

export interface Annotations {
  cashMethod?: boolean            // P_16 = 1
  selfBilling?: boolean          // P_17 = 1 (samofakturowanie)
  reverseCharge?: boolean        // P_18 = 1
  splitPayment?: boolean         // P_18A = 1
  newMeansOfTransport?: boolean  // P_22 = 1
  triangulation?: boolean        // P_23 = 1
  marginProcedure?: boolean      // P_PMarzy = 1
  exciseTaxRefund?: boolean      // ZwrotAkcyzy
  vatExemption?: string          // P_19A (podstawa zwolnienia)
}

// ─── Dane badge'a (używane przez content script i service worker) ─

export interface BadgeData {
  paymentStatus: PaymentStatus | null
  category: Category
  downloadedXml: boolean
  downloadedPdf: boolean
}

// ─── Filtrowanie ──────────────────────────────────────────────────

export interface FilterState {
  category: Category | 'uncategorized' | null   // null = wszystkie
  paymentStatus: PaymentStatus | null            // null = wszystkie
}

// ─── Wiadomości między content script a service worker ───────────

export type MessageType =
  | 'CHECK_CACHE'
  | 'GET_INVOICE'
  | 'GET_INVOICES'
  | 'XML_FETCHED'
  | 'SET_CATEGORY'
  | 'SET_STATUS'
  | 'SET_FILTER'
  | 'GENERATE_PDF'
  | 'GENERATE_ZIP'
  | 'SEND_EMAIL'
  | 'MARK_XML_DOWNLOADED'
  | 'MARK_PDF_DOWNLOADED'
  | 'PROGRESS'
  | 'INVOICE_UPDATED'

export interface Message<T = unknown> {
  type: MessageType
  payload: T
}

export interface ProgressMessage {
  operation: 'BULK_FETCH' | 'GENERATE_ZIP' | 'GENERATE_PDF' | 'SEND_EMAIL'
  current: number
  total: number
  label?: string
}
