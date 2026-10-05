# Three White Lights: rebuild the gym into a living, playable world

## Objective

Execute a substantial rebuild of Three White Lights’ Gym and Build experience.

The owner has rejected the current implementation. It feels like a static background with equipment images layered over it. Working buttons and passing browser tests do not satisfy the product goal.

Deliver a gym that players can inhabit, understand, customize, and watch respond to their decisions. Use the Iron & Amber mockup as the binding visual direction. Set the quality bar through comparisons with polished gym management games while preserving TWL’s identity as a powerlifting sports game.

Complete implementation, integration, testing, and independent artifact review. A plan, mockup, isolated renderer demo, or cosmetic reskin is an intermediate output.

## Repository and references

Repository: https://github.com/Bthornton1994/three-white-lights

Review branch: `codex/production-iron-amber`
Existing draft PR: https://github.com/Bthornton1994/three-white-lights/pull/89
Verified starting reference: `61605a64a11c7562f51af54dac2f2c7fe3dc7779`

Fetch the latest branch before editing. Preserve subsequent work and inspect current worktree ownership and coordination claims.

Live baseline:
https://three-white-lights-iron-amber.bthornton9415.chatgpt.site

Read and inspect:

- `AGENTS.md`, `CLAUDE.md`, `VISION.md`, and `README.md`
- `docs/GDD.md`, especially the Gym Empire specification, architecture rules, hard constraints, and Powerlifting Sports Universe Doctrine
- `docs/design/IRON-AND-AMBER-REFERENCE.md`
- `docs/design/iron-and-amber-reference.jpeg`
- `web/src/Gym.tsx`, its styles, and the facility adapter
- `src/facility/**`, including placement, floor simulation, living members, station capabilities, management, and persistence contracts
- The native gym presentation and current release instructions

Benchmark sources to inspect:

- https://apps.apple.com/us/app/idle-fitness-gym-tycoon-game/id1478629374
- https://store.steampowered.com/app/756300/Gym_Empire__Idle_Gym_Tycoon_Management/

Use current official screenshots and gameplay footage to examine scene readability, activity, construction feedback, and visible progression. Distinguish store-page inspection from actually playing a competitor. Borrow interaction principles, never proprietary art, characters, interface layouts, or branding.

## Product direction

TWL’s ambition is the definitive powerlifting sports game: build a lifter, master the lifts, compete, and leave a legacy.

The gym supports that experience. It should feel like the athlete’s home and an evolving powerlifting community. Preserve the importance of training and meet day.

Iron & Amber means:

- Warm brick, dark steel, charcoal, espresso, and amber light
- Cohesive illustrated environments and believable athletic characters
- Strong sporting typography with restrained interface chrome
- A mobile composition dominated by the playable gym
- Equipment, people, shadows, and effects that occupy the same physical space

Keep this direction consistent across Gym, Build, Shop, and Staff.

## 1. Replace the collage with a coherent scene

Build a scene architecture with one consistent model for:

- Floor coordinates and equipment footprints
- Camera projection, scale, and viewport fitting
- Actor and equipment anchors
- Depth ordering and occlusion
- Lighting and contact shadows
- Selection, hit testing, and placement previews

The floor grid must align with the rendered floor. People must stand on it. Equipment must share its perspective and scale.

Use modular floors, walls, fixtures, equipment, and characters. Usable equipment must be represented by game state rather than permanently painted into a background.

Sprites are acceptable when authored and rendered as coherent, animated world entities. Adding movement to the existing mismatched cutouts is insufficient.

Choose the rendering approach after proving it inside the actual application. Prefer existing compatible capabilities. Evaluate StageForge assets or tooling where useful, and verify any adapter before claiming integration. Avoid an unrelated engine migration.

Fix the currently hosted browser surface and deliver consistent gym presentation for the native application through shared scene contracts and production assets. State exact platform coverage in the handoff.

## 2. Make Build mode feel like building

Implement direct manipulation as the primary interaction:

- Select equipment by tapping it in the world or choosing it from a compact inventory drawer.
- Drag a correctly scaled preview onto the floor.
- Snap to valid positions using the same coordinate model as rendering.
- Show the complete footprint and clear valid/invalid feedback.
- Explain blocked placement through a short contextual message.
- Support rotation with correct footprints, collision checks, rendering, and persistence.
- Provide place, cancel, return-to-storage, and undo for the last layout edit.
- Keep camera gestures distinct from equipment gestures.
- Keep the selected object and necessary controls visible on a small phone.

Retain an accessible keyboard alternative. Column and row entry may remain as a secondary option.

Implement every exposed action through the authoritative facility path. Undo must respect current revisions and avoid overwriting newer changes.

Purchase, placement, save, and failure feedback must be immediate and truthful. Prevent duplicate purchases and accidental double commits.

Use restrained placement animation, sound, and supported haptic feedback. Expose timing values for tuning and respect mute and reduced-motion settings.

