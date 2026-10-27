# Changelog

## 2026-10-27 — Codex

### Changed
- Adopt AI-Nugget 0.7.5 from source commit `f8e563fd6c23957b0885e131c5aac4e9a7851693` for the provider/cloud expansion; preserve application-owned policy and model selection.

### Not completed
- Live provider calls were not exercised (no configured provider test credentials).

### Notes
- Passed npm run build (TypeScript and Vite); root and agent exports resolve from the pinned package.

## Unreleased

### Fixed

- Synchronized the dependency lockfile with the current Game Vault app.
- Added validation for saved browser data before it reaches app state.
- Preserved accumulated timer time across pause and resume actions.
- Deferred backup object URL cleanup until the browser starts the download.
- Reset the interval handle during effect cleanup.

### Changed

- Documented the repository's Nugget Bench and Game Vault naming roles,
  configuration, demos, and common setup problems.
