# ThemeToggle

A square icon button that switches light and dark, with a different transition each way.

- **To dark:** night spreads as a circle from the click point; the icon spins into a moon.
- **To light:** a fresh sheet of paper slides in from the left edge; the icon drops and bounces into a sun.
- Markup: `.ocs-btn.ocs-icon-btn` with `data-ocs="theme-toggle squish"` and the sun/moon SVG from the preview.
- The theme lives on `<html data-theme="light|dark">` and is saved in `localStorage` (`ocs-theme`). Call `OrchidCity.setTheme(OrchidCity.initialTheme())` in `<head>` to avoid a flash; it uses the saved choice, else the OS setting.
- Uses the View Transitions API; browsers without it and reduced-motion users get an instant switch.
- Listen for `ocs:theme` on `document` to react elsewhere.
