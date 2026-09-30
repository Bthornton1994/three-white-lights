# Iron & Amber asset provenance

The governing reference is `docs/design/iron-and-amber-reference.jpeg`, introduced by PR44 at commit `c52444d407e9974209446ec1de7d127f1ce07a6a`. Its SHA-1 Git blob is `80fcaaa9ee14711776ceeaf31ca12ae61242d1d4`.

- `web/public/rooms/gym-floor.png`: generated with the built-in image-generation tool in this production integration, using that actual reference image. Original generated file copied byte-for-byte. No baked characters, controls, or text. A warm brick and iron garage with an amber doorway and open floor supports live placed equipment.
- Other `web/public/rooms/*.jpg`: existing project-owned Iron & Amber training and meet assets from PR63, commit `46ae42bb3d32319586bf99851d1f20cd171c1c60`. Original source notes remain in `docs/design/IRON-AMBER-TRAINING-ASSETS.md`.
- `web/public/empire-art/*.png`: existing equipment and member artwork from the facility persistence branch, commit `3c55622b94a6ff5c977de8ff09c0977ecfa739a8`. Source files remain intact. Chroma-keyed textures are decoded for display in the browser.
- `web/public/sprites/*`: accepted athlete poses from the arcade implementation, commit `30686d30464ba877b7236c59c49db766fe02ad19`. The animated athlete remains a restrained retro accent inside the illustrated room. The source files contain magenta key backgrounds; rendering removes only boundary-connected key pixels for the athlete, preserving enclosed body and equipment details.
- `web/public/sound/*.wav`: existing project-synthesized meet audio from PR63.
- `web/public/fonts/BarlowCondensed-*.ttf`: Barlow Condensed Regular, Bold, and ExtraBold from the official `google/fonts` repository's `ofl/barlowcondensed` directory. SIL Open Font License is checked in beside them as `OFL.txt`.
- Application icons: vector-derived three-light mark created for this browser build, without an external brand identity.

The asset list records origin. Visual acceptance is a separate review of the deployed artifact against the reference, at phone and desktop sizes.
