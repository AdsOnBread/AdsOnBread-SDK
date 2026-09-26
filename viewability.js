// Kept in sync with the standalone vanilla build in sdk.js.
export function observeView(element, ad, apiKey, edgeUrl, token, version, send = fetch) {
  const impressionId = ad.impressionId || ad.impression_id
  if (!impressionId || typeof IntersectionObserver !== 'function') return () => {}
  let startedAt = null
  let timer = null
  let lastRatio = 0
  let visibleByObserver = false
  let completed = false

  function visibleFraction() {
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return 0
    const left = Math.max(0, rect.left)
    const top = Math.max(0, rect.top)
    const right = Math.min(window.innerWidth, rect.right)
    const bottom = Math.min(window.innerHeight, rect.bottom)
    if (right <= left || bottom <= top) return 0
    let unobscured = 0
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const point = document.elementFromPoint(
          left + ((col + 0.5) / 5) * (right - left),
          top + ((row + 0.5) / 5) * (bottom - top),
        )
        if (point && (point === element || element.contains(point))) unobscured += 1
      }
    }
    return ((right - left) * (bottom - top) / (rect.width * rect.height)) * unobscured / 25
  }

  const reset = () => {
    startedAt = null
    if (timer) clearTimeout(timer)
    timer = null
  }
  const isActive = () => element.isConnected && document.visibilityState === 'visible' &&
    visibleByObserver && lastRatio > 0.7 && visibleFraction() > 0.7
  const confirm = async () => {
    timer = null
    const records = observer.takeRecords ? observer.takeRecords() : []
    if (records.length) {
      const latest = records[records.length - 1]
      lastRatio = latest.intersectionRatio
      visibleByObserver = latest.isVisible !== false
    }
    if (!isActive() || completed || startedAt === null) { reset(); return }
    const duration = performance.now() - startedAt
    if (duration < 1000) { timer = setTimeout(confirm, 1000 - duration); return }
    completed = true
    observer.disconnect()
    clearInterval(poll)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    const body = JSON.stringify({ api_key: apiKey, impression_id: impressionId,
      sdk_version: version, token, visible_ratio: Math.min(lastRatio, visibleFraction()),
      duration_ms: Math.floor(duration), page_visible: true })
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await send(edgeUrl.replace(/\/+$/, '') + '/view', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body,
        })
        if (!response || response.ok || (response.status >= 400 && response.status < 500 && response.status !== 409)) return
      } catch {
        // A transient connection failure can be retried while the page is open.
      }
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
    }
  }
  const onVisibilityChange = () => {
    if (document.visibilityState !== 'visible') reset()
    else if (isActive()) { startedAt = performance.now(); timer = setTimeout(confirm, 1000) }
  }
  const supportsTrackVisibility = typeof IntersectionObserverEntry !== 'undefined' &&
    'isVisible' in IntersectionObserverEntry.prototype
  const observer = new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1]
    lastRatio = entry.intersectionRatio
    visibleByObserver = entry.isVisible !== false
    if (!isActive()) { reset(); return }
    if (startedAt === null) { startedAt = performance.now(); timer = setTimeout(confirm, 1000) }
  }, supportsTrackVisibility
    ? { threshold: [0, 0.7, 0.71, 1], trackVisibility: true, delay: 100 }
    : { threshold: [0, 0.7, 0.71, 1] })
  observer.observe(element)
  document.addEventListener('visibilitychange', onVisibilityChange)
  const poll = setInterval(() => {
    if (!isActive()) reset()
    else if (startedAt === null) { startedAt = performance.now(); timer = setTimeout(confirm, 1000) }
  }, 200)
  return () => {
    reset()
    observer.disconnect()
    clearInterval(poll)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
