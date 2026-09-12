# External agent skills and visual verification policy

Status: applied as a scoped routing layer on the runnable Session A track.

This file extracts useful workflow, design, motion, and browser-testing practices from the listed public repositories. It does not copy their full contents or authorize a change to Three White Lights product direction.

## Selected upstream references

- Superpowers: https://github.com/obra/superpowers at commit b36e0829c6d0140e93cfef2ca599b1b07d4a7797
- Context7: https://github.com/upstash/context7 at commit 6f42b66f3b6dee20ba870dd6f70f1b565eb62e6e
- Anthropic skills: https://github.com/anthropics/skills at commit 34040c9c568585f6929bedeaad110ad08f079624
- UI UX Pro Max: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill at commit 7f69fed6a2717900085f1bc3b263721f8ba025e2
- Taste: https://github.com/Leonxlnx/taste-skill at commit ccbc15639c97057cbfcf32ecebc38ef716e4bb37
- Transitions: https://github.com/Jakubantalik/transitions.dev at commit 0b236ec0754fb7408d6291dca52484ecd8e10812

## Routing

- Superpowers engineering workflows: bounded planning, test-first behavior changes, systematic debugging, verification before claims, and fresh-context review.
- Anthropic webapp-testing: browser and responsive-flow verification where it adds coverage to existing tests.
- UI UX Pro Max: design-system and accessibility checklists for approved UI work.
- Taste: audit existing UI before changing it; infer audience, product, and design direction rather than applying a generic style.
- Transitions: reusable motion patterns, reduced-motion handling, and motion-performance review.
- Context7 or official documentation: version-specific framework and library references.

## Product-direction guard

The repository's VISION.md, GDD, accepted mockups, product decisions, and approved fixtures outrank any external design skill.

Before visual implementation:

1. Identify the current authoritative visual source.
2. Record any conflict between VISION, GDD, mockups, and existing implementation.
3. Stop and surface the conflict if the choices would produce materially different products.
4. Do not let UI UX Pro Max, Taste, or another external skill silently select the product direction.

Use design skills to improve an approved direction, not to invent a replacement.

## StageForge boundary

Three White Lights remains a separate lighthouse/game product. The current cross-repo result is ADAPTER_GAP: StageForge is PlayCanvas/WebGL2 with SceneManifest/GLB contracts, while Three White Lights is React Native, Expo, and Skia.

Do not create StageForge integration code from this policy. Any adapter requires a separate product decision and concrete demand evidence.

## Ownership

- Cursor Project and Cursor agents: visual, animation, UI, presentation, browser verification, and repo execution
- Grok Build: bounded backend and game-mechanics work only when requested by the Project
- Grok CoS: portfolio prioritization and escalation only

All completion claims require fresh evidence. Draft/no-merge PRs remain draft/no-merge unless Bryant explicitly authorizes a change.
