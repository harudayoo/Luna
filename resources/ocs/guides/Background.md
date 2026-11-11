# Background

A live canvas behind every page that changes character with the theme: a blueprint on paper in light, a drifting code graph at night.

| | Light: blueprint | Dark: dependency graph |
| --- | --- | --- |
| Idle | Teal grid, minor lines every 24px, major every 120px. Holds still. | Nodes and code glyphs (`{ }`, `</>`, `=>`) drift and link when close. |
| Pointer | Leaves a short amber ink trail that fades in 0.7s, with dashed teal guide lines through the cursor. | Nearby nodes move aside and draw faint violet lines to the cursor. |
| Click | Measuring rings spread from the point with a crosshair and its `x / y` coordinates. | A burst of brackets in violet and orchid flies out and fades. |
| Scroll | The grid slides at 30% of the scroll speed. | Layers move at different speeds for parallax. |

Colors come from `line`, `node`, `primary` and `accent`, and the mode switches the moment the theme changes.

Setup, once per page:

```html
<canvas class="ocs-bg" aria-hidden="true"></canvas>
<script>OrchidCity.background(document.querySelector('.ocs-bg'));</script>
```

Fixed behind everything (`z-index: -1`), never takes clicks, pauses when the tab is hidden, caps node count by screen size, and draws one still frame under `prefers-reduced-motion`. Content on top always sits on a solid `surface` or the plain `bg`, so text contrast never depends on the canvas.
