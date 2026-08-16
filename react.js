import { createElement, useEffect, useRef, useState } from 'react'

export const VERSION = '1.1.0'

const DEFAULT_EDGE_URL = 'https://edge.adsonbread.com'

function formatFromPlacement(placement) {
  return placement === 'card' ? 'card' : 'banner'
}

function normalizeAd(ad) {
  if (!ad) return null

  return {
    clickUrl: ad.click_url || ad.clickUrl || '',
    extensionName: ad.extension_name || ad.extensionName || 'this extension',
    format: ad.format === 'card' ? 'card' : 'banner',
    iconUrl: ad.icon_url || ad.iconUrl || '',
    linkRanges: Array.isArray(ad.link_ranges) ? ad.link_ranges : Array.isArray(ad.linkRanges) ? ad.linkRanges : [],
    text: ad.text || '',
  }
}

function normalizeRanges(text, ranges) {
  if (!Array.isArray(ranges)) return []

  const valid = []
  let previousEnd = 0

  ranges
    .map((range) => ({ end: Number(range.end), start: Number(range.start) }))
    .sort((a, b) => a.start - b.start)
    .forEach((range) => {
      if (!Number.isInteger(range.start) || !Number.isInteger(range.end)) return
      if (range.start < previousEnd || range.start < 0 || range.end > text.length || range.start >= range.end) return
      valid.push(range)
      previousEnd = range.end
    })

  return valid
}

function browserLanguage() {
  const language = (navigator.language || 'en').toLowerCase()

  if (language.indexOf('zh') === 0) {
    if (language.includes('tw') || language.includes('hk') || language.includes('mo') || language.includes('hant')) {
      return 'zh-hant'
    }

    return 'zh-hans'
  }

  return language.split('-')[0]
}

const UID_STORAGE_KEY = 'adsonbread_uid'
const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000
let cachedToken = null
let tokenPromise = null

function randomToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12)
}

function validToken(value, now = Date.now()) {
  return value && typeof value === 'object' && typeof value.id === 'string' && value.id &&
    Number.isFinite(value.expiresAt) && value.expiresAt > now
}

function createToken(now = Date.now()) {
  return { expiresAt: now + TOKEN_LIFETIME_MS, id: randomToken() }
}

async function loadToken() {
  const now = Date.now()

  if (validToken(cachedToken, now)) return cachedToken.id

  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const stored = await chrome.storage.local.get(UID_STORAGE_KEY)

      const value = stored && stored[UID_STORAGE_KEY]

      if (validToken(value, now)) {
        cachedToken = value
        return cachedToken.id
      }

      cachedToken = createToken(now)
      await chrome.storage.local.set({ [UID_STORAGE_KEY]: cachedToken })
      return cachedToken.id
    }
  } catch {
    // chrome.storage unavailable in this context, fall back to localStorage
  }

  try {
    const stored = localStorage.getItem(UID_STORAGE_KEY)
    let value = null

    if (stored) {
      try {
        value = JSON.parse(stored)
      } catch {
        // Replace the permanent bare string written by SDK 1.0.0.
      }
    }

    if (validToken(value, now)) {
      cachedToken = value
      return cachedToken.id
    }

    cachedToken = createToken(now)
    localStorage.setItem(UID_STORAGE_KEY, JSON.stringify(cachedToken))
    return cachedToken.id
  } catch {
    cachedToken = createToken(now)
    return cachedToken.id
  }
}

async function userToken() {
  if (validToken(cachedToken)) return cachedToken.id
  if (tokenPromise) return tokenPromise

  tokenPromise = loadToken().finally(() => {
    tokenPromise = null
  })

  return tokenPromise
}

// A manually passed Chrome i18n locale code wins (e.g. 'es', 'pt_BR'); otherwise
// detect from the browser, which falls back to English when unavailable.
function resolveLanguage(language) {
  const value = typeof language === 'string' ? language.trim() : ''

  if (!value || value.toLowerCase() === 'auto') return browserLanguage()
  return value
}

