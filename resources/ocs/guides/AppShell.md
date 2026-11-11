# AppShell

The mobile-first page frame for every Orchid City app: bottom tabs on phones, an icon rail on tablets, a full labeled sidebar on laptops and up.

| Width | Layout |
| --- | --- |
| under `bp-md` (768px) | Top bar, single-column content, bottom tab bar with 4 items max. Cards stack, two columns from `bp-sm` (640px). |
| `bp-md` to `bp-lg` | Top bar, 56px icon rail on the left, two-column card grid. |
| `bp-lg` (1024px) and up | 200px sidebar with labels, three-column card grid. Center content at 1200px max from `bp-xl`. |

Rules:

- Write phone styles first, then add `min-width` media queries at the breakpoint tokens.
- Tap targets are at least 40px tall (buttons already are).
- Sidebar and tab bar are solid `surface` with the active item filled `primary`, no borders or underline bars.
- Tables become stacked cards under `bp-sm`.
- The Background canvas stays behind the whole shell; the shell itself stays solid so text is always readable.
