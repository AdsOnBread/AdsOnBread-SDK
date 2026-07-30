import { AdsOnBreadSlot } from '@adsonbread/react'

// Replace with your own key from https://adsonbread.com/developer/extensions
const API_KEY = 'YOUR_EXTENSION_API_KEY'

// Layout QA: renders a local mock ad in the exact live dimensions and theme.
// No network request, no impression recorded.
export function MockAdSlot() {
  return <AdsOnBreadSlot apiKey={API_KEY} placement="banner" theme="light" test />
}

// Live ads: drop the `test` prop. `fallback` renders while loading and when no
// ad is available, so your layout never jumps to an empty hole.
export function PopupAds() {
  return (
    <AdsOnBreadSlot
      apiKey={API_KEY}
      placement="card"
      theme="dark"
      language={chrome.i18n.getUILanguage()}
      fallback={null}
    />
  )
}
