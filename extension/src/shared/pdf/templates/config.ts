export interface TemplateConfig {
  // Typografia
  fontSizeTitle:  number
  fontSizeBody:   number
  fontSizeSmall:  number
  fontSizeMicro:  number

  // Kolory
  colorTitle:  string
  colorText:   string
  colorMuted:  string
  colorAccent: string

  // Marginesy (mm)
  marginLeft:  number
  marginRight: number   // x końca strony (A4 = 210mm)
  marginTop:   number

  // Język etykiet
  language: 'pl' | 'en'

  // Pola KSeF
  showKsefNumber:  boolean
  showKsefDate:    boolean
  showFormVariant: boolean

  // Układ
  lineItemColumns:   'full' | 'compact'
  sellerBuyerLayout: 'block' | 'inline'
  showBillingPeriod: boolean
}

export const TEMPLATES: Record<string, TemplateConfig> = {
  'standard-pl': {
    fontSizeTitle: 12, fontSizeBody: 8, fontSizeSmall: 6.5, fontSizeMicro: 6,
    colorTitle: '#000000', colorText: '#000000', colorMuted: '#555555', colorAccent: '#000000',
    marginLeft: 12, marginRight: 198, marginTop: 12,
    language: 'pl',
    showKsefNumber: true, showKsefDate: true, showFormVariant: true,
    lineItemColumns: 'compact', sellerBuyerLayout: 'inline',
    showBillingPeriod: false,
  },
  'standard-en': {
    fontSizeTitle: 12, fontSizeBody: 8, fontSizeSmall: 6.5, fontSizeMicro: 6,
    colorTitle: '#000000', colorText: '#000000', colorMuted: '#555555', colorAccent: '#000000',
    marginLeft: 12, marginRight: 198, marginTop: 12,
    language: 'en',
    showKsefNumber: true, showKsefDate: true, showFormVariant: true,
    lineItemColumns: 'compact', sellerBuyerLayout: 'inline',
    showBillingPeriod: false,
  },
  'simplified': {
    fontSizeTitle: 11, fontSizeBody: 7.5, fontSizeSmall: 6, fontSizeMicro: 5.5,
    colorTitle: '#000000', colorText: '#000000', colorMuted: '#666666', colorAccent: '#000000',
    marginLeft: 10, marginRight: 200, marginTop: 10,
    language: 'pl',
    showKsefNumber: true, showKsefDate: false, showFormVariant: false,
    lineItemColumns: 'compact', sellerBuyerLayout: 'inline',
    showBillingPeriod: false,
  },
  'utilities': {
    fontSizeTitle: 12, fontSizeBody: 8, fontSizeSmall: 6.5, fontSizeMicro: 6,
    colorTitle: '#000000', colorText: '#000000', colorMuted: '#555555', colorAccent: '#000000',
    marginLeft: 12, marginRight: 198, marginTop: 12,
    language: 'pl',
    showKsefNumber: true, showKsefDate: true, showFormVariant: true,
    lineItemColumns: 'compact', sellerBuyerLayout: 'inline',
    showBillingPeriod: true,
  },
}

export const LABELS = {
  pl: {
    invoice:          'FAKTURA VAT',
    advance:          'FAKTURA ZALICZKOWA',
    settlement:       'FAKTURA ROZLICZENIOWA',
    correction:       'FAKTURA KORYGUJACA',
    correctionSettl:  'FAKTURA KORYGUJACA (rozliczenie)',
    correctionAdv:    'FAKTURA KORYGUJACA (zaliczkowa)',
    seller:           'SPRZEDAWCA',
    buyer:            'NABYWCA',
    nip:              'NIP',
    noNip:            'BRAK NIP',
    address:          'Adres',
    correctionOf:     'Korekta do',
    correctionKsef:   'KSeF korygowanej',
    correctionReason: 'Przyczyna korekty',
    advanceKsef:      'Rozliczenie zaliczki KSeF',
    period:           'Okres',
    date:             'Data',
    order:            'ZAMOWIENIE',
    orderTotal:       'Wartosc zamowienia',
    lp:               'Lp',
    name:             'Nazwa',
    unit:             'J.m.',
    qty:              'Ilosc',
    unitPrice:        'Cena netto',
    vatRate:          'VAT%',
    net:              'Netto',
    gross:            'Brutto',
    vatSummary:       'Podsumowanie VAT',
    total:            'RAZEM BRUTTO',
    charges:          'Obciazenia',
    discounts:        'Odliczenia',
    totalCharges:     'Suma obciazen',
    totalDiscounts:   'Suma odliczen',
    amountDue:        'Do zaplaty',
    amountToSettle:   'Do rozliczenia',
    payment:          'Platnosc',
    paymentForm:      'Forma',
    paymentDue:       'Termin',
    bankAccount:      'Konto',
    bankName:         'Bank',
    factoringAccount: 'Konto faktora',
    discount:         'Skonto',
    paidDate:         'Data zaplaty',
    partialPayment:   'Zaplata czesciowa',
    transport:        'Transport',
    transportType:    'Rodzaj',
    notes:            'Informacje dodatkowe',
    footer:           'Stopka',
    ksefNumber:       'KSeF',
    receivedAt:       'przyjeto',
    thirdParty:       'Strona trzecia',
    billingPeriod:    'Okres rozliczeniowy',
  },
  en: {
    invoice:          'VAT INVOICE',
    advance:          'ADVANCE INVOICE',
    settlement:       'SETTLEMENT INVOICE',
    correction:       'CORRECTIVE INVOICE',
    correctionSettl:  'CORRECTIVE INVOICE (settlement)',
    correctionAdv:    'CORRECTIVE INVOICE (advance)',
    seller:           'SELLER',
    buyer:            'BUYER',
    nip:              'VAT No.',
    noNip:            'NO VAT No.',
    address:          'Address',
    correctionOf:     'Correction of',
    correctionKsef:   'KSeF of corrected',
    correctionReason: 'Reason for correction',
    advanceKsef:      'Advance invoice KSeF',
    period:           'Period',
    date:             'Date',
    order:            'ORDER',
    orderTotal:       'Order value',
    lp:               'No.',
    name:             'Description',
    unit:             'Unit',
    qty:              'Qty',
    unitPrice:        'Unit price',
    vatRate:          'VAT%',
    net:              'Net',
    gross:            'Gross',
    vatSummary:       'VAT Summary',
    total:            'TOTAL GROSS',
    charges:          'Charges',
    discounts:        'Discounts',
    totalCharges:     'Total charges',
    totalDiscounts:   'Total discounts',
    amountDue:        'Amount due',
    amountToSettle:   'Amount to settle',
    payment:          'Payment',
    paymentForm:      'Method',
    paymentDue:       'Due date',
    bankAccount:      'Account',
    bankName:         'Bank',
    factoringAccount: 'Factoring account',
    discount:         'Discount',
    paidDate:         'Paid date',
    partialPayment:   'Partial payment',
    transport:        'Transport',
    transportType:    'Type',
    notes:            'Additional information',
    footer:           'Footer',
    ksefNumber:       'KSeF',
    receivedAt:       'received',
    thirdParty:       'Third party',
    billingPeriod:    'Billing period',
  },
} as const

export type Labels = { [K in keyof typeof LABELS['pl']]: string }
