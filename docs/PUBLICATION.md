# Public source publication ? October 3, 2026

## Scope

Publish MCode Emote as `K-Jadeja/mcode-emote` on `main`, separate from `K-Jadeja/claude-emote`. The user explicitly requested public visibility for both repositories. Preserve their shared source history, original pi-emote licensing, and the unfinished work in other local worktrees. Publish only the reviewed MCode changes to the new repository; the Claude repository receives README/publication documentation only.

This is a Windows source beta, not an npm release or signed installer. The MCode package remains `private: true` to prevent accidental npm publication. Its package identity is now `mcode-emote` 0.3.0; inherited Claude commands/tests remain available. Package validation resolves the package name from its manifest rather than assuming the Claude name. Windows CI uses Node 24, matching the tested environment.

## Verification and privacy

The preceding implementation passed 647 tests in 63 files, desktop type checking, native packaging, and a real MCode 0.6.2/native-window smoke using a loopback model fixture. Real TUI title delivery and `/rename` were verified separately. See the binding audit for exact boundaries; streamed speaking remains unsupported.

Gitleaks 8.30.1 scanned all 78 existing local commits/refs before publication with no findings. Scan the final source snapshot as well. No connection records, local model profiles, credentials, logs, or `.tmp` artifacts belong in Git. Commit identity uses the owner's GitHub-linked noreply address. Upstream authorship/licensing in vendored source is preserved.

## Repeatable publication workflow

1. Inventory worktrees, branch tips, dirty files, remote visibility, and authenticated GitHub identity.
2. Keep unrelated work untouched. Stage explicit reviewed paths only.
3. Check README installation steps, image/link targets, package identity, licenses, and documented limitations.
4. Scan history and the exact source snapshot for secrets. Keep reports under ignored `.tmp` paths.
5. Run relevant source/build checks. Attribute commits to the verified owner.
6. Push the reviewed branch to the new repository's `main`. Keep the Claude remote and WIP branches separate.
7. Push the scoped Claude docs update, make both repositories public as authorized, and verify visibility, remote commit authorship, and CI status.
8. Do not equate public source availability with stable native acceptance or a package-registry release.

## Final local checks

Publication candidate: 647 tests in 63 files passed again after the package rename; desktop type checking passed; 140 immutable upstream files verified; runtime audit reported zero vulnerabilities. Full lifecycle packaging and unrelated-directory installation checks passed under the new package name. The 502-file source snapshot secret scan also reported no leaks. The current README image was captured from the real demo UI with a synthetic chat title, inspected at native dimensions, and labeled as demo evidence. No paid model calls.
