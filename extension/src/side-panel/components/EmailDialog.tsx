import React, { useState } from 'react'

interface Props {
  ksefNumery: string[]
  onClose:    () => void
  onSent:     () => void
}

export function EmailDialog({ ksefNumery, onClose, onSent }: Props) {
  const [email,   setEmail]   = useState('')
  const [format,  setFormat]  = useState<'xml' | 'pdf' | 'both'>('pdf')
  const [sending, setSending] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const send = async () => {
    if (!email.includes('@')) {
      setError('Podaj prawidłowy adres e-mail')
      return
    }
    setSending(true)
    setError(null)
    try {
      await sendMessage({
        type:    'SEND_EMAIL',
        payload: { to: email, format, ksefNumery, template: 'standard-pl' },
      })
      onSent()
    } catch (err) {
      setError(String(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: '#fff', borderRadius: 8, padding: 20,
        width: 300, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      }}>
        <h3 style={{ margin: '0 0 12px' }}>Wyślij faktury emailem</h3>
        <p style={{ fontSize: 12, color: '#666', margin: '0 0 12px' }}>
          {ksefNumery.length} faktur
        </p>

        <label style={{ display: 'block', marginBottom: 8 }}>
          <span style={{ fontSize: 12 }}>Adres e-mail:</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '4px 8px' }}
            placeholder="ksiegowosc@firma.pl"
          />
        </label>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 12 }}>Format:</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as typeof format)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          >
            <option value="pdf">Tylko PDF</option>
            <option value="xml">Tylko XML</option>
            <option value="both">PDF + XML</option>
          </select>
        </label>

        {error && <p style={{ color: 'red', fontSize: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={sending}>Anuluj</button>
          <button onClick={send} disabled={sending || !email}>
            {sending ? 'Wysyłanie…' : 'Wyślij'}
          </button>
        </div>
      </div>
    </div>
  )
}

function sendMessage(payload: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
      else resolve(response)
    })
  })
}
