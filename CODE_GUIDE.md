# REDX code guide

This guide accompanies the inline comments in the source files. The game is an Expo Router React Native app that also runs through Metro on the web.

## Where to modify the game

The main screen is `app/(tabs)/index.tsx`. It owns onboarding, language selection, local persistence, menus, instruction sheets, gameplay phases, audio, haptics, and result actions. The large `COPY` object near the top contains the English and Arabic interface strings, including legal text, settings, guide content, and dynamic gameplay labels. Keep the same keys in both language objects when adding text.

Arabic layout uses both `rtlText` (text alignment and writing direction) and `rtlRow` (actual `row-reverse` flex layout). Apply `rtlRow` to any new horizontal container containing a label, button, icon, header, card, or status indicator. English intentionally leaves these styles off, preserving normal left-to-right ordering.

Branding assets live in `assets/images`. `icon.png` is the 1024×1024 primary app icon and is also used on the first screen so the logo matches the dark REDX palette. `android-icon-foreground.png`, `android-icon-background.png`, and `android-icon-monochrome.png` are the Android adaptive-icon layers. `splash-icon.png` is the dark splash artwork, while `favicon.png` is the web icon. `scripts/prepare_brand_assets.py` can be rerun after replacing the supplied source images.

Numeric difficulty rules are isolated in `lib/redx-game.ts`. Change `CAMPAIGN_LEVELS` for the finite End Game table. Change `getLevelConfig` for Infinite mode. `balls` controls how many targets are rendered and `ballSize` controls their diameter; Focus Track intentionally increases the first and decreases the second. `getStormConfig` is independent and controls Red Storm.

## Persistence

`AsyncStorage` stores three local records: `redx-progress-v2` for best progress, `redx-onboarding-v2` for onboarding completion, and `redx-profile-v2` for the player name, avatar, settings, and language. These records are device-local. Clearing app data or uninstalling the app removes them.

## Adding a level

For End Game, add or edit an entry in `CAMPAIGN_LEVELS` and keep its `ballSize`, `balls`, and challenge values explicit. For Infinite, adjust the formulas and caps in `getLevelConfig`. Add or update assertions in `tests/redx-game.test.ts` whenever difficulty rules change.

## Publishing

`app.config.ts` defines the REDX app name, stable Android package, iOS bundle identifier, icons, splash screen, and native plugins. `eas.json` contains the `preview-apk` profile, which creates an installable Android APK with `eas build --platform android --profile preview-apk`.

Never commit Expo tokens, signing credentials, or other secrets. Supply the Expo token through the `EXPO_TOKEN` environment variable only when running the EAS command.

## Validation

Run `pnpm check` for TypeScript and `pnpm test -- --run` for the Vitest suite. Run `pnpm dev:metro` to inspect the browser preview. Native Android requires an available Android SDK/emulator or an EAS artifact.
