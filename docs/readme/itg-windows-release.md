# Orca ITG Windows releases

Orca ITG is this fork's build of Orca for the ITG team: upstream Orca plus the ITG changes merged into
the fork's `main`. It installs over the official Orca (same app identity and user data) and then
updates itself from this repository's GitHub Releases instead of `stablyai/orca`.

## Versions

Each release is `v<upstream>-itg.<n>`: `v1.4.242-itg.0` is the first ITG build over upstream 1.4.242,
`v1.4.242-itg.1` the next one. The updater parses tags as semver, so a fourth numeric component such
as `v1.4.242.0` is not usable.

## Cutting a release

1. Bring `main` up to date with upstream and merge the ITG branches into it.
2. Run **Actions → ITG Windows Release → Run workflow**. The defaults build `main`, take the latest
   upstream stable release as the base, and pick the next free `-itg.<n>`.
3. The workflow creates a draft, uploads `orca-itg-windows-setup.exe`, its blockmap and `latest.yml`,
   checks them, and publishes the release as Latest.

Download link for the team: `https://github.com/<owner>/<repo>/releases/latest/download/orca-itg-windows-setup.exe`.

## How the build differs from upstream

The workflow sets two variables read by `config/release-distribution.cjs`:

- `ORCA_RELEASE_REPOSITORY` (`owner/repo`): the publish target and the updater feed baked into the app.
- `ORCA_RELEASE_DISPLAY_NAME` (`Orca ITG`): shortcut, uninstaller and installer file names.

With a repository other than `stablyai/orca` the installer is unsigned (no SignPath), so Windows
SmartScreen warns on first install and the updater skips the publisher check. macOS and Linux builds
are not produced.
