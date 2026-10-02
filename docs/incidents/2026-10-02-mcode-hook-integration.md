# MCode hook integration: 2026-10-02

## Root causes and fixes

MCode 0.6.0 accepts local plugins, but its hook child environment is allowlisted.
Reusing the Claude bridge's endpoint/token environment variables would produce
an apparently running pet with no activity. The MCode bridge instead binds to
its direct parent process through a launcher-owned connection record. Regression
tests spawn hooks with the same stripped environment and prove state delivery.

The first native MiniMax manifest was undiscoverable because that hook format
rejects exec-form args, leaving zero executable capabilities. We use MCode's
compatible manifest, which accepts shell-free args. The replaced, task-created
manifest was retained under a disabled filename. The installed MCode CLI then
confirmed plugin discovery and enablement.

The shared host exposes a base URL; hooks need `/event`. The initial integration
test failed delivery due to the strict destination validator. The launcher now
constructs `/event` explicitly. End-to-end tests cover the exact destination,
authorization, parent binding, child-session isolation, and cleanup.

An initial local model fixture used the OpenAI stream shape while MCode selected
the Anthropic transport. The fixture now serves explicit Anthropic message and
token-count responses. No live provider was tried as a fallback. The real CLI
smoke passed with two scripted message responses and a real local file read.

## Verification boundary

Native first-frame decoding and authenticated stream readiness passed. The
Windows screenshot helper returned wallpaper for the transparent window and
failed activation after refreshing its handle. We stopped native automation;
the saved browser screenshot is labeled as browser/demo evidence. Do not claim
native screenshot or dragging acceptance from the readiness handshake.

See [the workflow](../MCODE_EMOTE.md) for installation, privacy, test commands,
and unsupported upstream lifecycle signals.
