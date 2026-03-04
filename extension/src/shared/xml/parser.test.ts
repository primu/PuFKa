import { describe, it, expect } from 'vitest'
import {
  parseInvoiceXml,
  extractPaymentStatus,
  extractSellerNip,
  extractLineItemNames,
} from './parser'

// ─── Fixtures ───────────────────────────────────────────────────────────────

/** Faktyczna faktura z KSeF — VAT z pozycjami, stopką, adnotacjami */
const XML_BANK = `<Faktura xmlns:etd="http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">
<Naglowek>
<KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>
<WariantFormularza>3</WariantFormularza>
<DataWytworzeniaFa>2026-02-01T05:07:10.805902-06:00</DataWytworzeniaFa>
</Naglowek>
<Podmiot1>
<DaneIdentyfikacyjne>
<NIP>2090000825</NIP>
<Nazwa>U.S. BANK EUROPE DAC</Nazwa>
</DaneIdentyfikacyjne>
<Adres><KodKraju>PL</KodKraju><AdresL1>UL PULAWSKA 17 02-515 WARSZAWA</AdresL1></Adres>
</Podmiot1>
<Podmiot2>
<DaneIdentyfikacyjne>
<NIP>7773130990</NIP>
<Nazwa>Firma Handlowa Kram</Nazwa>
</DaneIdentyfikacyjne>
<Adres><KodKraju>PL</KodKraju><AdresL1>POZNANSKA 21 62-023 BOROWIEC</AdresL1></Adres>
</Podmiot2>
<Fa>
<KodWaluty>PLN</KodWaluty>
<P_1>2026-02-01</P_1>
<P_2>2026014610032027</P_2>
<OkresFa><P_6_Od>2026-01-01</P_6_Od><P_6_Do>2026-01-31</P_6_Do></OkresFa>
<P_13_1>27.00</P_13_1>
<P_14_1>6.21</P_14_1>
<P_13_7>35.00</P_13_7>
<P_15>68.21</P_15>
<Adnotacje>
<Zwolnienie><P_19A>art. 43 ust.</P_19A></Zwolnienie>
</Adnotacje>
<RodzajFaktury>VAT</RodzajFaktury>
<DodatkowyOpis><Klucz>Warunki platnosci</Klucz><Wartosc>14 dni</Wartosc></DodatkowyOpis>
<DodatkowyOpis><Klucz>Warunki platnosci c.d.</Klucz><Wartosc>od wystawienia.</Wartosc></DodatkowyOpis>
<FaWiersz>
<NrWierszaFa>1</NrWierszaFa>
<P_7>INGENICO TETRA MOVE 5000</P_7>
<P_8A>szt.</P_8A><P_8B>1</P_8B><P_9A>19.00</P_9A><P_11>19.00</P_11><P_12>23</P_12>
</FaWiersz>
<FaWiersz>
<NrWierszaFa>2</NrWierszaFa>
<P_7>BEZPIECZENSTWO PCI</P_7>
<P_8A>szt.</P_8A><P_8B>1</P_8B><P_9A>8.00</P_9A><P_11>8.00</P_11><P_12>23</P_12>
</FaWiersz>
<FaWiersz>
<NrWierszaFa>3</NrWierszaFa>
<P_7>Prowizja za uslugi</P_7>
<P_8A>rata</P_8A><P_8B>1</P_8B><P_9A>35.00</P_9A><P_11>35.00</P_11><P_12>zw</P_12>
</FaWiersz>
</Fa>
<Stopka><Informacje><StopkaFaktury>Stopka testowa</StopkaFaktury></Informacje></Stopka>
</Faktura>`

