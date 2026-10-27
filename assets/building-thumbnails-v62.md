# Main-island exterior thumbnails v62

Scope confirmed by the user: the four clickable building exteriors on the main island, not interior room backgrounds. The user selected direct upscaling of the current artwork without redrawing.

The final assets are faithful resampled exports of the existing composed island. No image-generation variant is used. Long edge is 4096 pixels; original proportions, object positions and logical island coordinates are preserved. Upscaling does not recreate missing native detail.

| Building | World crop x/y/w/h | 4K file | Pixels |
| --- | --- | --- | --- |
| Design clocktower | 385 / 70 / 330 / 595 | building-clock-4k-v62.webp | 2272 x 4096 |
| Verification studio | 585 / 625 / 470 / 460 | building-library-4k-v62.webp | 4096 x 4009 |
| Simulation lab | 95 / 870 / 350 / 355 | building-lab-4k-v62.webp | 4038 x 4096 |
| Manufacturing workshop | 605 / 1105 / 470 / 420 | building-workshop-4k-v62.webp | 4096 x 3660 |

Each crop uses the existing building outline as its transparent clip mask. Exports use Canvas high-quality resampling and WebP quality 0.96. The existing `createIslandLife.drawBase` composition supplies the source artwork, including the approved workshop version and design-room detail patch. Original assets remain untouched.

Companion 1024 and 2048 long-edge variants use the same crop and mask. Runtime requests the appropriate level for the actual canvas pixel density and zoom, skips offscreen buildings and displays the existing island texture until the requested detail level is ready. Day/evening grading and vegetation overlays remain active.

Distant islands: retain original sprite colors and opacity. A cloud-only alpha matte extracted from the existing sky panorama occludes them; clear blue sky is excluded from that matte. Their visibility changes through cloud overlap, not a faded-island effect.

## Runtime update v63

All visible buildings now request their 4K source on the normal map, rather than waiting for a high pixel-density zoom threshold. The original small version is a temporary loading fallback. Once 4K is decoded, it remains the authoritative source at every zoom. Screen-size render caches are resampled from that 4K source to avoid repeating expensive downsampling each frame. `drawnSource` and `renderSize` in the scene snapshot distinguish the source resolution from the screen-size cache. Verification, simulation and manufacturing are explicitly checked at the initial map view.
