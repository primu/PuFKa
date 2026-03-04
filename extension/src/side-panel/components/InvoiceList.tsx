import React, { useState } from 'react'
import type { Invoice, Category, PaymentStatus } from '../../shared/types'

interface Props {
  invoices:       Invoice[]
  selected:       Set<string>
  onSelectChange: (selected: Set<string>) => void
  onReload:       () => void
}

export function InvoiceList({ invoices, selected, onSelectChange, onReload }: Props) {
  const toggleAll = () => {
    if (selected.size === invoices.length) {
      onSelectChange(new Set())
    } else {
      onSelectChange(new Set(invoices.map((i) => i.ksefNumer)))
    }
  }

  const toggle = (ksefNumer: string) => {
    const next = new Set(selected)
    if (next.has(ksefNumer)) next.delete(ksefNumer)
    else next.add(ksefNumer)
    onSelectChange(next)
  }

  const setCategory = async (ksefNumer: string, category: NonNullable<Category>) => {
    await sendMessage({
      type:    'SET_CATEGORY',
      payload: { ksefNumer, category, updateNipRule: false },
    })
    onReload()
  }

  const setStatus = async (ksefNumer: string, paymentStatus: PaymentStatus) => {
    await sendMessage({
      type:    'SET_STATUS',
      payload: { ksefNumer, paymentStatus },
    })
    onReload()
  }

  return (
    <div>
      {/* Nagłówek z "zaznacz wszystkie" */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4, gap: 6 }}>
        <input
          type="checkbox"
          checked={selected.size === invoices.length && invoices.length > 0}
          onChange={toggleAll}
        />
        <span style={{ color: '#666', fontSize: 11 }}>
          {selected.size > 0
            ? `Zaznaczono: ${selected.size} z ${invoices.length}`
            : `${invoices.length} faktur`}
        </span>
      </div>

      {/* Lista */}
      <div style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
        {invoices.map((inv) => (
          <InvoiceRow
            key={inv.ksefNumer}
            invoice={inv}
            isSelected={selected.has(inv.ksefNumer)}
            onToggle={() => toggle(inv.ksefNumer)}
            onSetCategory={(cat) => setCategory(inv.ksefNumer, cat)}
            onSetStatus={(status) => setStatus(inv.ksefNumer, status)}
          />
        ))}
      </div>
    </div>
  )
}

interface RowProps {
  invoice:       Invoice
  isSelected:    boolean
  onToggle:      () => void
  onSetCategory: (category: NonNullable<Category>) => void
  onSetStatus:   (status: PaymentStatus) => void
}

function InvoiceRow({ invoice: inv, isSelected, onToggle, onSetCategory, onSetStatus }: RowProps) {
  return (
    <div style={{
      borderBottom: '1px solid #eee',
      padding: '5px 0',
      background: isSelected ? '#f0f7ff' : 'transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <input type="checkbox" checked={isSelected} onChange={onToggle} style={{ marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Wiersz 1: numer + kwota */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 500, fontSize: 12 }}>
              {inv.invoiceNumber}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>
              {inv.grossAmount.toFixed(2)} {inv.currency}
            </span>
          </div>
          {/* Wiersz 2: sprzedawca + data */}
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: 11 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
              {inv.sellerName}
            </span>
            <span>{inv.issueDate}</span>
          </div>
          {/* Wiersz 3: kontrolki */}
          <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
            <select
              value={inv.paymentStatus}
              onChange={(e) => onSetStatus(e.target.value as PaymentStatus)}
              style={{ fontSize: 10, padding: '1px 2px', border: '1px solid #ccc', borderRadius: 3 }}
            >
              <option value="paid">✓ Zapłacona</option>
              <option value="unpaid">! Do zapłaty</option>
              <option value="unknown">? Nieznany</option>
            </select>
            <select
              value={inv.category ?? ''}
              onChange={(e) => {
                const val = e.target.value
                if (val === 'costs' || val === 'goods') onSetCategory(val)
              }}
              style={{ fontSize: 10, padding: '1px 2px', border: '1px solid #ccc', borderRadius: 3 }}
            >
              <option value="">— brak —</option>
              <option value="costs">Koszty</option>
              <option value="goods">Towary</option>
            </select>
            <span style={{ fontSize: 10, color: '#888' }}>{inv.invoiceType}</span>
            {inv.downloadedXml && <span style={{ fontSize: 10, color: '#555' }} title="Pobrano XML">↓XML</span>}
            {inv.downloadedPdf && <span style={{ fontSize: 10, color: '#4a1772' }} title="Pobrano PDF">↓PDF</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function sendMessage(payload: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (resp) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
      else resolve(resp)
    })
  })
}
