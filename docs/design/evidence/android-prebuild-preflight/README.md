# Android prebuild preflight — ANDROID_PREBUILD_PREFLIGHT, not NATIVE_BUILD

**What this is:** the record of `expo prebuild --platform android` run in a
DISPOSABLE copy of the project (`preflight.sh` — node_modules symlinked, the
generated `android/` read and thrown away; the repository's gitignored
`android/` stays absent). `preflight.json` is the machine record;
`prebuild-output.txt` is the command's own output. `measuredAt` in the record is the
commit the copy was taken from — re-taken at `02aceea4`, the EAS project-link
commit, after `owner` and `extra.eas.projectId` landed in `app.json`: the
record and the output came back byte-identical apart from the stamp.

**What this is not:** a native build. No Gradle ran here, no APK was produced
here, no device saw anything. NATIVE_BUILD is the owner's EAS cloud build —
now done, PASS, recorded in `../eas-cloud-build/` (ADR-001 §7) — and
NATIVE_RUNTIME is a runtime fact, `DEVICE_UNAVAILABLE` today.
This preflight only removes the class of failure a cloud build would report
back an hour later: a config plugin that refuses, an identity that did not
flow, a library that did not autolink.

## Result — PASS on every mechanical question

| Question | Answer |
| --- | --- |
| Prebuild exit | 0 |
| `namespace` / `applicationId` | `com.threewhitelights.app` (from `app.json` `android.package`) |
| `app_name` / Gradle root project | `Three White Lights` (from `app.json` `name`) |
| Deep-link schemes in the manifest | `threewhitelights` (ours — the dev route rides it) and `exp+three-white-lights` (the dev client's launcher, derived from `slug`) |
| `MainActivity` | exported, LAUNCHER intent, BROWSABLE VIEW intent, portrait |
| Rive + Nitro | `@rive-app/react-native` 0.4.20 and `react-native-nitro-modules` 0.35.10 both in the React Native autolinking config with their `android/` source dirs |
| Dev client | `expo-dev-client` 57.0.18, `expo-dev-launcher`, `expo-dev-menu` resolved by Expo autolinking; `EX_DEV_CLIENT_NETWORK_INSPECTOR=true` |
| Architecture | `newArchEnabled=true`, `hermesEnabled=true`, four ABIs |
| Updates | `expo.modules.updates.ENABLED=false` (no OTA in a dev build) |

## Warnings, reported and deliberately not fixed

- `» android: userInterfaceStyle: Install expo-system-ui in your project to
  enable this feature.` — `app.json` sets `userInterfaceStyle`; without
  `expo-system-ui` Android ignores it. Repository-owned. Not fixed tonight
  because the fix is a new dependency, and the night ruling moves no
  dependency the native build does not need. Owner's call: add
  `expo-system-ui` or drop the key.
- `› Using react-native@0.86.2 instead of recommended react-native@0.86.0.` —
  Expo SDK 57's recommendation versus the installed patch. Informational.
- Prebuild rewrites the copy's `package.json` scripts (`expo start --android`
  → `expo run:android`); the repository's scripts are untouched, and that is
  the normal prebuild edit, not a defect.

Reproduce: `OUT=<dir> bash docs/design/evidence/android-prebuild-preflight/preflight.sh`.
