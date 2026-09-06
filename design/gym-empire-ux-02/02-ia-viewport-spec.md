# 02 — IA / viewport spec

Factory UX-02 `02-ia-viewport-spec.md` was **UNMOUNTED** on this Cloud. This
file records the IA already on GymScreen plus the evidence viewport already
used in GDD / capture. It is not a new information architecture.

## Canonical evidence viewport

Chromium **390×844** (GDD Empire player-surface). Capture also logged 375 /
430 / tablet / desktop. Gym fills the viewport; html/body/`#root` paint
`iron.void` so leftover is not a white letterbox.

## Surfaces (weighted, not equal pills)

| Surface | Role |
| --- | --- |
| Play (Gym home) | Inhabited full-bleed room. Overlay HUD + dock. No placement grid. |
| Build | Same room; grid + occupancy editor; amber FAB reads DONE. |
| Inspect | Dock-cleared sheet over the floor. Hit at FAB is the station sheet. |
| Shop | Charcoal sheet over the gym. FAB hidden. |
| Staff | Charcoal sheet over the gym. FAB hidden. |
| More | Settings. First control is amber BACK TO TRAINING (leave-gym). Developer never here. |

BUILD is a FAB, not a dock peer. Dock: `iron.surface` with `amber.action` top
edge; Gym home weight uses named CSS `sienna` (not a sixth token).

## Developer

Not a player surface. See `03-developer-packet.md`.
