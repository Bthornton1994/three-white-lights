#!/usr/bin/env bash
# preflight.sh — THE COMMANDS BEHIND `preflight.json` BESIDE IT.
#
# A DISPOSABLE Android prebuild: the project files are copied to a scratch
# directory (node_modules symlinked), `expo prebuild --platform android` runs
# there, and the generated `android/` is READ — manifest, gradle identity,
# strings, autolinking — then thrown away. Nothing is written into the
# repository; `android/` stays gitignored and absent. The label this earns is
# ANDROID_PREBUILD_PREFLIGHT, never NATIVE_BUILD: no Gradle ran, no APK exists,
# the cloud build is the owner's (ADR-001 §7, OWNER_BLOCKED_EXPO_AUTH).
#
#   usage: OUT=<dir> bash docs/design/evidence/android-prebuild-preflight/preflight.sh
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../../../.." && pwd)"
OUT="${OUT:?set OUT to the directory the record is written to}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$REPO"
for f in app.json package.json package-lock.json eas.json metro.config.js babel.config.js tsconfig.json index.ts App.tsx; do [ -f "$f" ] && cp "$f" "$WORK"/; done
cp -r assets src "$WORK"/
ln -s "$REPO/node_modules" "$WORK/node_modules"
cd "$WORK" && git init -q .
set +e
CI=1 EXPO_NO_TELEMETRY=1 npx expo prebuild --platform android --no-install > "$OUT/prebuild-output.txt" 2>&1
EXIT=$?
set -e
echo "PREBUILD_EXIT=$EXIT" >> "$OUT/prebuild-output.txt"
node - "$WORK" "$OUT" "$EXIT" "$(git -C "$REPO" rev-parse HEAD)" <<'NODE'
const [work, out, exit, sha] = process.argv.slice(2);
const fs = require('node:fs'); const path = require('node:path'); const { execSync } = require('node:child_process');
const read = (p) => fs.readFileSync(path.join(work, p), 'utf8');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const gradle = read('android/app/build.gradle');
const props = read('android/gradle.properties');
const strings = read('android/app/src/main/res/values/strings.xml');
const rn = JSON.parse(execSync('npx expo-modules-autolinking react-native-config --platform android --json', { cwd: work, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const expo = JSON.parse(execSync('npx expo-modules-autolinking resolve --platform android --json', { cwd: work, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const prop = (k) => (props.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1] ?? null;
const log = fs.readFileSync(path.join(out, 'prebuild-output.txt'), 'utf8');
const record = {
  label: 'ANDROID_PREBUILD_PREFLIGHT',
  notA: ['NATIVE_BUILD', 'NATIVE_RUNTIME'],
  measuredAt: sha,
  prebuildExit: Number(exit),
  identity: {
    namespace: (gradle.match(/namespace '([^']+)'/) || [])[1] ?? null,
    applicationId: (gradle.match(/applicationId '([^']+)'/) || [])[1] ?? null,
    versionCode: Number((gradle.match(/versionCode (\d+)/) || [])[1]),
    versionName: (gradle.match(/versionName "([^"]+)"/) || [])[1] ?? null,
    appName: (strings.match(/name="app_name">([^<]+)</) || [])[1] ?? null,
    rootProjectName: (read('android/settings.gradle').match(/rootProject.name = '([^']+)'/) || [])[1] ?? null,
  },
  manifest: {
    schemes: [...manifest.matchAll(/<data android:scheme="([^"]+)"\/>/g)].map((m) => m[1]),
    mainActivityExported: /android:name="\.MainActivity"[^>]*android:exported="true"/.test(manifest),
    launcherIntent: /android\.intent\.category\.LAUNCHER/.test(manifest),
    browsableViewIntent: /android\.intent\.category\.BROWSABLE/.test(manifest),
    updatesEnabled: (manifest.match(/expo\.modules\.updates\.ENABLED" android:value="([^"]+)"/) || [])[1] ?? null,
    screenOrientation: (manifest.match(/android:screenOrientation="([^"]+)"/) || [])[1] ?? null,
  },
  gradleProperties: { newArchEnabled: prop('newArchEnabled'), hermesEnabled: prop('hermesEnabled'), reactNativeArchitectures: prop('reactNativeArchitectures'), devClientNetworkInspector: prop('EX_DEV_CLIENT_NETWORK_INSPECTOR'), edgeToEdgeEnabled: prop('edgeToEdgeEnabled') },
  autolinking: {
    reactNativeLibraries: Object.keys(rn.dependencies ?? {}).sort(),
    expoModules: (expo.modules ?? []).map((m) => m.packageName).sort(),
    rive: '@rive-app/react-native' in (rn.dependencies ?? {}),
    nitro: 'react-native-nitro-modules' in (rn.dependencies ?? {}),
    devClient: (expo.modules ?? []).some((m) => m.packageName === 'expo-dev-client'),
    devLauncher: (expo.modules ?? []).some((m) => m.packageName === 'expo-dev-launcher'),
  },
  versions: {
    riveReactNative: JSON.parse(read('node_modules/@rive-app/react-native/package.json')).version,
    nitroModules: JSON.parse(read('node_modules/react-native-nitro-modules/package.json')).version,
    expoDevClient: JSON.parse(read('node_modules/expo-dev-client/package.json')).version,
    reactNative: JSON.parse(read('node_modules/react-native/package.json')).version,
    expo: JSON.parse(read('node_modules/expo/package.json')).version,
  },
  warnings: log.split('\n').filter((l) => /»|Using react-native@|not supported/.test(l)).map((l) => l.trim()),
  filesGenerated: fs.readdirSync(path.join(work, 'android')).sort(),
};
fs.writeFileSync(path.join(out, 'preflight.json'), JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify(record, null, 2));
NODE
