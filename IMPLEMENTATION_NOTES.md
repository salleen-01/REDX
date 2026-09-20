# REDX implementation notes

## Implemented in this continuation

- Added a two-step instruction flow: Focus Track briefing, then Infinite or End Game briefing; Red Storm has its own briefing.
- Added a clear close X and a `LET'S PLAY` action to every instruction sheet.
- Removed the duplicate Settings & Profile button from below the game choices; settings remains in the top-right menu control.
- Added an exciting “CHOOSE YOUR ARENA” message above the Focus Track and Red Storm choices.
- Added platform-aware Exit Game behavior: Android uses `BackHandler.exitApp`, web attempts `window.close`, and iOS explains that the OS controls app termination.
- Reworked the gameplay layout so the arena is centered in the flexible middle region and action/status controls remain below it.
- Changed Expo app branding to `REDX` and regenerated the icon, splash, adaptive icon, monochrome icon, and favicon with a black background and centered red X.
- Added English comments around the new flow, persistence, lifecycle, audio, and round-state sections.

## Validation

- `pnpm check` — passed.
- `pnpm test -- --run` — passed: 7 tests passed, 1 existing auth test skipped.
- `expo export --platform web` — blocked by the existing Metro/react-native-css-interop cache SHA-1 issue for `node_modules/react-native-css-interop/.cache/web.css`; this is an environment/export-cache issue and does not affect TypeScript or Vitest validation.

## Run locally

```bash
pnpm install
pnpm dev
pnpm check
pnpm test
```
