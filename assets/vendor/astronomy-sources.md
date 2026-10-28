# Astronomy Engine

The local browser bundle `astronomy.browser.min.js` is **Astronomy Engine 2.1.19**, by Don Cross / cosinekitty, under the MIT license retained in `astronomy-LICENSE.txt` and the bundle header.

Retrieved 2026-10-28 from the author's repository:

- [Browser bundle](https://github.com/cosinekitty/astronomy/blob/master/source/js/astronomy.browser.min.js)
- [API reference](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md)
- [License](https://github.com/cosinekitty/astronomy/blob/master/LICENSE)

The star-map utility retains `Observer`, `Equator`, and `Horizon` helpers for topocentric sun/moon reference coordinates at the requested observer (25.012611111 degrees N, 121.463527778 degrees E); these helpers are covered by independent USNO fixture checks. Since v91 the displayed sun and moon use independent, fixed left-to-right scene paths instead of these reference coordinates. Their lunar phase still uses `MoonPhase` at the playback UTC+8 date/time. Day/night colour transitions and drawn light sizes remain artistic. The library loads from this repository; there are no runtime requests to a third-party API.