/** Faktura P4 — z płatnością, rozliczeniem, polskimi znakami */
const XML_P4 = `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaFa>2026-02-03T00:38:49Z</DataWytworzeniaFa>
    <SystemInfo>Kenan CCBS</SystemInfo>
  </Naglowek>
  <Podmiot1>
    <DaneIdentyfikacyjne>
      <NIP>9512120077</NIP>
      <Nazwa>P4 sp. z o. o.</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres><KodKraju>PL</KodKraju><AdresL1>Wynalazek 1</AdresL1><AdresL2>02-667 Warszawa</AdresL2></Adres>
  </Podmiot1>
  <Podmiot2>
    <DaneIdentyfikacyjne>
      <NIP>7773130990</NIP>
      <Nazwa>FIRMA HANDLOWA KRAM PRZEMYSŁAW STROIWĄS</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres><KodKraju>PL</KodKraju><AdresL1>UL. POZNAŃSKA 21</AdresL1><AdresL2>62-023 BORÓWIEC</AdresL2></Adres>
  </Podmiot2>
  <Fa>
    <KodWaluty>PLN</KodWaluty>
    <P_1>2026-02-03</P_1>
    <P_2>F/10033393/02/26</P_2>
    <OkresFa><P_6_Od>2026-01-01</P_6_Od><P_6_Do>2026-02-28</P_6_Do></OkresFa>
    <P_13_1>303.59</P_13_1>
    <P_14_1>69.83</P_14_1>
    <P_13_2>106.48</P_13_2>
    <P_14_2>8.52</P_14_2>
    <P_15>488.42</P_15>
    <RodzajFaktury>VAT</RodzajFaktury>
    <FaWiersz>
      <NrWierszaFa>1</NrWierszaFa>
      <P_7>Usługi telekomunikacyjne – TV</P_7>
      <P_8A>szt.</P_8A><P_8B>1</P_8B><P_9A>106.48</P_9A><P_11>106.48</P_11><P_12>8</P_12>
    </FaWiersz>
    <FaWiersz>
      <NrWierszaFa>2</NrWierszaFa>
      <P_7>Usługi inne</P_7>
      <P_8A>szt.</P_8A><P_8B>1</P_8B><P_9A>10.00</P_9A><P_11>10.00</P_11><P_12>23</P_12>
    </FaWiersz>
    <Rozliczenie><DoZaplaty>488.42</DoZaplaty></Rozliczenie>
    <Platnosc>
      <TerminPlatnosci><Termin>2026-02-17</Termin></TerminPlatnosci>
      <FormaPlatnosci>6</FormaPlatnosci>
      <RachunekBankowy><NrRB>06109000047777010081033363</NrRB></RachunekBankowy>
    </Platnosc>
  </Fa>
  <Stopka>
    <Informacje><StopkaFaktury>Kapitał zakładowy 48 856 500,00 ZŁ</StopkaFaktury></Informacje>
  </Stopka>
</Faktura>`

const XML_PAID = `<Faktura xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">
<Naglowek><DataWytworzeniaFa>2026-01-01T00:00:00Z</DataWytworzeniaFa></Naglowek>
<Podmiot1><DaneIdentyfikacyjne><NIP>1234567890</NIP><Nazwa>Sprzedawca</Nazwa></DaneIdentyfikacyjne><Adres><AdresL1>ul. Test 1</AdresL1></Adres></Podmiot1>
<Podmiot2><DaneIdentyfikacyjne><NIP>0987654321</NIP><Nazwa>Kupujacy</Nazwa></DaneIdentyfikacyjne><Adres><AdresL1>ul. Test 2</AdresL1></Adres></Podmiot2>
<Fa>
<KodWaluty>PLN</KodWaluty><P_1>2026-01-01</P_1><P_2>FV/001/2026</P_2><P_13_1>100.00</P_13_1><P_14_1>23.00</P_14_1><P_15>123.00</P_15>
<RodzajFaktury>VAT</RodzajFaktury>
<Platnosc><Zaplacono>1</Zaplacono><DataZaplaty>2026-01-10</DataZaplaty><FormaPlatnosci>6</FormaPlatnosci></Platnosc>
</Fa>
</Faktura>`

