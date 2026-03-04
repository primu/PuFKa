/**
 * Utrzymuje MV3 Service Worker przy życiu przez czas trwania długiej operacji.
 * SW usypia po ~30s bezczynności — polling chrome.storage co 20s zapobiega temu.
 */
export async function withKeepalive<T>(fn: () => Promise<T>): Promise<T> {
  const interval = setInterval(() => {
    chrome.storage.local.get('_keepalive')
  }, 20_000)

  try {
    return await fn()
  } finally {
    clearInterval(interval)
  }
}
