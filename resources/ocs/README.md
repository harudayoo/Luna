# Orchid City Software

The design system for Orchid City Software's in-house mini apps: the internal tools we build and run on the OCSPH office server for our own team, not the products we make for clients. They have to feel clear and quick to use first; the motion is where the personality lives, and each theme has its own.

## Two personalities

The two themes are complements, not inverses. They share layout, type, square edges and the no-outline rule, but differ in color and in how things move.

| | Light: Paper | Dark: Code |
| --- | --- | --- |
| Mood | A drafting desk in daylight: warm paper, amber ink, teal blueprint lines | A terminal at night: near-black, violet glow, orchid sparks |
| Colors | amber `primary`, teal `accent` | violet `primary`, orchid `accent` |
| Lift | Hard ink offset shadow, like a paper cutout | Soft violet glow |
| Motion | Short, physical, settles fast: lift, stamp, draw, type | Floaty, springy, digital: drift, glow, scramble |
| Background | Blueprint grid, ink trail, measuring rings | Drifting dependency graph, bracket bursts |

## Principles

- **Calm surfaces, playful motion.** Colors and layout stay quiet. The fun lives in quick motion on hover, press and transition.
- **No outlines.** Cards and buttons never get a border or outline. They separate from the page by a solid shade, never a line. The light theme's hard offset shadow is a solid shape, not a stroke.
- **Square edges.** `radius-none` everywhere. `radius-sm` (2px) only for tiny badges and inputs.
- **Software at heart.** Blueprints by day, code graphs by night, IDs in mono. Office data stays the hero: tickets, requests, hostnames, numbers.
- **Respect the user.** Every animation turns off under `prefers-reduced-motion`, and pointer-follow effects skip touch.

## Colors

| Token | Light (paper) | Dark (code) | Use |
| --- | --- | --- | --- |
| `bg` | #fffdf8 | #06020c | Page |
| `surface` | #f7efe1 | #140a24 | Cards, panels, nav |
| `surface-hover` | #f1e4cc | #1d1033 | Hovered or expanded surface |
| `ink` | #1f1608 | #f1e9ff | Main text |
| `muted` | #5e4f38 | #ada0c4 | Secondary text |
| `primary` | #9a4700 amber | #b794ff violet | Main actions, links, active nav |
| `accent` | #0f766e teal | #f0abfc orchid | Brand accent, used sparingly |
| `success` / `danger` | #0f6b4a / #8a1c3b | #6fe0b0 / #ff8fa8 | Approved or paid / denied or error |

Every text pair passes 4.5:1 in both themes. `line` and `node` are only for the background, never borders.

## Motion

All motion runs on **Anime.js 4.5.0** (global `anime`) plus the helpers in `ocs.js` (global `OrchidCity`). Load order: `anime.umd.min.js`, then `ocs.js`, then `OrchidCity.init()`. Each helper checks the theme on every interaction, so one set of attributes gives both personalities.

| `data-ocs` / call | Light (paper) | Dark (code) |
| --- | --- | --- |
| `magnetic` | Lifts up-left off a hard shadow | Drifts toward the pointer, shine sweep, spring back |
| `wave` | Pencil underline draws in | Letters hop in a wave |
| `decode` | Typewriter retype with caret | Scramble through code characters |
| `squish` | Stamp onto its shadow | Jelly squish |
| `tilt` (cards) | Picked up like paper, turns a degree | 3D tilt with spotlight |
| `OrchidCity.expand` | Sheet drops onto the desk | Card grows into the panel |
| `theme-toggle` | Paper slides in from the left | Night spreads in a circle |
| `OrchidCity.background` | Blueprint grid, ink trail, measuring rings | Code graph, bracket bursts |

Timings: `dur-fast` 160ms presses, `dur-base` 320ms hovers, `dur-slow` 560ms view changes. Light eases with a small overshoot and settles fast (`outBack`); dark uses springs (`anime.spring({ bounce: .55 })`).

Keep it subtle: one primary per area, nothing loops on its own except the dark background, and nothing moves content the user is reading.

## Themes

Light and dark live on `<html data-theme>`. Put this in `<head>` to avoid a flash:

```html
<script>try{document.documentElement.setAttribute('data-theme',localStorage.getItem('ocs-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'))}catch(e){}</script>
```

## Responsive

Mobile first, breakpoints `bp-sm` 640, `bp-md` 768, `bp-lg` 1024, `bp-xl` 1280. See AppShell for the layout at each size. Tap targets are 40px or more.

## Type

System fonts so apps load fast on the office LAN. `sans` for UI, `mono` for hostnames, ticket IDs, ports, logs, eyebrows and code buttons.

## Starter page

```html
<html data-theme="light">
<head>
  <link rel="stylesheet" href="tokens.css">
  <link rel="stylesheet" href="ocs.css">
</head>
<body>
  <canvas class="ocs-bg" aria-hidden="true"></canvas>
  <button class="ocs-btn ocs-btn-primary" data-ocs="magnetic squish">New request</button>
  <script src="vendor/anime.umd.min.js"></script>
  <script src="ocs.js"></script>
  <script>
    OrchidCity.background(document.querySelector('.ocs-bg'));
    OrchidCity.init();
  </script>
</body>
</html>
```

In a Laravel + Vite app you can instead `npm i animejs@4.5.0`, `import * as anime from 'animejs'`, set `window.anime = anime`, then import the bundle.
