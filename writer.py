"""
THE WRITER — the only part that uses the API.
It never browses. It reads the tiny brief the boss produced + your angle + your voice file,
makes ONE call, and returns drafts (threads / posts / quote-tweets) in your voice, each
tagged with which app template fits and which gathered image to drop in.

Cost control:
  - input is the small brief (~600 tokens), not the whole internet
  - one call per run, only when you press WRITE
  - MODEL + MAX_TOKENS are env vars; defaults are cheap
  - hard monthly spend guard via SPEND_FILE (optional)
"""
import os, json, urllib.request, time

API_KEY   = os.environ.get('ANTHROPIC_API_KEY', '').strip()
MODEL     = os.environ.get('WRITER_MODEL', 'claude-haiku-4-5-20251001')
MAX_TOK   = int(os.environ.get('WRITER_MAX_TOKENS', '2200'))
SPEND_CAP = float(os.environ.get('MONTHLY_USD_CAP', '8'))
SPEND_FILE = os.environ.get('SPEND_FILE', 'spend.json')

# rough per-mtok prices for the guard (USD) — conservative
PRICE = {'in': 1.0, 'out': 5.0}

TEMPLATES = ("news, minimal, bars, tiles, feecompare, versus, bignum, quote, gmcard, "
             "iceberg, timeline, stack, sticker, squad, orbit10 (dark top-10 orbit), "
             "leadboard, mindshare, ifbought, threadcover")

DEFAULT_VOICE = """casual lowercase. mixed casing sometimes. protect $TICKERS and coin names.
trailing '...' or '.....' to trail off. short stacked lines with blank lines between.
dashes for lists, never numbered 1/n. end on a question sometimes. ~10% light emoji.
never use em-dashes. honest takes, both sides when bearish. naija/CT native but clear."""


def _spend_ok(est):
    try:
        s = json.load(open(SPEND_FILE))
        if s.get('month') != time.strftime('%Y-%m'):
            s = {'month': time.strftime('%Y-%m'), 'usd': 0.0}
    except Exception:
        s = {'month': time.strftime('%Y-%m'), 'usd': 0.0}
    if s['usd'] + est > SPEND_CAP:
        return False, s['usd']
    return True, s['usd']

def _spend_add(usd):
    try:
        s = json.load(open(SPEND_FILE))
        if s.get('month') != time.strftime('%Y-%m'):
            s = {'month': time.strftime('%Y-%m'), 'usd': 0.0}
    except Exception:
        s = {'month': time.strftime('%Y-%m'), 'usd': 0.0}
    s['usd'] = round(s['usd'] + usd, 4)
    try: json.dump(s, open(SPEND_FILE, 'w'))
    except Exception: pass
    return s['usd']


def write(brief, angle, want=None, voice=None):
    """want = dict e.g. {'threads':2,'posts':4,'qts':4}. Returns drafts + usage."""
    if not API_KEY:
        return {'error': 'no_api_key', 'message': 'Set ANTHROPIC_API_KEY in Railway variables.'}
    want = want or {'threads': 2, 'posts': 4, 'qts': 4}
    voice = voice or DEFAULT_VOICE

    est = (600 * PRICE['in'] + MAX_TOK * PRICE['out']) / 1_000_000
    ok, sofar = _spend_ok(est)
    if not ok:
        return {'error': 'cap_reached',
                'message': 'Monthly cap $%.2f reached (spent $%.2f). Raise MONTHLY_USD_CAP to continue.' % (SPEND_CAP, sofar)}

    sys_prompt = (
        "You are the ghost-writer for a Lagos web3 creator (@cmvng). Write ONLY from the BRIEF given — "
        "do not invent facts or numbers. Match this VOICE exactly:\n" + voice +
        "\n\nReturn STRICT JSON, no prose, no markdown fences, shape:\n"
        '{"threads":[{"draft":"...","template":"orbit10","image":"<asset filename or \'\'>"}],'
        '"posts":[{"draft":"...","template":"minimal","image":""}],'
        '"qts":[{"draft":"...","template":"quote","image":""}]}\n'
        "Threads use line breaks between tweets. Pick template from this list only: " + TEMPLATES +
        ". Use an image filename only if it genuinely fits, else empty string."
    )
    user = ("BRIEF:\n" + json.dumps(brief, ensure_ascii=False) +
            "\n\nANGLE (the direction I want this week): " + angle +
            "\n\nMAKE: %d threads, %d short posts, %d quote-tweet takes." %
            (want.get('threads', 2), want.get('posts', 4), want.get('qts', 4)))

    body = json.dumps({
        'model': MODEL, 'max_tokens': MAX_TOK,
        'system': sys_prompt,
        'messages': [{'role': 'user', 'content': user}],
    }).encode()

    req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=body, headers={
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
    })
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            j = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {'error': 'api_http', 'message': '%s: %s' % (e.code, e.read().decode()[:300])}
    except Exception as e:
        return {'error': 'api_fail', 'message': str(e)[:300]}

    usage = j.get('usage', {})
    real = (usage.get('input_tokens', 600) * PRICE['in'] + usage.get('output_tokens', MAX_TOK) * PRICE['out']) / 1_000_000
    spent = _spend_add(real)

    text = ''.join(b.get('text', '') for b in j.get('content', []) if b.get('type') == 'text')
    text = text.strip().removeprefix('```json').removeprefix('```').removesuffix('```').strip()
    try:
        drafts = json.loads(text)
    except Exception:
        drafts = {'raw': text}
    return {'drafts': drafts, 'usage': usage, 'run_cost_usd': round(real, 4), 'month_spent_usd': spent}


if __name__ == '__main__':
    import boss
    d = boss.gather('MegaETH', 'https://www.megaeth.com', 'assets')
    print(json.dumps(write(boss.build_brief(d), 'push the ecosystem apps, skip price talk'), indent=1)[:1200])
