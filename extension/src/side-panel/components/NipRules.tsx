import React, { useState, useEffect } from 'react'
import type { NipRule } from '../../shared/types'
import { db } from '../../shared/db/schema'

export function NipRules() {
  const [rules,   setRules]   = useState<NipRule[]>([])
  const [loading, setLoading] = useState(true)

  const reload = async () => {
    setLoading(true)
    const all = await db.nipRules.toArray()
    setRules(all.sort((a, b) => b.updatedAt - a.updatedAt))
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  const remove = async (nip: string) => {
    await db.nipRules.delete(nip)
    await reload()
  }

  const toggleCategory = async (rule: NipRule) => {
    const next: NipRule = {
      ...rule,
      category:  rule.category === 'costs' ? 'goods' : 'costs',
      updatedAt: Date.now(),
    }
    await db.nipRules.put(next)
    await reload()
  }

  if (loading) return <div style={{ padding: 16, color: '#666' }}>Ładowanie…</div>

  return (
    <div>
      <p style={{ fontSize: 12, color: '#666', margin: '0 0 8px' }}>
        Reguły automatycznej klasyfikacji wg NIP sprzedawcy.
        Dodawane automatycznie przy ręcznej zmianie kategorii.
      </p>
      {rules.length === 0 ? (
        <p style={{ color: '#999', fontSize: 12 }}>Brak reguł.</p>
      ) : (
        rules.map((rule) => (
          <div key={rule.nip} style={{
            display:      'flex',
            alignItems:   'center',
            gap:          8,
            padding:      '5px 0',
            borderBottom: '1px solid #eee',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{rule.sellerName}</div>
              <div style={{ fontSize: 11, color: '#888' }}>NIP: {rule.nip}</div>
            </div>
            <button
              onClick={() => toggleCategory(rule)}
              style={{ fontSize: 11, padding: '2px 6px' }}
            >
              {rule.category === 'costs' ? 'Koszty' : 'Towary'}
            </button>
            <button
              onClick={() => remove(rule.nip)}
              style={{ fontSize: 11, color: 'red', padding: '2px 6px' }}
            >
              ✕
            </button>
          </div>
        ))
      )}
    </div>
  )
}
