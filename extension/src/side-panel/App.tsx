import React, { useState } from 'react'
import { FilterBar }   from './components/FilterBar'
import { InvoiceList } from './components/InvoiceList'
import { BulkActions } from './components/BulkActions'
import { NipRules }    from './components/NipRules'
import { ProgressBar } from './components/ProgressBar'
import { useInvoices } from './hooks/useInvoices'
import { useProgress } from './hooks/useProgress'
import type { FilterState } from '../shared/types'

type View = 'invoices' | 'nip-rules'

export function App() {
  const [view, setView]     = useState<View>('invoices')
  const [filter, setFilter] = useState<FilterState>({ category: null, paymentStatus: null })
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { invoices, loading, reload } = useInvoices(filter)
  const { progress } = useProgress()

  // Synchronizuj filtr do content script (ukrywanie wierszy na stronie KSeF)
  function handleFilterChange(newFilter: FilterState) {
    setFilter(newFilter)
    setSelected(new Set())
    chrome.tabs.query({ url: 'https://ap.ksef.mf.gov.pl/web/*' }, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type:    'SET_FILTER',
            payload: newFilter,
          }).catch(() => {})
        }
      })
    })
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, padding: 8 }}>
      {/* Nagłówek */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>PuFKa</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setView('invoices')}
            style={{ fontWeight: view === 'invoices' ? 'bold' : 'normal' }}
          >
            Faktury
          </button>
          <button
            onClick={() => setView('nip-rules')}
            style={{ fontWeight: view === 'nip-rules' ? 'bold' : 'normal' }}
          >
            Reguły NIP
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {progress && <ProgressBar progress={progress} />}

      {view === 'invoices' && (
        <>
          <FilterBar filter={filter} onChange={handleFilterChange} />

          <BulkActions
            selectedKsefNumery={[...selected]}
            onDone={reload}
          />

          {loading ? (
            <div style={{ padding: 16, color: '#666' }}>Ładowanie…</div>
          ) : invoices.length === 0 ? (
            <div style={{ padding: 16, color: '#666' }}>
              Brak faktur. Odśwież stronę KSeF.
            </div>
          ) : (
            <InvoiceList
              invoices={invoices}
              selected={selected}
              onSelectChange={setSelected}
              onReload={reload}
            />
          )}
        </>
      )}

      {view === 'nip-rules' && <NipRules />}
    </div>
  )
}
