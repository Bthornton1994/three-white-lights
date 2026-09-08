# EAS cloud build — NATIVE_BUILD, not NATIVE_RUNTIME

**What this is:** the record of the Android development build that closes
the NATIVE_BUILD gate, **supplied by the owner and not measured here.**
`build.json` beside this file carries the identifiers. Bryant ran the
official EAS flow on a machine outside this sandbox, from the visual branch
at the project-link commit `02aceea4`, and reported the result; this lane
recorded it.

| Field | Value |
| --- | --- |
| Expo owner | `bthornton1994s-team` |
| Project | `@bthornton1994s-team/three-white-lights` |
| EAS project ID | `37ea7a85-87f5-49fd-a63a-edea55ece38f` (now `extra.eas.projectId` in `app.json`) |
| EAS build ID | `29d41836-300d-4958-aec5-adbe4d920724` |
| Platform / profile | Android / `development` (`eas.json`: development client, internal distribution, APK) |
| Artifact | Android development APK (`expo-dev-client`) |
| Result | **PASS** |

**Why it was built outside the sandbox, recorded so nobody retries it:**
`api.expo.dev:443` is denied at this environment's egress proxy — the proxy
status endpoint logs `gateway answered 403 to CONNECT (policy denial)` for
that host, and its own README says a 403 is an organisation policy denial
to report, not to retry or route around. `eas whoami`, `eas init` and
`eas build` are all API calls, so none of them can run from here whatever
credential is present. The ruling of 2026-09-08 that followed says the
same in the imperative: do not attempt Expo networking from this sandbox
again.

**What this closes, and only this:**

| Gate | State |
| --- | --- |
| ANDROID_PREBUILD_PREFLIGHT | PASS — `../android-prebuild-preflight/`, re-taken at `02aceea4` (the two link keys changed nothing) |
| NATIVE_BUILD | **PASS** — this record |
| NATIVE_RUNTIME | **NOT RUN — DEVICE_UNAVAILABLE.** No Android phone exists; no emulator in this sandbox. A green build is not a running runtime, and this record is never read as one. |
| RIVE_NATIVE_DIAGNOSTIC | **NOT RUN.** Whether `@rive-app/react-native` loads a `.riv`, binds a ViewModel and draws on Android is unmeasured. |

**Not claimed:** native Rive success; device performance; the deep link
opening the spike on a device; any measurement taken from the APK. The
procedure that would take those measurements — on an emulator or a
device, whichever arrives first — is written out in ADR-001 §7, step by
step, for later execution.
