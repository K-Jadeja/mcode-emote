# Folder identity and MCode update compatibility

The large status ribbon duplicated the activity label. Replace it with an 11px
plain folder heading; preserve the portrait, corner accents, rectangular activity
plate, and hover controls. Remove the duplicate footer. Native height decreases
from 300 to 272 CSS pixels; width stays 224. The heading truncates long names and
exposes the sanitized full basename in its tooltip.

MCode's compatible hook runner spawns hooks with `cwd: input.cwd`. The detached
companion inherits that session directory. Reuse `resolveSessionLabel` to send
only the sanitized basename via the existing native environment label; full
paths and labels do not enter the semantic HTTP/SSE state or connection record.
This is a user-requested local presentation change, with no provider, billing,
or permission changes. The UI renders the label as text, never HTML.

Current compatible input metadata has session ID and cwd but no supported chat
title. `sessionTitle` found elsewhere in the runner is an output control field,
not a reliable incoming title. Do not read private SQLite session storage to
populate the heading. It is a launch-time folder label; different chats in one
folder share the name, and later directory changes are not tracked.

MCode updates should preserve profile-local plugin files, but compatibility with
future hook versions is not guaranteed. The plugin carries its own runtime and
never patches CLI files. Verified baseline: MCode 0.6.0. Dependencies: compatible
exec-form hooks, direct parent PID, lifecycle event shapes, and hook cwd.
Moving Node or changing profile requires `mcode-emote --emote-install` again.
`--emote-doctor` checks setup; `npm run mcode:smoke` checks actual installed hooks
and native lifecycle against a local fixture without paid model calls. Neither
claims compatibility with an untested future version.

Validation: process integration asserts the native environment contains exactly
the expected folder basename. Existing label tests cover sanitization and length
limits. Browser review at 224 by 273 CSS pixels (one-pixel viewport rounding)
verified the heading, no status ribbon, decoded portrait, activity plate ending
at y=262 (inside the 272px native design), and no console errors. Saved the real
demo UI as `docs/assets/mcode-emote-folder-preview.jpg`; its demo heading is
explicitly `demo project`. This screenshot is not a native compositing test.

Source references:
- [Local plugins](https://github.com/MiniMax-AI/minimax-code/blob/main/docs/examples.md#4-manage-plugins)
- [Hook runner](https://github.com/MiniMax-AI/minimax-code/blob/main/packages/agent-modules/plugin-hooks/src/runner.ts)
- [Hook input contract](https://github.com/MiniMax-AI/minimax-code/blob/main/packages/agent-modules/plugin-hooks/src/contracts.ts)

The full suite passed 639/640; one abrupt-parent lifecycle fixture exited before
reporting completion. Its crash-recovery setup assumed that killing a Windows
process completed in 300ms. Replace that timing assumption with a bounded wait
for actual process death, and preserve child stderr for future failures. All
three automatic-companion integration tests then passed. This hardens the test
precondition; it does not claim to prove the original failure's precise cause.
Desktop type checking also passed.

Real MCode 0.6.0 with the packaged 0.2.1 plugin passed native startup, reading,
ready, ended, and process/window cleanup with zero paid model requests. Evidence:
`.tmp/mcode-real-1790963385662`. No MCode upgrade was performed or simulated;
future-version compatibility remains conditional on the documented contracts.
