import React from 'react'
import type { FilterState, PaymentStatus } from '../../shared/types'

interface Props {
  filter:   FilterState
  onChange: (filter: FilterState) => void
}

export function FilterBar({ filter, onChange }: Props) {
  const setCategory = (category: FilterState['category']) =>
    onChange({ ...filter, category: filter.category === category ? null : category })

  const setStatus = (paymentStatus: PaymentStatus) =>
    onChange({ ...filter, paymentStatus: filter.paymentStatus === paymentStatus ? null : paymentStatus })

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 8px',
    borderRadius: 4,
    border: '1px solid #ccc',
    background: active ? '#0066cc' : '#fff',
    color:      active ? '#fff'    : '#333',
    cursor: 'pointer',
    fontSize: 12,
  })

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
      <button
        style={btnStyle(filter.category === 'costs')}
        onClick={() => setCategory('costs')}
      >
        Koszty
      </button>
      <button
        style={btnStyle(filter.category === 'goods')}
        onClick={() => setCategory('goods')}
      >
        Towary
      </button>
      <button
        style={btnStyle(filter.category === 'uncategorized')}
        onClick={() => setCategory('uncategorized')}
      >
        Nieoznaczone
      </button>
      <span style={{ color: '#ccc' }}>|</span>
      <button
        style={btnStyle(filter.paymentStatus === 'unpaid')}
        onClick={() => setStatus('unpaid')}
      >
        Do zapłaty
      </button>
      <button
        style={btnStyle(filter.paymentStatus === 'paid')}
        onClick={() => setStatus('paid')}
      >
        Zapłacone
      </button>
    </div>
  )
}