const XML_NO_PAYMENT = `<Faktura xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">
<Naglowek><DataWytworzeniaFa>2026-01-01T00:00:00Z</DataWytworzeniaFa></Naglowek>
<Podmiot1><DaneIdentyfikacyjne><NIP>1111111111</NIP><Nazwa>S</Nazwa></DaneIdentyfikacyjne><Adres><AdresL1>a</AdresL1></Adres></Podmiot1>
<Podmiot2><DaneIdentyfikacyjne><NIP>2222222222</NIP><Nazwa>B</Nazwa></DaneIdentyfikacyjne><Adres><AdresL1>b</AdresL1></Adres></Podmiot2>
<Fa><KodWaluty>PLN</KodWaluty><P_1>2026-01-01</P_1><P_2>FV/002/2026</P_2><P_13_1>200.00</P_13_1><P_14_1>46.00</P_14_1><P_15>246.00</P_15><RodzajFaktury>VAT</RodzajFaktury></Fa>
</Faktura>`

// ─── Testy parseInvoiceXml ────────────────────────────────────────────────────

describe('parseInvoiceXml', () => {
  describe('pola nagłówkowe (XML_BANK)', () => {
    const inv = parseInvoiceXml(XML_BANK, 'KSEF-001')

    it('zwraca ksefNumer', () => {
      expect(inv.ksefNumer).toBe('KSEF-001')
    })

    it('parsuje numer faktury', () => {
      expect(inv.invoiceNumber).toBe('2026014610032027')
    })

    it('parsuje datę wystawienia', () => {
      expect(inv.issueDate).toBe('2026-02-01')
    })

    it('parsuje walutę', () => {
      expect(inv.currency).toBe('PLN')
    })

    it('parsuje kwotę brutto', () => {
      expect(inv.grossAmount).toBe(68.21)
    })

    it('parsuje rodzaj faktury', () => {
      expect(inv.rodzajFaktury).toBe('VAT')
    })

    it('parsuje okres fakturowania', () => {
      expect(inv.periodFrom).toBe('2026-01-01')
      expect(inv.periodTo).toBe('2026-01-31')
    })

    it('parsuje stopkę', () => {
      expect(inv.footer).toBe('Stopka testowa')
    })

    it('parsuje DataWytworzeniaFa', () => {
      expect(inv.dataWytworzeniaFa).toBe('2026-02-01T05:07:10.805902-06:00')
    })
  })

  describe('sprzedawca (Podmiot1)', () => {
    const inv = parseInvoiceXml(XML_BANK, 'TEST-001')

    it('parsuje NIP sprzedawcy', () => {
      expect(inv.seller.nip).toBe('2090000825')
    })

    it('parsuje nazwę sprzedawcy', () => {
      expect(inv.seller.name).toBe('U.S. BANK EUROPE DAC')
    })

    it('parsuje adres sprzedawcy', () => {
      expect(inv.seller.address).toContain('PULAWSKA')
    })
  })

  describe('nabywca (Podmiot2)', () => {
    const inv = parseInvoiceXml(XML_BANK, 'TEST-001')

    it('parsuje NIP nabywcy', () => {
      expect(inv.buyer.nip).toBe('7773130990')
    })

    it('parsuje nazwę nabywcy', () => {
      expect(inv.buyer.name).toBe('Firma Handlowa Kram')
    })
  })

  describe('pozycje faktury (FaWiersz)', () => {
    const inv = parseInvoiceXml(XML_BANK, 'TEST-001')

    it('parsuje liczbę pozycji', () => {
      expect(inv.lineItems).toHaveLength(3)
    })

    it('parsuje nr wiersza', () => {
      expect(inv.lineItems![0].no).toBe(1)
      expect(inv.lineItems![2].no).toBe(3)
    })

    it('parsuje nazwę pozycji', () => {
      expect(inv.lineItems![0].name).toBe('INGENICO TETRA MOVE 5000')
      expect(inv.lineItems![2].name).toBe('Prowizja za uslugi')
    })

    it('parsuje jednostkę miary', () => {
      expect(inv.lineItems![0].unit).toBe('szt.')
      expect(inv.lineItems![2].unit).toBe('rata')
    })

    it('parsuje stawkę VAT', () => {
      expect(inv.lineItems![0].vatRate).toBe('23')
      expect(inv.lineItems![2].vatRate).toBe('zw')
    })

    it('parsuje ilość', () => {
      expect(inv.lineItems![0].quantity).toBe(1)
    })

    it('parsuje netto pozycji', () => {
      expect(inv.lineItems![0].netAmount).toBe(19)
      expect(inv.lineItems![1].netAmount).toBe(8)
    })
  })

  describe('podsumowanie VAT', () => {
    const inv = parseInvoiceXml(XML_BANK, 'TEST-001')

    it('parsuje dwie stawki VAT', () => {
      expect(inv.vatSummary).toHaveLength(2)
    })

    it('parsuje 23% netto i VAT', () => {
      const rate23 = inv.vatSummary.find((l) => l.rate === '23')
      expect(rate23).toBeDefined()
      expect(rate23!.net).toBe(27)
      expect(rate23!.vat).toBe(6.21)
    })

    it('parsuje stawkę np (P_13_7 = nie podlega, bez VAT)', () => {
      // XML_BANK zawiera P_13_7 → suffix 7 → rate 'np' (nie podlega)
      const rateNp = inv.vatSummary.find((l) => l.rate === 'np')
      expect(rateNp).toBeDefined()
      expect(rateNp!.net).toBe(35)
      expect(rateNp!.vat).toBe(0)
    })
  })

  describe('adnotacje', () => {
    const inv = parseInvoiceXml(XML_BANK, 'TEST-001')

    it('parsuje zwolnienie VAT', () => {
      expect(inv.annotations?.vatExemption).toBe('art. 43 ust.')
    })
  })

  describe('dodatkowy opis', () => {
    const inv = parseInvoiceXml(XML_BANK, 'TEST-001')

    it('parsuje dwa wiersze DodatkowyOpis', () => {
      expect(inv.additionalNotes).toHaveLength(2)
    })

    it('parsuje klucz i wartość', () => {
      expect(inv.additionalNotes![0].key).toBe('Warunki platnosci')
      expect(inv.additionalNotes![0].value).toBe('14 dni')
    })
  })

  describe('XML_P4 — płatność i rozliczenie', () => {
    const inv = parseInvoiceXml(XML_P4, 'P4-001')

    it('parsuje numer faktury P4', () => {
      expect(inv.invoiceNumber).toBe('F/10033393/02/26')
    })

    it('parsuje cztery pozycje', () => {
      expect(inv.lineItems).toHaveLength(2)
    })

    it('parsuje polskie znaki w nazwie pozycji', () => {
      expect(inv.lineItems![0].name).toBe('Usługi telekomunikacyjne – TV')
    })

    it('parsuje polskie znaki w nazwie nabywcy', () => {
      expect(inv.buyer.name).toBe('FIRMA HANDLOWA KRAM PRZEMYSŁAW STROIWĄS')
    })

    it('parsuje rozliczenie (DoZaplaty)', () => {
      expect(inv.settlement?.amountDue).toBe(488.42)
    })

    it('parsuje termin płatności', () => {
      expect(inv.payment?.dueDates?.[0].date).toBe('2026-02-17')
    })

    it('parsuje formę płatności (przelew = 6)', () => {
      expect(inv.payment?.paymentForm).toBe('przelew')
    })

    it('parsuje rachunek bankowy', () => {
      expect(inv.payment?.bankAccounts?.[0].number).toBe('06109000047777010081033363')
    })

    it('parsuje dwie stawki VAT (23% i 8%)', () => {
      const rate23 = inv.vatSummary.find((l) => l.rate === '23')
      const rate8  = inv.vatSummary.find((l) => l.rate === '8')
      expect(rate23?.net).toBe(303.59)
      expect(rate23?.vat).toBe(69.83)
      expect(rate8?.net).toBe(106.48)
      expect(rate8?.vat).toBe(8.52)
    })

    it('parsuje SystemInfo w nagłówku', () => {
      expect(inv.systemInfo).toBe('Kenan CCBS')
    })

    it('parsuje adres dwuwierszowy z AdresL2', () => {
      expect(inv.seller.address).toBe('Wynalazek 1\n02-667 Warszawa')
    })

    it('parsuje stopkę z polskimi znakami', () => {
      expect(inv.footer).toContain('Kapitał')
    })
  })

  describe('status płatności', () => {
    it('brak <Platnosc> → unknown', () => {
      const inv = parseInvoiceXml(XML_NO_PAYMENT, 'TEST')
      expect(inv.paymentStatus).toBe('unknown')
    })

    it('<Platnosc> bez <Zaplacono> → unpaid', () => {
      const inv = parseInvoiceXml(XML_P4, 'TEST')
      expect(inv.paymentStatus).toBe('unpaid')
    })

    it('<Zaplacono>1 → paid', () => {
      const inv = parseInvoiceXml(XML_PAID, 'TEST')
      expect(inv.paymentStatus).toBe('paid')
    })
  })
})

