// Replace with your own key from https://adsonbread.com/developer/extensions
const API_KEY = 'YOUR_EXTENSION_API_KEY'

// Flip to false to request a live ad. Test ads never hit the network and never
// record an impression, so leave this on while you iterate on layout.
const USE_TEST_AD = true

const slot = document.getElementById('ad-slot')

if (USE_TEST_AD) {
  AdsOnBreadTest.load(API_KEY, 'banner', slot, { theme: 'light' })
} else {
  AdsOnBread.load(API_KEY, 'banner', slot, {
    theme: 'light',
    language: chrome.i18n.getUILanguage(),
  }).then((ad) => {
    if (!ad) console.log('No ad available right now.')
  })
}
