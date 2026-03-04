import React from 'react'
import type { ProgressMessage } from '../../shared/types'

const OPERATION_LABELS: Record<ProgressMessage['operation'], string> = {
  BULK_FETCH:   'Pobieranie XML',
  GENERATE_ZIP: 'Generowanie ZIP',
  GENERATE_PDF: 'Generowanie PDF',
  SEND_EMAIL:   'Wysyłanie email',
}

interface Props {
  progress: ProgressMessage
}

export function ProgressBar({ progress }: Props) {
  const pct = Math.round((progress.current / progress.total) * 100)
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
        <span>{OPERATION_LABELS[progress.operation]}</span>
        <span>{progress.current}/{progress.total}</span>
      </div>
      <div style={{ height: 4, background: '#e0e0e0', borderRadius: 2 }}>
        <div style={{
          height: '100%',
          width:  `${pct}%`,
          background: '#0066cc',
          borderRadius: 2,
          transition: 'width 0.2s',
        }} />
      </div>
    </div>
  )
}
