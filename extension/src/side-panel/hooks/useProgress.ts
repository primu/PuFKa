import { useState, useEffect } from 'react'
import type { ProgressMessage } from '../../shared/types'

export function useProgress() {
  const [progress, setProgress] = useState<ProgressMessage | null>(null)

  useEffect(() => {
    const handler = (msg: { type: string; payload: ProgressMessage }) => {
      if (msg.type === 'PROGRESS') {
        setProgress(msg.payload)
        // Auto-ukryj po zakończeniu
        if (msg.payload.current >= msg.payload.total) {
          setTimeout(() => setProgress(null), 2000)
        }
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  return { progress }
}
