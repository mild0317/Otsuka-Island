# Real star catalogue (v88)

`star-catalog-v88.js` contains 41,411 stars down to apparent magnitude 8, with HIP identifiers, J2000 right ascension/declination in degrees, visual magnitude, B−V colour index, and selected bright-star names. It also contains 89 constellation figures (Serpens is split into two figures).

Data were packed from Olaf Frohn's [d3-celestial](https://github.com/ofrohn/d3-celestial) `stars.8.json`, `starnames.json`, `constellations.json`, and `constellations.lines.json`, retrieved 2026-10-28. The original GeoJSON structure was replaced with compact arrays; numerical star coordinates and magnitudes were preserved. The project's BSD-3-Clause notice is retained in [star-catalog-LICENSE.txt](star-catalog-LICENSE.txt).

The stellar data source credited by d3-celestial is **Anderson E., Francis C. (2012), XHIP: An Extended Hipparcos Compilation**, [CDS V/137D](https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/V/137D?format=html). Constellation line figures are illustrative conventions, not IAU constellation boundaries. Names and figure positions follow d3-celestial; common bright-star Chinese labels are provided by this app.

The local star-map engine uses Taipei (25.033°N, 121.5654°E), UTC+8 scene dates, J2000-to-date IAU 1976 precession, mean sidereal rotation, and equatorial-to-horizontal coordinates. Formula references:

- [USNO: Computing Approximate Sidereal Time](https://aa.usno.navy.mil/faq/GAST)
- [USNO: Computing Altitude and Azimuth](https://aa.usno.navy.mil/faq/alt_az)
- [University of Tokyo S2E: Celestial Rotation / precession](https://www.space.t.u-tokyo.ac.jp/s2e-documents/Specifications/Environment/Spec_CelestialRotation.html)

This is an approximate visual star map, not a precision ephemeris: UTC approximates UT1; stellar proper motion, nutation, atmospheric refraction, aberration, planets, and light pollution are omitted. Since v90 the stellar camera is fixed at azimuth 150 degrees (southeast), elevation 55 degrees, with a rectilinear view, centred since v92 to keep left/right optical magnification symmetric. It does not track any body. The celestial rotation pole remains outside this view. The date is automatic; the scene time multiplier can advance it naturally, and v91 displays the playback date as read-only. Real star positions do not depend on the session's random seed. Magnitude-based bloom, scintillation, meteors, and unresolved Milky Way dust are artistic effects. The Milky Way dust shares the celestial rotation and the J2000 galactic plane orientation (north pole RA 192.85948 degrees, Dec 27.12825 degrees; centre RA 266.4051 degrees, Dec -28.936175 degrees). Since v91 the displayed sun and moon follow independent left-to-right scene paths, rising at the left cloud horizon and setting at the right; those display positions are not astronomical coordinates. Lunar phase still uses local [Astronomy Engine](vendor/astronomy-sources.md) calculations.
