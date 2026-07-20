# Changelog

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
