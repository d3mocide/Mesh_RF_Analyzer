# Release v1.15.4: Production Hotfix

This hotfix resolves critical issues preventing the production Docker build from running correctly.

## 🐛 Bug Fixes

### Infrastructure

- **Frontend Startup Crash**: Fixed a line-ending issue (CRLF) in `docker-entrypoint.sh` that prevented the Nginx container from starting. Added `.gitattributes` to prevent recurrence.
- **API Connectivity (502)**: Fixed a port mismatch in `docker-compose.yml`. The `rf-engine` service now correctly listens on port `5001` (was `80`), aligning with the Nginx proxy configuration.

## Upgrade Instructions

Rebuild containers to apply the entrypoint fix:

```bash
docker-compose down
docker-compose up -d --build
```
