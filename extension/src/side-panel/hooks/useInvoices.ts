import { useState, useEffect, useCallback } from 'react'
import type { Invoice, FilterState } from '../../shared/types'

function sendMessage<T>(payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
      else resolve(response as T)
    })
  })
}

export function useInvoices(filter: FilterState) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading]   = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const result = await sendMessage<Invoice[]>({
        type: 'GET_INVOICES',
        payload: {
          category:      filter.category === 'uncategorized' ? undefined : filter.category,
          paymentStatus: filter.paymentStatus,
        },
      })
      // Filtr "nieoznaczone" — po stronie frontu (SW zwraca wszystkie, filtrujemy tu)
      const filtered = filter.category === 'uncategorized'
        ? result.filter((inv) => inv.category === null)
        : result
      setInvoices(filtered)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    reload()
  }, [reload])

  // Nasłuchuj aktualizacji z SW (po pobraniu nowych XML)
  useEffect(() => {
    const handler = (msg: { type: string }) => {
      if (msg.type === 'INVOICE_UPDATED') reload()
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [reload])

  return { invoices, loading, reload }
}