// ─── Testy extractPaymentStatus ──────────────────────────────────────────────

describe('extractPaymentStatus', () => {
  it('brak Platnosc → unknown', () => {
    expect(extractPaymentStatus(XML_NO_PAYMENT)).toBe('unknown')
  })

  it('Platnosc bez Zaplacono → unpaid', () => {
    expect(extractPaymentStatus(XML_P4)).toBe('unpaid')
  })

  it('Zaplacono=1 → paid', () => {
    expect(extractPaymentStatus(XML_PAID)).toBe('paid')
  })
})

// ─── Testy extractSellerNip ───────────────────────────────────────────────────

describe('extractSellerNip', () => {
  it('zwraca NIP sprzedawcy z XML_BANK', () => {
    expect(extractSellerNip(XML_BANK)).toBe('2090000825')
  })

  it('zwraca NIP sprzedawcy z XML_P4', () => {
    expect(extractSellerNip(XML_P4)).toBe('9512120077')
  })

  it('zwraca null gdy brak Podmiot1', () => {
    const xml = `<Faktura xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">
      <Fa><KodWaluty>PLN</KodWaluty><P_1>2026-01-01</P_1><P_2>X</P_2><P_15>0</P_15><RodzajFaktury>VAT</RodzajFaktury></Fa>
    </Faktura>`
    expect(extractSellerNip(xml)).toBeNull()
  })
})

