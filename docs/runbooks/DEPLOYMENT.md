# Deployment & Rollback

The canonical deploy/rollback runbook lives in the **deploy repo** (single source
of truth for production infra):

➡️ **https://github.com/piwas-21/restaurant-app-deploy/blob/main/DEPLOYMENT.md**

## Frontend quick reference

- **Deploy:** merge to `develop` → promote to `main`. The push to `main` builds
  the image and `deploy.yml` auto-deploys `:latest` to the prod box.
- **Rollback:** **Actions → deploy → Run workflow** → `image_tag = sha-<40hex>`
  (a previous build's commit SHA). Rolls back **only the frontend** service.
- ⚠️ `NEXT_PUBLIC_*` are baked at **build** time — a rollback only swaps the
  prebuilt bundle; changing an API URL/domain needs a rebuild, not a deploy.

This repo's `.github/workflows/deploy.yml` is the frontend half; see the canonical
runbook for the full flow, verification, and emergency procedures.
