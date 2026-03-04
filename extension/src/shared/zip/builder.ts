import JSZip from 'jszip'
import type { Invoice } from '../types'

export type ZipFormat = 'xml' | 'pdf' | 'both'

/**
 * Generuje archiwum ZIP z fakturami.
 *
 * @param invoices   - lista faktur z xmlRaw
 * @param format     - 'xml' | 'pdf' | 'both'
 * @param template   - klucz szablonu PDF (ignorowany przy format='xml')
 * @param onProgress - callback (completedCount: number) po każdej fakturze
 * @returns          - Blob gotowego archiwum ZIP
 */
export async function buildZip(
  invoices: Invoice[],
  format: ZipFormat,
  template: string,
  onProgress?: (completed: number) => void
): Promise<Blob> {
  const zip = new JSZip()

  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i]

    if (!inv.xmlRaw) {
      console.warn(`buildZip: brak xmlRaw dla ${inv.ksefNumer} — pominięto`)
      onProgress?.(i + 1)
      continue
    }

    // Bezpieczna nazwa pliku: usuń znaki niedozwolone w nazwach plików
    const safeName = inv.invoiceNumber
      .replace(/\//g, '-')
      .replace(/[\\:*?"<>|]/g, '_')

    if (format !== 'pdf') {
      zip.file(`${safeName}.xml`, inv.xmlRaw)
    }

    if (format !== 'xml') {
      const { generatePdf } = await import('../pdf/generator')
      const pdfBlob = await generatePdf(inv.xmlRaw, template, inv.ksefNumer)
      const pdfBuffer = await pdfBlob.arrayBuffer()
      zip.file(`${safeName}.pdf`, pdfBuffer)
    }

    onProgress?.(i + 1)
  }

  return zip.generateAsync({
    type:               'blob',
    compression:        'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

/**
 * Generuje nazwę archiwum ZIP na podstawie filtrów i daty.
 * Przykład: "faktury-koszty-2026-01.zip"
 */
export function buildZipFilename(
  filter?: { category?: string; dateFrom?: string }
): string {
  const parts = ['faktury']
  if (filter?.category) parts.push(filter.category)
  if (filter?.dateFrom) parts.push(filter.dateFrom.slice(0, 7))
  return `${parts.join('-')}.zip`
}

// Re-export dla zachowania kompatybilności wstecznej
export { arrayBufferToBase64 } from '../utils/base64'