## 3. Bring the gym’s inhabitants to life

Use the existing deterministic floor simulation and living-member data. Preserve useful domain work.

Render legible behavior:

- Members approach appropriate stations.
- Queues appear at sensible locations.
- Station use visibly matches the equipment.
- Lifters leave equipment and continue their routines.
- Moving or removing equipment causes the defined interruption and replanning behavior.
- Hired staff have visible, state-supported activity.

A person using a rower must not display a bench-press pose. Bodies must remain anchored, correctly occluded, and visually separated.

Preserve member identity and simulation progress across routine check-ins, purchases, and layout changes. Eliminate renderer-driven resets that make the population restart.

Build mode must remain visibly connected to the living gym. Displayed activity counts must match what the player can observe.

## 4. Make decisions produce visible consequences

Expose existing facility systems through the world.

Demonstrate an understandable sequence:

1. The player notices a real queue, inaccessible station, maintenance need, or capacity limit.
2. The player selects a supported layout change or upgrade.
3. The change commits through the domain.
4. Members and equipment visibly respond.
5. The player can understand the resulting improvement.

Show supported capacity and throughput upgrades accurately. Additional usable capacity should appear as usable capacity. Defined changeover improvements should affect the corresponding behavior.

Distinguish visual flavor from mechanical effects. Do not fabricate income bonuses, training gains, demand, or staff benefits for presentation.

Make garage, storage, neighborhood, and warehouse progression visibly different in space and layout. Changing a title over the same background fails this requirement.

Connect the gym to the persistent lifter through actual identity, training context, and available career history. Displays of records or achievements must come from real results.

## 5. Produce a cohesive asset set

Define and enforce an asset specification covering:

- Camera angle and projection
- Lighting direction and material palette
- Relative scale and world units
- Pivot and contact points
- Animation frames and station interactions
- Transparent bounds and occlusion needs
- Ownership or license provenance

Inspect assets together at phone scale. Fix anatomy, contact, perspective, inconsistent resolution, and floating shadows.

All supported equipment and member interactions need finished representations. Placeholder art and unsupported decorative controls cannot receive visual acceptance.

## 6. Preserve sporting and account integrity

Keep the accepted squat, bench, deadlift, judging, RPE, e1RM, DOTS, and meet rules intact.

Preserve:

- Server-authoritative account progression
- Idempotency and account isolation
- Currency provenance and the existing offline cap
- Save recovery and honest error states
- No pay-to-win, gacha, visible fatigue meter, or forced ads
- Fictional identities and appropriately owned assets

Stage any necessary layout schema changes with migration and restore verification. Keep changes scoped to TWL. Preserve unrelated shared Supabase resources and settings.

Keep dependency and security gates intact.

## 7. Verify the experience, including motion

Use separate builders and independent critics according to repository instructions. Critics must inspect the actual running artifact, reference image, and recorded interaction.

Required evidence:

- Before/after screenshots at 320, 390, and 430 px phone widths and desktop
- An uncut phone gameplay recording showing selection, dragging, rotation, invalid placement, cancellation, successful placement, and member response
- A recording or reproducible scenario demonstrating a supported capacity or layout improvement
- Distinct progression-stage captures, with seeded late-game fixtures labeled
- Saved-account layout restoration after reload and another sign-in
- Purchase, failed-save, duplicate-action, and revision-conflict checks
- Existing training and full nine-attempt meet regression checks
- Browser and native build/typecheck results
- Relevant domain tests and targeted tests for changed transforms, footprints, persistence, and simulation lifecycle
- Frame timing and interaction-latency measurements on identified hardware, targeting smooth 60 fps presentation

Label physical-device checks NOT RUN when unavailable. Do not substitute desktop emulation for measured device performance.

The independent visual review must reject mismatched perspective, floating equipment, broken occlusion, inaccurate activity, or progression that only changes labels.

Automated checks establish correctness and measurable behavior. Human playtesting remains the authority for fun, pacing, touch feel, and comparative preference.

## Execution and finish line

Start with a short defect map and architecture decision, then implement. Continue through integration and remediation.

Maintain a durable task checklist. Coordinate active writers and use isolated worktrees for disjoint work. Preserve unrelated changes.

Commit and push through the authorized review branch. Keep PR #89 draft, open, and unmerged. Use the existing practice-beta release process after verification.

The deliverable is an integrated playable gym candidate whose scene, interactions, and supported progression survive independent review.

Final report:

1. Exact commit and tested preview URL
2. What changed in the player experience
3. Before/after screenshots and gameplay recordings
4. Separate PASS / FAIL / BLOCKED / NOT RUN results for visuals, interaction, simulation, persistence, performance, and regressions
5. Remaining defects and human acceptance requirements

Do not declare production completion from build success, screenshot appeal, or a button-flow test. Complete every observable, tool-verifiable requirement and present the actual game for review.