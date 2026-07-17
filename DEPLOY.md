# Deploying to Render (free tier)

Two services from one `render.yaml` blueprint: a Dockerized Flask API and a
static React site. Everything below was verified locally against a 512 MB
memory cap (the free-tier ceiling) before being written down.

## 0. Push first

The commits are ready locally but not pushed — this machine has no GitHub
credentials. From `~/Documents/PFE/github-analyzer`:

```bash
gh auth login        # or configure an SSH key / PAT
git push origin master
```

Render deploys from GitHub, so nothing happens until `master` is pushed.

## 1. Create the Blueprint

1. Render dashboard → **New** → **Blueprint**.
2. Pick the `othmxnee/github-analyzer` repo. Render reads `render.yaml` and
   proposes two services: `github-analyzer-api` and `github-analyzer-web`.
3. Apply. Both build. The **API URL** and **web URL** are assigned now — you
   need both for the next step. They look like
   `https://github-analyzer-api.onrender.com` and
   `https://github-analyzer-web.onrender.com`.

## 2. Set environment variables

`render.yaml` marks these `sync: false`, meaning Render will not deploy until
you fill them in (dashboard → each service → **Environment**).

### API service (`github-analyzer-api`)

| Variable | Value |
|----------|-------|
| `CORS_ORIGINS` | the **web** URL, e.g. `https://github-analyzer-web.onrender.com` |
| `FRONTEND_URL` | same web URL (OAuth redirect target) |
| `BACKEND_URL`  | the **API** URL, e.g. `https://github-analyzer-api.onrender.com` |
| `FLASK_SECRET_KEY` | leave it — `generateValue: true` fills it automatically |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | from your GitHub OAuth app (step 3) |
| `GITLAB_*`, `BITBUCKET_*` | only if you want those providers; otherwise leave blank |

### Web service (`github-analyzer-web`)

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | the **API** URL. Baked in at build time — changing it later needs a rebuild (**Manual Deploy → Clear build cache & deploy**). |

## 3. Update OAuth callback URLs

Your OAuth apps currently point at `localhost`. In each provider's developer
settings, set the callback to the **API** URL:

- GitHub → `https://<api-url>/auth/github/callback`
- GitLab → `https://<api-url>/auth/gitlab/callback`
- Bitbucket → `https://<api-url>/auth/bitbucket/callback`

The path must match `BACKEND_URL` exactly, or login returns a redirect-URI error.

## 4. Deploy

With the variables set, trigger a deploy on each service (**Manual Deploy** if
it did not auto-start). When both are live, open the web URL and analyze a repo.

---

## What "free tier" actually costs you

These are real behaviours, not warnings to ignore:

- **Cold starts.** A free service sleeps after ~15 min idle. The next visitor
  waits ~30–60 s while it wakes. The frontend already shows a loader; the very
  first analysis after a nap just takes longer.
- **Memory is the real ceiling — 512 MB.** Measured peaks under that cap:
  - Flask (small repo): **228 MB** — comfortable.
  - Django (capped at 2000 commits by `MAX_COMMITS`): **401 MB** — fits, ~110 MB
    to spare.
  A very large or file-dense repo can push past 512 MB, and Render kills the
  worker (OOM) mid-analysis — the poll then reports an error. If users hit this,
  the cheapest fixes are lowering `MAX_COMMITS` in `backend/services/analyzer.py`
  or upgrading that one service to Starter (~$7/mo).
- **`--depth`-limited clones** already cut download size sharply (Django: ~87 MB
  shallow vs ~350 MB full) and are what keep clone time and disk in check.
- **No persistent disk.** Clones live in the container's ephemeral filesystem and
  are deleted after each analysis. The in-memory result cache is wiped on every
  sleep/restart — expected, since the app was always process-lifetime only.

## Still open (not blocking, worth knowing)

`/analyze` is unauthenticated and each call clones a repo and burns CPU for
minutes. Fine for a personal/demo site; if it gets abused, add a per-IP rate
limit (`flask-limiter` is the small change). Say the word and I'll wire it in.
