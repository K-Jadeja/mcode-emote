# Repeated plugin updates exceeded MCode's package limit

Installing the folder-heading change copied a third retained runtime into the
user's plugin. `mcode plugin enable mcode-emote@local --json` returned
`Plugin not found`, and the local plugin list became empty despite a valid
manifest. The package measured 68.5 MiB with 362 files and three revisions.

The installed MCode 0.6.0 loader (`chunk-4ESEMCSG.js`) sets
`maxTotalBytes: 64*1024*1024`, `maxFileBytes: 16*1024*1024`, and `maxFiles: 1024`.
The total-size limit was exceeded. Each old payload unnecessarily included
Neutralino binaries for every platform, and updates retained all payloads inside
the directory scanned by MCode. Discovery excluded the oversized package.

Fix the cause: package only `claude-pet-win_x64.exe` and `resources.neu` for this
Windows beta. After atomically activating the new manifest, move previous owned
UUID runtime directories to `<profile>/mcode-emote-archive/<archive-id>` outside
the discoverable plugin tree. Validate resolved source and destination bounds.
Preserve every archived file and any unrecognized user directory. Running MCode
hooks use MCode's own immutable plugin-hook-cache snapshot, so source archival
does not remove their runtime. The existing short native runtime cache remains
unchanged. No files were deleted.

Regression verifies source revisions leave the scanned tree, their content is
preserved, the current revision and unrelated directories remain, and a repeated
archive pass is harmless. Automatic companion integration also passed. Reinstall
then successfully enabled the real user's `mcode-emote@local` 0.2.1 plugin.
The active plugin now has one revision and measures 3.7 MiB; the archive exists
outside its tree. Final real-CLI/native smoke passed using the reduced package,
with evidence in `.tmp/mcode-real-1790963703195` and zero paid model requests.

This was our installer accumulation bug, not a breaking MCode update. Post-update
checks must inspect actual plugin discovery and native lifecycle; checking only
that a manifest file exists cannot detect this failure.
