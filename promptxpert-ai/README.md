# PromptXpert AI

Image authenticity signals + vision-based reverse prompt engineering.
Frontend: Next.js 14 (App Router), Tailwind, Framer Motion. Backend: Django + DRF, SQLite. Free-tier friendly.

## Features
**Image to Prompt Generator (main feature, `/generator`)**: upload up to 6 images and open the Prompt Studio. Five target generators
(Universal, Midjourney, Stable Diffusion with word weights, Flux, DALL-E 3), four styles, a length slider, "reimagine as" in 8 art styles,
a chip-based prompt builder (toggle, weight, add and remove terms), live token meter per generator, completeness score, AI rewrite tools
(polish, expand, shorten, translate, negative prompt, 3 variations via Codestral), camera settings read from EXIF, automatic aspect ratio and
SDXL size, version history with restore, alt text, prompt pack export, and save-to-library.

**Authenticity detector (`/analyze`)**: classifier with an inconclusive band, forensic heatmaps with overlay slider, robustness check,
provenance and full EXIF viewer, privacy scan with one-click metadata-free copy, palette export (CSS / Tailwind / JSON), similar-image detection.

**More**: compare two images with a slider and similarity score (`/compare`), history with search / star / tags / rename, public read-only
share links (results only), Markdown and JSON reports, dashboard charts, status page, and a Ctrl+K command palette.

## How it works
| Part | What it does |
|---|---|
| Detector | EfficientNet-B0 if `backend/ml/weights/efficientnet_b0.pt` exists, otherwise a low-confidence **heuristic fallback** (reported as such in every response). Has an "inconclusive" band. |
| Provenance | EXIF + PNG generation-parameters + C2PA *presence* detection. Missing metadata is never treated as AI. |
| Prompt | Mistral vision model (`MISTRAL_VISION_MODEL`, default `mistral-small-latest`) returns validated JSON, composed into 4 styles x 3 formats. |
| Polish | `MISTRAL_MODEL=codestral-2508` rewrites the final prompt (text only; Codestral cannot read images). |
| History | JWT auth, results stored in SQLite, **no image bytes stored**, Markdown report export. |

## Run locally
```bash
# backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then: export $(grep -v '^#' .env | xargs)  (or use your shell's dotenv)
export DEBUG=1 && python manage.py migrate && python manage.py runserver

# frontend (new terminal)
cd frontend && cp .env.example .env.local && npm install && npm run dev
```
Tests: `cd backend && python -m unittest core.tests -v`

## Push to GitHub
```bash
cd promptxpert-ai
git init && git add . && git commit -m "PromptXpert AI"
git branch -M main
git remote add origin https://github.com/<your-username>/promptxpert-ai.git
git push -u origin main
```

## Deploy (all free)
1. **Backend on Render**: New > Blueprint > pick the repo (it reads `render.yaml`). In the dashboard set `MISTRAL_API_KEY` (free key from console.mistral.ai). Leave `FRONTEND_URL` for step 3.
2. **Frontend on Vercel**: Import the repo, set **Root Directory = `frontend`**, add `NEXT_PUBLIC_API_URL=https://<your-render-service>.onrender.com`, deploy.
3. Back in Render, set `FRONTEND_URL=https://<your-app>.vercel.app` and redeploy (this enables CORS).

## Migrations note
`build.sh` runs `makemigrations core` before `migrate`, so the app's tables are created on every build even without committed migration files. For a long-lived production database, run `python manage.py makemigrations` locally and commit `core/migrations/`.

## Database tables
`build.sh` runs `makemigrations core` so the tables are always created, even without committed migration files. For a long-lived
deployment, run `python manage.py makemigrations core` locally and commit `core/migrations/`.

## Free-tier caveats
- Render free sleeps after ~15 min idle; the first request takes ~30 s.
- Render free disk is ephemeral: **SQLite history resets on redeploy/restart**. For permanent history add a free external Postgres (e.g. Neon/Supabase) and swap `DATABASES`.
- Render free has 512 MB RAM, which is too small for PyTorch. The deployed API uses the heuristic fallback. To use the trained model, run the backend somewhere with more RAM and add `torch`/`torchvision` to requirements.
- Mistral free tier is rate-limited; the API returns a clear message when that happens and throttles anonymous users to 30 analyses/hour.

## Training the real detector (synopsis section 4.4)
See `backend/ml/train.py` and `backend/ml/evaluate.py`. Report only the numbers `evaluate.py` prints. To commit weights, delete the `*.pt` line in `.gitignore`.
