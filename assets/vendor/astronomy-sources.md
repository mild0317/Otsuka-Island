# Astronomy Engine

The local browser bundle `astronomy.browser.min.js` is **Astronomy Engine 2.1.19**, by Don Cross / cosinekitty, under the MIT license retained in `astronomy-LICENSE.txt` and the bundle header.

Retrieved 2026-10-28 from the author's repository:

- [Browser bundle](https://github.com/cosinekitty/astronomy/blob/master/source/js/astronomy.browser.min.js)
- [API reference](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md)
- [License](https://github.com/cosinekitty/astronomy/blob/master/LICENSE)

The star-map utility retains `Observer`, `Equator`, and `Horizon` helpers for topocentric sun/moon reference coordinates at the requested observer (25.012611111 degrees N, 121.463527778 degrees E); these helpers are covered by independent USNO fixture checks. Since v91 the displayed sun and moon use independent, fixed left-to-right scene paths instead of these reference coordinates. Their lunar phase still uses `MoonPhase` at the playback UTC+8 date/time. Day/night colour transitions and drawn light sizes remain artistic. The library loads from this repository; there are no runtime requests to a third-party API.

Since v93 `GeoVector` supplies Earth-centre-to-Sun/Moon distances for date-dependent apparent size. The displayed reference radii remain artistic; their relative variation follows inverse distance, normalised to 1 AU for the Sun and 384,400 km for the Moon. Random weather no longer changes either body's size. These geocentric size factors do not model atmospheric refraction or the perceptual Moon illusion. The scene trajectories remain independent of the ephemeris positions.

Physical context: [NASA: Geometry of Solar Eclipses](https://ntrs.nasa.gov/api/citations/19870014944/downloads/19870014944.pdf) gives the solar semi-diameter range; [NASA: A Super Start to 2019](https://science.nasa.gov/science-research/planetary-science/a-super-start-to-2019/) describes the lunar perigee/apogee apparent-size difference.
