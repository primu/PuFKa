import type { Invoice } from '../types'

// Implementacja w task-09
export async function buildZip(
  _invoices: Invoice[],
  _format: 'xml' | 'pdf' | 'both',
  _template: string,
  _onProgress?: (done: number) => void
): Promise<Blob> {
  throw new Error('ZIP builder not implemented yet (task-09)')
}
