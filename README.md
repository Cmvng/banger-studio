# Banger Studio — app + worker

Two things live here, at one web address once deployed:

- **the studio app** — your 122 design templates (offline, free forever) — opens at `/app`
- **the worker** — the boss (gathers everything free) + the writer (one cheap AI call) — opens at `/`

---

## What each piece costs

| Piece | Runs on | Cost |
|---|---|---|
| Studio app | your phone, offline | $0 |
| The boss (gathering) | Railway | $0 (no AI) |
| The writer (drafts) | Railway + your API key | cents per press of WRITE |

The API **only** fires when you press **WRITE**. Nothing runs on a timer. The boss does all the
gathering for free; the writer reads only the tiny brief, so each run is cheap.

---

## Deploy (once)

You already have this repo connected to Railway. To ship:

1. Put these files in the repo `Cmvng/banger-studio` (replace the old `banger-studio-app.html`
   with the new one; add the `worker/` folder, `Procfile`, `requirements.txt`, `runtime.txt`).
2. In **Railway → your project → Variables**, add:
   - `ANTHROPIC_API_KEY` = your key (starts `sk-ant-...`)  ← the writer needs this
   - `PROXY_URL` = your Webshare proxy string (optional, widens X + search)
   - `MONTHLY_USD_CAP` = `8`  (safety brake — the writer stops if the month's spend passes this)
   - `WRITER_MODEL` = `claude-haiku-4-5-20251001`  (cheapest; change later if you want)
3. Railway redeploys automatically. Open the URL:
   - `/`     → the worker (paste a link, gather, write)
   - `/app`  → the studio

That's it. No install steps — the boss and server use only Python's standard library.

---

## Daily use

1. Open the worker URL on your phone.
2. Type a project + its site link. Press **GATHER** → read the dossier (free).
3. Type your **angle** for the week. Press **WRITE** → drafts appear, each tagged with which
   template + which gathered image to use.
4. Copy a draft, open `/app`, build the design, export.

## Steering the voice

Edit `worker/voice.txt` any time — that's how the writer learns to sound like you.

## Safety

- `MONTHLY_USD_CAP` hard-stops the writer if spend passes your limit.
- The API key lives only in Railway's private variables — never in the code, never shared.
- The boss reads X through public mirrors + the project's own feed — no login, your accounts stay clean.
