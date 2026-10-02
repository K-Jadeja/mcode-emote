# Windows CI title-lookup failure

Two GitHub Windows runs (37051957541 and 37052090126) failed the first title delivery in the real-shell integration fixture. The same full suite passed locally. The original bridge reported only a generic failure, which hid whether parent lookup or authenticated delivery failed.

Add bounded, content-free phase diagnostics before changing behavior: input, direct connection lookup, shell-parent lookup, owner connection lookup, or identity delivery. A killed child query is identified as a process timeout. Do not print payloads, titles, capabilities, environment values, or raw error messages. The exact Windows shell integration remains the regression gate; do not skip it or treat a retry as a fix.
