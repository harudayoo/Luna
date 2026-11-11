# Button

Solid, square buttons with no outline; every behavior has a paper personality in light and a glow-and-code personality in dark.

| Markup | Light (paper) | Dark (code) | Use for |
| --- | --- | --- | --- |
| `.ocs-btn-primary` + `data-ocs="magnetic squish"` | Lifts up and left off a hard ink shadow like a paper cutout. | Drifts toward the pointer, label drifts further, a shine sweeps across, springs home. | The main action. One per view. |
| `.ocs-btn-secondary` + `data-ocs="wave squish"` | A pencil underline draws in from the left and the letters lean for a moment. | Letters hop in a quick wave. | Everything else. |
| `.ocs-btn-code` + `data-ocs="decode squish"` | Text is erased and retyped like a typewriter, with a caret. | Text scrambles through code characters, then resolves. | Run, Generate, Sync, Export. |
| `.ocs-btn-accent` | Teal. | Orchid. | Rare brand moments. |
| Press (`squish`) | Stamp: slams down onto its shadow, pops back. | Jelly squish with a spring. | All buttons. |

All effects use Anime.js and turn off under `prefers-reduced-motion`. Pointer-follow and lift effects skip touch, so phones only get the press. Combine behaviors in `data-ocs` and call `OrchidCity.init()` once. The theme is checked on every interaction, so switching themes never needs a re-init.