async function requestAd({ apiKey, placement, edgeUrl, language, signal }) {
  const response = await fetch(edgeUrl + '/ad', {
    body: JSON.stringify({
      api_key: apiKey,
      language: resolveLanguage(language),
      placement: formatFromPlacement(placement),
      sdk_version: VERSION,
      token: await userToken(),
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    signal,
  })

  if (!response.ok) return null

  const result = await response.json()
  return normalizeAd(result.ad)
}

function shortKey(apiKey) {
  if (!apiKey) return 'missing API key'
  if (apiKey.length <= 12) return apiKey
  return apiKey.slice(0, 8) + '...' + apiKey.slice(-4)
}

function testAd(apiKey, placement) {
  const format = formatFromPlacement(placement)

  return {
    clickUrl: '#',
    extensionName: 'this extension',
    format,
    iconUrl: '',
    linkRanges: [{ end: 35, start: 24 }],
    test: true,
    text: `AdsOnBread ${format} test ad for ${shortKey(apiKey)}.`,
  }
}

function themeColors(theme) {
  return theme === 'dark'
    ? { callout: '#a3a7ad', iconBg: '#343b46', iconText: '#e6e8eb', link: '#58bdfc', shadow: '0 2px 3px rgba(0,0,0,.35)', surface: '#20242b', text: '#e6e8eb' }
    : { callout: '#888', iconBg: '#d9dce1', iconText: '#505050', link: '#088cdb', shadow: '0 2px 3px rgba(0,0,0,.15)', surface: '#F2F3F5', text: '#505050' }
}

function bannerSegmentText(value) {
  return value.replace(/\s*\n+\s*/g, ' ').replace(/[ \t]{2,}/g, ' ')
}

function linkedChildren(ad, linkColor, transformSegment = (value) => value) {
  const ranges = normalizeRanges(ad.text, ad.linkRanges)
  const children = []
  let cursor = 0

  ranges.forEach((range, index) => {
    if (range.start > cursor) children.push(transformSegment(ad.text.slice(cursor, range.start)))
    children.push(createElement('span', {
      key: `link-${index}`,
      onMouseEnter: (event) => {
        event.currentTarget.style.textDecoration = 'underline'
      },
      onMouseLeave: (event) => {
        event.currentTarget.style.textDecoration = 'none'
      },
      style: { color: linkColor, fontWeight: 500, textDecoration: 'none' },
    }, transformSegment(ad.text.slice(range.start, range.end))))
    cursor = range.end
  })

  if (cursor < ad.text.length) children.push(transformSegment(ad.text.slice(cursor)))
  return children
}

export function AdsOnBreadSlot({
  apiKey,
  placement = 'banner',
  edgeUrl = DEFAULT_EDGE_URL,
  language,
  theme = 'light',
  test = false,
  fallback = null,
  onAdLoad,
  onError,
}) {
  const [ad, setAd] = useState(test ? testAd(apiKey, placement) : null)
  const [status, setStatus] = useState(test ? 'ready' : 'loading')
  const latestLoad = useRef(0)

  useEffect(() => {
    const loadId = latestLoad.current + 1
    latestLoad.current = loadId

    if (test) {
      const mock = testAd(apiKey, placement)
      setAd(mock)
      setStatus('ready')
      if (onAdLoad) onAdLoad(mock)
      return undefined
    }

    if (!apiKey) {
      setAd(null)
      setStatus('empty')
      return undefined
    }

    const ctrl = new AbortController()
    const timeout = window.setTimeout(() => ctrl.abort(), 2000)

    setStatus('loading')
    requestAd({ apiKey, edgeUrl, language, placement, signal: ctrl.signal })
      .then((nextAd) => {
        if (latestLoad.current !== loadId) return
        setAd(nextAd)
        setStatus(nextAd ? 'ready' : 'empty')
        if (nextAd && onAdLoad) onAdLoad(nextAd)
      })
      .catch((error) => {
        if (latestLoad.current !== loadId) return
        setAd(null)
        setStatus('error')
        if (onError) onError(error)
      })
      .finally(() => window.clearTimeout(timeout))

    return () => {
      window.clearTimeout(timeout)
      ctrl.abort()
    }
  }, [apiKey, edgeUrl, language, onAdLoad, onError, placement, test])

  if (!ad) return fallback

  const colors = themeColors(theme)
  const format = ad.format === 'card' ? 'card' : 'banner'
  const href = ad.clickUrl.charAt(0) === '/' ? edgeUrl + ad.clickUrl : ad.clickUrl
  const icon = ad.iconUrl
    ? createElement('img', {
        alt: 'Logo',
        src: ad.iconUrl,
        style: { borderRadius: 3, display: 'block', height: 48, objectFit: 'cover', width: 48 },
      })
    : createElement('span', {
        style: { alignItems: 'center', background: colors.iconBg, borderRadius: 3, color: colors.iconText, display: 'flex', fontSize: 11, fontWeight: 800, height: 48, justifyContent: 'center', width: 48 },
      }, 'AOB')

  return createElement(
    'div',
    {
      'data-adsonbread': 'true',
      'data-adsonbread-status': status,
      className: 'adsonbread-slot',
      style: {
        display: 'inline-flex',
        flexDirection: 'column',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
        maxWidth: format === 'banner' ? 500 : undefined,
        minWidth: format === 'banner' ? 300 : undefined,
        width: format === 'card' ? 180 : '100%',
      },
    },
    createElement(
      'a',
      {
        href,
        rel: 'noopener noreferrer sponsored',
        style: format === 'card'
          ? { background: colors.surface, borderRadius: 4, boxShadow: colors.shadow, display: 'block', overflow: 'hidden', textDecoration: 'none' }
          : { alignItems: 'center', background: colors.surface, borderRadius: '4px 4px 0 0', boxShadow: colors.shadow, boxSizing: 'border-box', color: colors.text, display: 'flex', gap: 12, minHeight: 64, padding: '8px 12px 8px 8px', textDecoration: 'none' },
        target: '_blank',
      },
      format === 'card'
        ? [
            createElement('div', { key: 'icon', style: { boxSizing: 'border-box', display: 'flex', justifyContent: 'center', padding: '16px 16px 12px', width: '100%' } }, icon),
            createElement('div', { key: 'body', style: { display: 'flex', flexDirection: 'column', gap: 10, padding: '0 14px 12px' } },
              createElement('p', { style: { color: colors.text, fontSize: 12.5, lineHeight: 1.5, margin: 0, whiteSpace: 'pre-line' } }, linkedChildren(ad, colors.link))),
          ]
        : [
            createElement('div', { key: 'icon', style: { flexShrink: 0 } }, icon),
            createElement('div', { key: 'text', style: { color: colors.text, fontSize: 13, lineHeight: 1.45 } }, linkedChildren(ad, colors.link, bannerSegmentText)),
          ],
    ),
    createElement(
      'div',
      { style: format === 'card' ? { padding: '5px 4px 0', textAlign: 'right' } : { alignItems: 'center', display: 'flex', justifyContent: 'flex-end', padding: '4px 8px' } },
      createElement('a', {
        href: 'https://adsonbread.com',
        rel: 'noopener noreferrer',
        style: { color: colors.callout, fontSize: 10, letterSpacing: '.01em', textDecoration: 'none', whiteSpace: 'nowrap' },
        target: '_blank',
      }, `Ad by AdsOnBread for ${ad.extensionName}`),
    ),
  )
}
