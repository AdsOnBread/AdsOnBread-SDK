;(function (window) {
  'use strict'

  const rendered = new Map()

  function normalizeContainer(container) {
    if (typeof container === 'string') return document.querySelector(container)
    return container
  }

  function formatFromPlacement(placement) {
    return placement === 'card' ? 'card' : 'banner'
  }

  function themeColors(options) {
    return options && options.theme === 'dark'
      ? { callout: '#a3a7ad', iconBg: '#343b46', iconText: '#e6e8eb', link: '#58bdfc', shadow: '0 2px 3px rgba(0,0,0,.35)', surface: '#20242b', text: '#e6e8eb' }
      : { callout: '#888', iconBg: '#d9dce1', iconText: '#505050', link: '#088cdb', shadow: '0 2px 3px rgba(0,0,0,.15)', surface: '#F2F3F5', text: '#505050' }
  }

  function shortKey(apiKey) {
    if (!apiKey) return 'missing API key'
    if (apiKey.length <= 12) return apiKey
    return apiKey.slice(0, 8) + '...' + apiKey.slice(-4)
  }

  function renderPlaceholder(container, apiKey, placement, options) {
    const previous = rendered.get(container)
    if (previous && previous.parentNode === container) previous.remove()

    const format = formatFromPlacement(placement)
    const colors = themeColors(options || {})
    const wrap = document.createElement('div')
    wrap.setAttribute('data-adsonbread-test', 'true')
    wrap.setAttribute('role', 'note')
    wrap.style.cssText = [
      'display:inline-flex',
      'flex-direction:column',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
      format === 'card' ? 'width:180px' : 'max-width:500px;min-width:300px;width:100%',
    ].join(';')

    const content = document.createElement('a')
    content.href = '#'
    content.target = '_blank'
    content.rel = 'noopener noreferrer sponsored'
    content.style.cssText = format === 'card'
      ? `display:block;background-color:${colors.surface};border-radius:4px;box-shadow:${colors.shadow};overflow:hidden;text-decoration:none`
      : `display:flex;align-items:center;gap:12px;min-height:64px;padding:8px 12px 8px 8px;box-sizing:border-box;background:${colors.surface};color:${colors.text};border-radius:4px 4px 0 0;box-shadow:${colors.shadow};text-decoration:none`

    const iconWrap = document.createElement('div')
    iconWrap.style.cssText = format === 'card'
      ? 'width:100%;padding:16px 16px 12px;box-sizing:border-box;display:flex;justify-content:center'
      : 'flex-shrink:0'
    const icon = document.createElement('span')
    icon.textContent = 'AOB'
    icon.style.cssText = `display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:3px;background:${colors.iconBg};color:${colors.iconText};font-size:11px;font-weight:800`
    iconWrap.appendChild(icon)

    const text = document.createElement(format === 'card' ? 'p' : 'div')
    text.style.cssText = format === 'card'
      ? `font-size:12.5px;line-height:1.5;color:${colors.text};margin:0`
      : `font-size:13px;line-height:1.45;color:${colors.text}`
    text.textContent = `AdsOnBread ${format} test ad for ${shortKey(apiKey)}. `
    const link = document.createElement('span')
    link.textContent = 'Linked text'
    link.style.cssText = `color:${colors.link};font-weight:600;text-decoration:none`
    link.addEventListener('mouseenter', () => {
      link.style.textDecoration = 'underline'
    })
    link.addEventListener('mouseleave', () => {
      link.style.textDecoration = 'none'
    })
    text.appendChild(link)

    if (format === 'card') {
      const body = document.createElement('div')
      body.style.cssText = 'padding:0 14px 12px'
      body.appendChild(text)
      content.appendChild(iconWrap)
      content.appendChild(body)
    } else {
      content.appendChild(iconWrap)
      content.appendChild(text)
    }

    const callout = document.createElement('div')
    callout.style.cssText = format === 'card' ? 'padding:5px 4px 0;text-align:right' : 'display:flex;justify-content:flex-end;padding:4px 8px'
    const calloutText = document.createElement('span')
    calloutText.textContent = 'Ad by AdsOnBread for this extension'
    calloutText.style.cssText = `font-size:10px;color:${colors.callout};letter-spacing:.01em;white-space:nowrap`
    callout.appendChild(calloutText)

    wrap.appendChild(content)
    wrap.appendChild(callout)
    container.innerHTML = ''
    container.appendChild(wrap)
    rendered.set(container, wrap)

    return {
      format,
      id: 'test-ad',
      placement: format,
      test: true,
    }
  }

  const AdsOnBreadTest = {
    version: '1.2.0',

    load(apiKey, placement, container, options) {
      const target = normalizeContainer(container)
      if (!target) {
        console.warn('[AdsOnBreadTest] Container not found.')
        return null
      }

      return renderPlaceholder(target, apiKey, placement, options || {})
    },

    destroy(container) {
      if (container) {
        const target = normalizeContainer(container)
        const element = target ? rendered.get(target) : null
        if (element && element.parentNode === target) element.remove()
        if (target) rendered.delete(target)
        return
      }

      rendered.forEach((element, target) => {
        if (element && element.parentNode === target) element.remove()
      })
      rendered.clear()
    },
  }

  window.AdsOnBreadTest = AdsOnBreadTest
})(window)