// ─── Testy extractLineItemNames ───────────────────────────────────────────────

describe('extractLineItemNames', () => {
  it('zwraca nazwy pozycji z XML_BANK', () => {
    const names = extractLineItemNames(XML_BANK)
    expect(names).toHaveLength(3)
    expect(names[0]).toBe('INGENICO TETRA MOVE 5000')
    expect(names[1]).toBe('BEZPIECZENSTWO PCI')
    expect(names[2]).toBe('Prowizja za uslugi')
  })

  it('zwraca polskie nazwy z XML_P4', () => {
    const names = extractLineItemNames(XML_P4)
    expect(names[0]).toBe('Usługi telekomunikacyjne – TV')
    expect(names[1]).toBe('Usługi inne')
  })

  it('zwraca pustą tablicę gdy brak pozycji', () => {
    expect(extractLineItemNames(XML_NO_PAYMENT)).toHaveLength(0)
  })
})

// ─── Testy edge cases ────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('NIP jako liczba (nie string) jest konwertowany do stringa', () => {
    // fast-xml-parser może parsować NIP jako liczbę
    const inv = parseInvoiceXml(XML_BANK, 'TEST')
    expect(typeof inv.seller.nip).toBe('string')
    expect(typeof inv.buyer.nip).toBe('string')
  })

  it('grossAmount jest liczbą, nie stringiem', () => {
    const inv = parseInvoiceXml(XML_BANK, 'TEST')
    expect(typeof inv.grossAmount).toBe('number')
    expect(inv.grossAmount).toBe(68.21)
  })

  it('vatSummary: vat = 0 dla stawek bez VAT (np)', () => {
    const inv = parseInvoiceXml(XML_BANK, 'TEST')
    // XML_BANK: P_13_7 → rate 'np' (noVat=true)
    const np = inv.vatSummary.find((l) => l.rate === 'np')
    expect(np).toBeDefined()
    expect(np!.vat).toBe(0)
  })

  it('parsuje plik z deklaracją XML (<?xml ...?>)', () => {
    // XML_P4 zawiera deklarację <?xml version="1.0"?>
    const inv = parseInvoiceXml(XML_P4, 'TEST')
    expect(inv.invoiceNumber).toBe('F/10033393/02/26')
  })
})
