# Historical visual observations — 2026-09-30

## Evidence limits

This is a read-only critic's observation record of a running **uncommitted working tree that was subsequently lost in a workspace rollback**. It is not a formal gauntlet pass, a production readiness pass, or evidence for any later restored commit.

The binding reference inspected was `docs/design/IRON-AND-AMBER-REFERENCE.md` and its actual `iron-and-amber-reference.jpeg`. Relevant GDD experience, art, §12.2 critic bars, §12.3 refusal conditions, CLAUDE.md critic restrictions, and `.claude/agents/critic.md` were read.

The legacy formal gate `node tools/evidence.mjs suite --verify` exited 1: no suite bundle, uncommitted code, and unreadable legacy shot records. No formal grade was made.

The old server at 127.0.0.1:5173 could not be reached from a fresh execution session. Per root's instruction, the observer spawned Vite on 127.0.0.1:5177 and Chromium in the same execution, then killed only that child server. Chromium executable was `/workspace/scratch/4fc55cb00998/tooling/browser-manual/chrome-headless-shell-linux64/chrome-headless-shell`. Screenshots and observational scripts were written only outside the product repository, under `/workspace/scratch/4fc55cb00998/critic-observations`.

**Those screenshots and scripts are no longer available.** The directory was confirmed absent after rollback. This record preserves exact text/geometry results retained in the critic's tool history; screenshot pixels and bytes cannot be recovered from that history. Reproducibility is therefore limited. A fresh review of an immutable restored source checkpoint is required.

## Screens actually observed

The observer opened the live Gym, Shop, and Build screens at:

| Viewport | Width × height |
|---|---:|
| Desktop | 1440 × 1000 |
| Phone | 390 × 844 |
| Short phone | 390 × 667 |

Fresh browser pages loaded meaningful Gym content. The collected browser log across those pages contained `ERRORS []`: no observed JavaScript page error, error-level console output, or failed request. The measured document horizontal overflow was 0 at each route and viewport. Headings used Barlow/Impact/sans-serif; desktop h1 was 64px, mobile Gym h1 48px, and compact Build h1 38px.

The actual full-page screenshots of mobile Gym, mobile Build, short Build, and desktop Gym were opened and visually inspected. The environment had warm amber light, brick, dark espresso panels, cream athletic type, illustrated equipment, and illustrated ambient members. This direction matched the binding reference's broad palette and material language. That limited observation does **not** establish full visual acceptance, the lifter animation bar, or production readiness.

The initial practice Gym showed 0 Gym Bucks, 60/hr income, three owned items, and "1 training · 1 waiting". Shop showed owned Power bar/Competition plates/Competition bench and disabled unaffordable/locked purchases. The screenshot collection did not test purchasing.

## Real placement interactions

At each viewport, the observer entered Build through the visible `Build gym` button, selected `flat-bench` through the labeled Equipment select, then filled the labeled Column and Row inputs. No forced clicks or injected facility state were used.

| Input | Actual visible status | Actual Place item state |
|---|---|---|
| Column 8, row 6 | The whole item must fit inside the floor. | Disabled |
| Column 1, row 1 | This space overlaps another item. | Disabled |
| Column 6, row 3 | Clear space. Ready to place. | Enabled |

At all three sizes, clicking enabled `Place item` produced the actual visible message "Competition bench placed." Clicking `Return to storage` produced "Equipment returned to storage." and removed `.room-equipment--flat-bench` from the live room. Clicking `Cancel` returned to the visible Garage gym heading.

A physical mouse click at the bounding-box center of the rendered tile button named `Place Competition bench at column 8, row 6` hit that exact button and updated Column/Row to 8/6 at all three viewports. This establishes that one tile's physical center worked; it does not establish all grid tiles are individually hittable.

### Drawer geometry

The observer computed each button's DOM bounding box, used `document.elementFromPoint` at its center, and recorded whether the resulting element belonged to that button. These are the actual selected-bench, clear-placement measurements before action clicks:

| Viewport | Control | y | Height | Mobile nav top | Center hit target |
|---|---|---:|---:|---:|---|
| Desktop | Cancel | 675.3125 | 48 | Hidden | Cancel |
| Desktop | Place item | 675.3125 | 48 | Hidden | Place item |
| Desktop | Return to storage | 737.3125 | 30 | Hidden | Return to storage |
| Phone 390×844 | Cancel | 670 | 44 | 770 | Cancel |
| Phone 390×844 | Place item | 670 | 44 | 770 | Place item |
| Phone 390×844 | Return to storage | 720 | 26 | 770 | Return to storage |
| Short phone 390×667 | Cancel | 540.5 | 44 | 593 | Cancel |
| Short phone 390×667 | Place item | 540.5 | 44 | 593 | Place item |
| Short phone 390×667 | Return to storage | 590.5 | 26 | 593 | Gym |

## Single concrete unresolved finding

On the short phone, `.placement-drawer .remove-action` (`Return to storage`) initially extended from y590.5 to y616.5 while the fixed `.mobile-nav` began at y593. Its center was physically intercepted by the Gym nav button. This fails a claim that every drawer control is immediately above navigation.

The real Playwright locator click scrolled the drawer and then succeeded; removal was observed. This is an initially obscured action, **not** evidence that removal is impossible. A follow-up manual scroll/hit review was not completed before rollback, so the report does not decide whether the available scroll reveal meets the product bar.

The available screenshot names before loss were `short-build-clear.png` and `short-build-storage.png` for that selected short-phone state; they must not be cited as currently accessible evidence.

## Not completed

The rollback occurred before the critic walked real training sets or verified all six illustrated athlete poses, audio control, asset failure/loading behavior, an empty facility composition, keyboard focus flow, or all placement grid hit targets. No haptic or lift-feel grade was attempted. A full GDD refusal-condition sweep was not completed. These areas remain unverified by this critic.

## Next review

Restore and freeze source, attach exact commit/tree provenance to fresh browser evidence, then redo desktop, 390×844, and 390×667 flows. Keep this historical record separate from that final review.
