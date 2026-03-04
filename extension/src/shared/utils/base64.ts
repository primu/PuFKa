/**
 * Konwertuje ArrayBuffer do base64 bezpiecznie (bez przepełnienia stosu).
 * Używana przy serializacji Blob do przesłania przez chrome.runtime.sendMessage.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const CHUNK = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}
