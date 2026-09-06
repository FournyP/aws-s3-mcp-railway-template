# Changelog

Notable changes to this template. Entries are named after the aws-s3-mcp version they
ship, or after the change itself when a release only touches this template. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Infrastructure as Code — 2026-09-06

### Added

- `.railway/railway.ts`, an Infrastructure as Code definition of the project. See
  [Infrastructure as Code](README.md#-infrastructure-as-code).
- CI: `docker-build` builds every image this template ships, `iac-typecheck` typechecks
  `railway.ts`.

### Changed

- The gateway's default `MCP_HOST` is now `aws-s3-mcp.railway.internal`, matching the
  service name in `railway.ts`. It was `mcp.railway.internal`.

### Upgrade notes

- Only deployments relying on the old default are affected. If your mcp service is named
  `mcp`, set `MCP_HOST=mcp.railway.internal` explicitly or rename the service.

## aws-s3-mcp v0.4.0 — 2026-04-14

### Added

- Initial release. Two services: an nginx gateway holding a public domain and validating
  `Authorization: Bearer <key>` against `API_KEYS`, and a private mcp service built from
  [samuraikun/aws-s3-mcp](https://github.com/samuraikun/aws-s3-mcp) at tag `v0.4.0`.
- An unauthenticated `/health` passthrough for Railway's healthchecks.

### Fixed

- OAuth discovery paths return `404` so MCP clients skip the OAuth flow and fall back to
  the static bearer token. They previously reached the mcp service, which left some
  clients retrying discovery instead of authenticating.
