# Releasing

Releases are tag-driven. Pushing a tag opens a version-bump PR; merging that PR runs the build and ships it.

## How to cut a release

```sh
# Mobile (iOS + Android)
git tag v0.1.2-mobile
git push origin v0.1.2-mobile

# Desktop (macOS)
git tag v0.1.2-desktop
git push origin v0.1.2-desktop
```

What happens next:

1. [.github/workflows/release-prepare.yml](.github/workflows/release-prepare.yml) opens a `release/<app>-<version>` PR with the version bumps.
2. Review and merge the PR.
3. The matching publish workflow runs:
   - **Mobile** → [apps/mobile/.eas/workflows/release-publish.yml](apps/mobile/.eas/workflows/release-publish.yml) builds with `eas build --profile production` for iOS + Android, submits each via EAS Submit (TestFlight + Play Console), and creates a GitHub Release.
   - **Desktop** → [.github/workflows/release-desktop-publish.yml](.github/workflows/release-desktop-publish.yml) archives + signs + notarizes + builds a `.dmg`, then attaches it to a GitHub Release.

The publish workflow force-moves the tag onto the merge commit so the GitHub Release reflects the actually-released tree, not the developer's pre-bump commit.

Tag format: `v<major>.<minor>.<patch>-<mobile|desktop>`. Anything else is rejected by `scripts/parse-release-tag.mjs`.

## Prerequisites (one-time setup)

The workflows fail fast with a clear message if any of these are missing.

### EAS — for the mobile publish workflow

In the EAS dashboard for the **mobile** project:

- Connect the GitHub repo so EAS Workflows can fire on push events to `main`. See [EAS Workflows getting started](https://docs.expo.dev/eas/workflows/get-started/).
- Add the project secret `RELEASE_GH_TOKEN` — a GitHub Personal Access Token (or fine-grained token) with `contents: write` on this repo. Used to force-move the tag and create the GitHub Release.
- Configure App Store Connect API key under `eas credentials` for iOS Submit.
- Upload a Google Play Service Account JSON for Android Submit.

### GitHub Actions — for the desktop publish workflow

Repo Settings → Secrets and variables → Actions → New repository secret:

| Secret                  | Value                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `MACOS_CERT_P12_BASE64` | `base64 -i DeveloperID.p12 \| pbcopy` — Developer ID Application certificate exported as `.p12`, base64-encoded |
| `MACOS_CERT_PASSWORD`   | password for the `.p12`                                                                                         |
| `APPLE_ID`              | Apple ID email used for notarization                                                                            |
| `APPLE_APP_PASSWORD`    | app-specific password from [appleid.apple.com](https://appleid.apple.com/account/manage)                        |
| `APPLE_TEAM_ID`         | `3VRHBFMBRL` (the team that issued your Developer ID Application certificate)                                   |

`GITHUB_TOKEN` is provided automatically by GitHub Actions.

### Verifying the setup

- Mobile: tag `v0.0.2-mobile`, merge the prepare PR, watch the EAS Workflow run on the EAS dashboard. It should fail at the `guard` job's `Assert RELEASE_GH_TOKEN` step if the secret is missing.
- Desktop: tag `v0.0.2-desktop`, merge the prepare PR, watch GitHub Actions. It should fail at `Assert required secrets` if any of the five GHA secrets are missing.

## Version files touched by the prepare PR

| App     | Files                                                                                                                                                                                           |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mobile  | [apps/mobile/package.json](apps/mobile/package.json) (`version`), [apps/mobile/app.json](apps/mobile/app.json) (`expo.version`)                                                                 |
| desktop | [apps/desktop/package.json](apps/desktop/package.json) (`version`), [apps/desktop/macos/entangle-macOS/Info.plist](apps/desktop/macos/entangle-macOS/Info.plist) (`CFBundleShortVersionString` set to the tag, `CFBundleVersion` += 1) |

iOS / Android build numbers are not touched here — EAS handles those via `production.autoIncrement` in [apps/mobile/eas.json](apps/mobile/eas.json) (paired with `appVersionSource: remote`).
