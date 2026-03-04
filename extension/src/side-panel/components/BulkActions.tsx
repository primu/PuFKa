import React, { useState } from 'react'
import { EmailDialog } from './EmailDialog'

interface Props {
  selectedKsefNumery: string[]
  onDone:             () => void
}

export function BulkActions({ selectedKsefNumery, onDone }: Props) {
  const [busy, setBusy]           = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  if (selectedKsefNumery.length === 0) return null

  const downloadZip = async (format: 'xml' | 'pdf' | 'both') => {
    setBusy(true)
    setError(null)
    try {
      const response = await sendMessage<{ base64: string; filename: string }>({
        type:    'GENERATE_ZIP',
        payload: { ksefNumery: selectedKsefNumery, format, template: 'standard-pl' },
      })

      // Konwertuj base64 → Blob → pobierz
      const binary = atob(response.base64)
      const bytes  = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/zip' })
      const url  = URL.createObjectURL(blob)

      await chrome.downloads.download({ url, filename: response.filename })
      URL.revokeObjectURL(url)
      onDone()
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      padding: '6px 0',
      borderBottom: '1px solid #eee',
      marginBottom: 8,
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      alignItems: 'center',
    }}>
      <span style={{ fontSize: 11, color: '#666' }}>
        {selectedKsefNumery.length} zaznaczonych:
      </span>
      <button disabled={busy} onClick={() => downloadZip('xml')}>ZIP XML</button>
      <button disabled={busy} onClick={() => downloadZip('pdf')}>ZIP PDF</button>
      <button disabled={busy} onClick={() => downloadZip('both')}>ZIP XML+PDF</button>
      <button disabled={busy} onClick={() => setEmailOpen(true)}>Email…</button>

      {error && <span style={{ color: 'red', fontSize: 11 }}>{error}</span>}

      {emailOpen && (
        <EmailDialog
          ksefNumery={selectedKsefNumery}
          onClose={() => setEmailOpen(false)}
          onSent={() => { setEmailOpen(false); onDone() }}
        />
      )}
    </div>
  )
}

function sendMessage<T>(payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (resp) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
      else resolve(resp as T)
    })
  })
}
