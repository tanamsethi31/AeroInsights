# Contributing to Aeroinsights

Thanks for your interest in this project. Aeroinsights targets aviation lessors — IFRS 9 ECL, maintenance reserves, and portfolio analytics — so changes that improve auditability, data isolation, or lessor workflows are especially welcome.

## Before you open a PR

1. Search [existing issues](https://github.com/tanamsethi31/AeroInsights/issues) to avoid duplicate work.
2. For bugs and features, use the [issue templates](https://github.com/tanamsethi31/AeroInsights/issues/new/choose) so area and severity are captured up front.
3. Run the same gates as CI:

   ```bash
   npm run check
   ```

4. Fill out the [pull request template](.github/pull_request_template.md) and add **type**, **area**, and **stack** labels that match your change (see [.github/labels.yml](.github/labels.yml)).

## Labels

| Prefix | Purpose |
|--------|---------|
| `type:` | bug, enhancement, documentation, chore, security, compliance |
| `area:` | portfolio, ecl-risk, maintenance, scenarios, … |
| `stack:` | frontend, api, database, auth, infra |
| `priority:` | critical → low |
| `status:` | blocked, needs-design |

Labels are synced from `.github/labels.yml` when that file changes on `main`.

## Project layout

See the [README](README.md#project-structure) for the high-level map. Design history lives under `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Security

See [SECURITY.md](SECURITY.md) for how to report vulnerabilities privately.

## GitHub branding

- **README logo:** `public/logo.png` (same asset as the app navbar).
- **Social preview card:** upload [`.github/social-preview.png`](.github/social-preview.png) under **Settings → General → Social preview** (1280×640).
