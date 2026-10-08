# ChatNote project conventions

- After every application upgrade, update `docs/CHANGELOG_AND_IDEAS.md` with the version, final changes, validation, limitations, and completed/pending idea IDs. Also synchronize `docs/FEATURES.md` and the user-facing release instructions.
- Keep reported user verification distinct from automated tests and checks performed by the agent.
- Preserve existing conversations, anchors, API credentials, and ChatGPT registrations when upgrading. Never reset a user's workspace to demo data.
- Connection and quota checks must not send an inference request automatically. Show unavailable quota honestly and offer the provider's official usage page.
- Keep credentials in the native system vault; connection profiles and exports contain metadata only.
- Keep UI translations in `src/locales` with matching keys and placeholders. Locale changes must preserve source text, offsets, drafts, connection metadata and model instructions. Add coverage when extending locales.
- Retain delivered release executables for rollback. Do not delete or replace historical release files as part of a normal upgrade; follow `docs/RELEASE_POLICY.md` when arranging archives.
- The usual local release directory should contain the latest delivered version and the previous stable version. Archive earlier delivered binaries after verifying the archive; use GitHub Releases once available. Reproducible temporary builds may be cleaned when useful. Keep archived artifacts and release records separate from source commits.
- This project uses the private repository `https://github.com/MKCorleonE/ChatNote`. Save meaningful commits and push authorized upgrade work after validation. Follow `docs/GIT_WORKFLOW.md`; never change repository visibility or add collaborators without explicit authorization. Release files belong in private release assets, not source history.
