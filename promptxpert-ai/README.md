# PromptXpert AI

Image authenticity signals + vision-based reverse prompt engineering.
Frontend: Next.js 14 (App Router), Tailwind, Framer Motion. Backend: Django + DRF, SQLite. Free-tier friendly.

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

## Free-tier caveats
- Render free sleeps after ~15 min idle; the first request takes ~30 s.
- Render free disk is ephemeral: **SQLite history resets on redeploy/restart**. For permanent history add a free external Postgres (e.g. Neon/Supabase) and swap `DATABASES`.
- Render free has 512 MB RAM, which is too small for PyTorch. The deployed API uses the heuristic fallback. To use the trained model, run the backend somewhere with more RAM and add `torch`/`torchvision` to requirements.
- Mistral free tier is rate-limited; the API returns a clear message when that happens and throttles anonymous users to 30 analyses/hour.

## Training the real detector (synopsis section 4.4)
See `backend/ml/train.py` and `backend/ml/evaluate.py`. Report only the numbers `evaluate.py` prints. To commit weights, delete the `*.pt` line in `.gitignore`.
