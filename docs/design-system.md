# Design system (M02)

How the desktop app's visual identity is carried onto Android, and where this
port deliberately differs. Values here are transcriptions of real desktop
artifacts; `docs/desktop-audit.md` §2–§3 records where each one came from.

## Token layers

| File | Role |
| --- | --- |
| `src/theme/glacier-theme.scss` | The desktop's own tokens (`--color-*`, `--note-*`), transcribed verbatim, plus the shape/elevation values collected from its component SCSS. |
| `src/theme/variables.scss` | Maps those tokens onto Ionic's `--ion-*` variables, including the derived shade/tint companions and the `--ion-color-step-*` ramp. |
| `src/global.scss` | Base typography and the theme transition. |

Both theme files key off the body classes `.theme-dark` / `.theme-light`, not
`prefers-color-scheme`. That mirrors the desktop, whose `app.ts` toggles the same
two classes on `document.body`. Ionic's `dark.system.css` palette is deliberately
**not** imported — it keys off the media query and would fight the body classes.

`ThemeService` (`src/app/core/preferences/theme.service.ts`) owns those classes.
Its `mode` is `dark | light | system`, defaulting to `dark` for desktop parity;
`system` resolves through a `prefers-color-scheme` listener down to the same two
classes. Persistence arrives in M03 behind the same API.

### Derived Ionic values

Ionic only derives shades and tints for its own named palettes, so the
companions are precomputed with Ionic's convention — shade = ×0.88, tint = +10%
toward white. The `--ion-color-step-50 … 950` ramp is interpolated between each
theme's background and text colour. That ramp is what most Ionic components read
for backgrounds, dividers and disabled states; leaving it at Ionic's defaults is
what makes a "themed" Ionic app still look like stock Ionic.

`src/theme/variables.spec.ts` compiles the SCSS and asserts these values, so a
botched refactor fails CI instead of shipping.

## Deviation: light-theme accent contrast

The desktop pairs its light accent `#0d8ecf` with `--color-bg` `#f4f7fa`. Measured
contrast ratios:

| Pair | Ratio | WCAG AA (small text) |
| --- | --- | --- |
| `#4cc9f0` on `#0d1b2a` (dark) | 8.89:1 | pass |
| `#0d8ecf` on `#f4f7fa` | 3.37:1 | fail |
| `#0d8ecf` on `#ffffff` | 3.63:1 | fail |
| `#0b7db6` on `#ffffff` | 4.54:1 | pass |

`--ion-color-primary` keeps the desktop's `#0d8ecf` so the palette stays
traceable, but `--ion-color-primary-contrast` is `#ffffff` rather than the
desktop's `--color-bg`, and text-bearing accent fills use
`--glacier-accent-strong` (`#0b7db6` in light, `#4cc9f0` in dark). This is the one
place the Android port knowingly departs from the desktop tokens.

## Typography

Base 14px / 1.5 with the desktop's stack:

```
system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif
```

On Android this resolves to on-device Roboto. Nothing is bundled and no font is
fetched — a webfont request would violate the offline constraint.

## Icons

Font Awesome Free 7 solid, via `@fortawesome/angular-fontawesome`, which inlines
tree-shaken SVG paths. No webfont, no CDN, no network request. This is the same
FA generation the desktop uses, so the glyph outlines are identical.

Feature code imports from `src/app/shared/utilities/glacier-icons.ts` rather than
from the package directly, so the icon set stays enumerable and tree-shaking
stays predictable.

### Attribution

Font Awesome Free icons are licensed **CC BY 4.0**
(<https://fontawesome.com/license/free>). The obligation is to credit Font
Awesome. M11 surfaces this in the Settings screen's about section; until then
this file is the record.

## Brand mark

The desktop ships raster only (`build/icon.png`, 1024×1024, 8-bit RGB with no
alpha — a white page with a folded corner and a blue snowflake on navy). A flat
resize would give an adaptive icon with a baked-in background and no monochrome
layer, so the mark was **re-vectorized** as `src/assets/brand/glacier-icon.svg`.

That is a recreation, not an extraction. Its geometry and palette were measured
from `build/icons/1024x1024.png` and are reproduced here so the drawing can be
re-derived:

| | Value (on a 1024 canvas) |
| --- | --- |
| Navy field | `#041731` |
| Page | `#ECEEF3`, x 253–775, y 157–831, corner radius 60 |
| Fold cut | (620, 157) → (775, 312) |
| Fold flap / curl shadow | `#D8DFE9` / `#93A8C2` |
| Snowflake | `#54C1F3`, bounding box 375×435 at (324, 315) |

The snowflake is Font Awesome's solid `snowflake` path rather than a trace of the
raster. Its stroke weight is slightly lighter than the desktop raster's flake;
the structure is identical.

Note the navy here is `#041731`, the icon artwork's own field colour — not the
app's `--color-bg` `#0d1b2a`. The two differ on the desktop as well.

### Generated Android resources

All derived from that one SVG:

| Resource | Contents |
| --- | --- |
| `drawable/ic_launcher_foreground.xml` | Page + snowflake, sized to sit within the 108dp viewport's safe zone |
| `drawable/ic_launcher_monochrome.xml` | Snowflake alone — matching the desktop's `build/tray.png`, which is exactly that |
| `values/colors.xml` | `glacier_navy` `#041731`, aliased by `ic_launcher_background` |
| `mipmap-*/ic_launcher*.png` | Legacy launcher rasters rendered from the SVG |

Because the paths mix absolute and relative commands, the Font Awesome glyph is
positioned with a `<group>` transform rather than by rewriting its coordinates —
scaling the numbers in place silently distorts it.

The splash uses the Android 12 `Theme.SplashScreen` attributes rather than the
starter's `android:background` drawable, which that API ignores. Its animated
icon is `ic_launcher_foreground` because the system masks the icon to a circle:
a drawable that fills its viewport gets its corners chamfered, whereas the
adaptive foreground is already laid out for that safe zone. The starter's 11
`splash.png` variants are gone.

## System bars

`targetSdk 36` makes the window edge-to-edge, but the app only gets to paint
behind the bars on WebView >= 140. Below that Chromium reports no safe-area
insets ([crbug 40699457](https://issues.chromium.org/issues/40699457)), so
Capacitor's `SystemBars` plugin pads the WebView natively instead. Two things
follow, and both are load-bearing:

- `AppTheme.NoActionBar` sets `android:windowBackground` to
  `glacier_window_background`, since that colour is what shows in the padding.
  It is a DayNight resource: the light theme's `--color-bg` in `values/`, the
  dark theme's in `values-night/`. Left at the AppCompat default it renders as
  white bands behind the status and gesture bars.
- `ThemeService` therefore picks the status bar glyph style from whatever
  actually paints behind the bars. On the padded path that is
  `windowBackground`, which follows the Android night mode rather than the
  in-app theme, so following `resolved()` there would put light glyphs on a
  light band.

`src/global.scss` still applies `--ion-safe-area-*` to the first toolbar, the
content bottom and the FAB. Those are zero on the padded path and take real
values once the WebView is new enough, so the same stylesheet covers both.
