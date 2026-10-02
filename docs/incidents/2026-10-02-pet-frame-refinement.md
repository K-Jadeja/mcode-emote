# Minimal desktop pet refinement

The live screenshot showed an opaque outer panel obscuring the terminal, generous
side margins, and a sequence counter that provided no useful task information.
The user requested a minimal improvement to the existing design, explicitly
rejecting pills and a broader redesign.

Removed the outer panel, panel shadow, image/label drop shadows, and visible
sequence/demo counter. Kept the original 176px character art, angular status
ribbon, corner accents, rectangular activity plate, colors, and hover controls.
The native window is now 224 by 300 CSS pixels instead of 272 by 324. Native
window sizing and minimum bounds still account for Windows display scaling.
Empty surrounding areas are transparent; the original art's grid background
remains part of the unchanged PNG. This change does not add mouse click-through.

Activity wording now prioritizes observed status: approval, readiness,
disconnection, and session end no longer display a stale thinking label.
Reading/searching, editing, tool use, responding, and compaction use the existing
semantic events. No prompts, paths, commands, or model requests were added.
The footer only displays an explicitly supplied project label, never an opaque
session ID. Existing MCode automatic sessions omit that optional project label.

Browser review at 224 by 300 CSS pixels verified a loaded portrait, unclipped
reading text, no sequence element, no outer pseudo-element, and transparent shell
background. Saved `docs/assets/mcode-emote-refined-preview.jpg` from the actual
built demo. Browser screenshots show the browser backdrop behind transparency;
they do not independently prove native window compositing or click-through.

Repeat verification: `npm test`, `npm run overlay:typecheck`, and
`npm run mcode:smoke`. Rebuild with `npm run overlay:package`, then install via
`node bin/mcode-emote.cjs --emote-install`. New MCode sessions use the updated
payload; existing windows remain on their immutable installed revision.

Verification: desktop type checking passed. The full suite passed 638 of 640
tests while running alongside the native smoke. Two timing-sensitive process
checks (120ms terminal-frame hold and companion crash recovery) failed; both
files then passed all six tests when rerun alone. The overlapping smoke's
installer also hit its 40-second deadline. Run native acceptance sequentially
with the process suite on this machine; do not report the initial concurrent
run as a clean full-suite pass.

The sequential real plain-MCode/native smoke passed with the refined package:
`.tmp/mcode-real-1790961811312`. Reading, ready, ended, native readiness, and
daemon/window cleanup passed using only the local model fixture.
