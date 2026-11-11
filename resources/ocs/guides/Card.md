# Card

A solid `surface` block on the page: square corners, no border, no resting shadow; clickable cards react to the pointer and open into a detail view, differently in each theme.

| | Light (paper) | Dark (code) |
| --- | --- | --- |
| Hover | Picked up like a sheet: lifts up-left, turns under a degree, hard ink shadow. | Tilts toward the pointer in 3D, a soft violet spotlight follows it. |
| Open | A sheet drops onto the desk with a slight turn and settles; lines slide in from the left as if written. Backdrop is a plain ink tint. | The card grows into the panel (FLIP); lines rise in. Backdrop blurs the page. |
| Close | The sheet slides down and away. | The panel shrinks back into the card. |

- Static card: `.ocs-card` only.
- Clickable card: add `data-ocs="tilt"`, `tabindex="0"`, `role="button"`.
- Detail: `OrchidCity.expand(card, { render })`; give lines inside the panel `.ocs-reveal` to animate them. Esc, the backdrop or `[data-ocs-close]` closes it.
- `.ocs-eyebrow` above the title (SERVER, TICKET), `.ocs-code` for hostnames and ticket IDs. Padding `space-4` on phones, `space-6` from `bp-sm`.
