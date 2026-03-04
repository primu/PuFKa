import { describe, it, expect } from 'vitest'
import { arrayBufferToBase64 } from './base64'

describe('arrayBufferToBase64', () => {
  it('konwertuje pusty buffer', () => {
    const buf = new ArrayBuffer(0)
    expect(arrayBufferToBase64(buf)).toBe('')
  })

  it('konwertuje prosty string ASCII', () => {
    const enc = new TextEncoder()
    const buf = enc.encode('Hello').buffer
    expect(arrayBufferToBase64(buf)).toBe(btoa('Hello'))
  })

  it('konwertuje dane binarne (znane wartości)', () => {
    // [0, 1, 2] → base64 "AAEC"
    const buf = new Uint8Array([0, 1, 2]).buffer
    expect(arrayBufferToBase64(buf)).toBe('AAEC')
  })

  it('obsługuje duże bufory (>CHUNK=8192) bez stack overflow', () => {
    const big = new Uint8Array(20000).fill(0x41) // 'A' × 20000
    const buf = big.buffer
    const result = arrayBufferToBase64(buf)
    // 20000 × 'A' = btoa('AAAA...A')
    expect(result.length).toBeGreaterThan(0)
    expect(result).toBe(btoa('A'.repeat(20000)))
  })

  it('round-trip: encode → decode daje oryginalne dane', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
    const b64 = arrayBufferToBase64(original.buffer)
    const decoded = atob(b64)
    const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0))
    expect(Array.from(bytes)).toEqual(Array.from(original))
  })
})
