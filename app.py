"""
BANGER WORKER — single-file version (no folder needed).
Contains: the boss (gather), the writer (one AI call), and the web server.
Serves the studio app at /app and the worker page at /.
"""
import urllib.request, urllib.error, json, re, ssl, hashlib, os, time, html, socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

EMBEDDED_VOICE = """casual lowercase mostly. occasional Mixed casing for emphasis. protect $TICKERS, coin names, and @handles exactly.
trail off with '...' or '.....' — never finish every thought neatly.
short stacked lines. blank line between beats. let it breathe.
dashes for lists. never numbered 1/ 2/ 3/. never "1/n" thread numbering.
end on a question sometimes — "am i wrong?", "what are you seeing?", "early or fading?"
about 10% light emoji, mostly 👀 🧵 👇 — never a wall of them.
NEVER use em-dashes. use a plain hyphen or just start a new line.
honest. when a token is down, say it's down. give both sides before a bearish take.
naija + crypto-twitter native but always clear to an outsider. confident, not hypey.
"""

# ==================== THE BOSS ====================
"""
THE BOSS — the researcher.
Given a project name + link, it gathers EVERYTHING itself: site text, internal pages,
live price + market cap + TVL, the project's own X posts, public X chatter (via mirrors),
and images (logo, share art) for the designs. No AI. No API credits. Routes through
PROXY_URL if set (your Webshare proxy) so search engines and mirrors don't block it.

Output: one dossier dict — the ONLY thing the writer ever reads.
"""
import urllib.request, json, re, ssl, hashlib, os, time

CTX = ssl.create_default_context(); CTX.check_hostname = False; CTX.verify_mode = ssl.CERT_NONE
UA = {'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'}
PROXY = os.environ.get('PROXY_URL', '').strip()

def _opener():
    handlers = []
    if PROXY:
        handlers.append(urllib.request.ProxyHandler({'http': PROXY, 'https': PROXY}))
    return urllib.request.build_opener(*handlers)

def fetch(url, binary=False, timeout=10):
    try:
        req = urllib.request.Request(url, headers=UA)
        import socket
        socket.setdefaulttimeout(timeout)
        with _opener().open(req, timeout=timeout) as r:
            data = r.read()
        return data if binary else data.decode('utf-8', 'ignore')
    except Exception:
        return None

def _clean(t):
    return re.sub(r'<[^>]+>', '', t or '').strip()

def gather(project, root_url, assets_dir):
    """Return the full dossier for one project."""
    os.makedirs(assets_dir, exist_ok=True)
    D = {'project': project, 'root': root_url, 'when': time.strftime('%Y-%m-%d %H:%M'),
         'facts': [], 'news': [], 'walked': [], 'x_pulse': [], 'images': [], 'kept': []}

    # 1 — the project's own site
    walked_n=[0]
    html = fetch(root_url)
    if html:
        t = re.search(r'<title>(.*?)</title>', html)
        d = re.search(r'name="description" content="([^"]*)"', html)
        if t: D['facts'].append(('site title', _clean(t.group(1))))
        if d: D['facts'].append(('site description', _clean(d.group(1))))
        og = re.search(r'og:image" content="([^"]*)"', html)
        if og: D['images'].append(('share image', og.group(1)))
        txt = re.sub(r'<[^>]+>', ' ', html)
        for m in re.finditer(r'(20\d\d/\d{1,2}/\d{1,2})\s*·?\s*([A-Z][A-Za-z0-9 $&\.\-]{6,60})', txt):
            item = (m.group(1), m.group(2).strip().title())
            if item not in D['news']: D['news'].append(item)
        links = []
        for m in re.finditer(r'href="(/[a-z\-/]{3,40})"', html):
            u = m.group(1)
            if u not in links and 'favicon' not in u: links.append(u)
        for u in links:
            if walked_n[0] >= 6: break
            if any(k in u for k in ['blog', 'news', 'ecosystem', 'about', 'docs']):
                h = fetch(root_url + u)
                if h:
                    heads = [_clean(x) for x in re.findall(r'<h[12][^>]*>(.*?)</h[12]>', h)]
                    heads = [x for x in heads if len(x) > 4][:5]
                    if heads:
                        D['walked'].append({'page': u.strip('/').replace('-', ' '), 'points': heads}); walked_n[0]+=1
        for m in list(re.finditer(r'src="(https?://[^"]+\.(?:png|jpg|webp|svg))"', html))[:6]:
            D['images'].append(('site asset', m.group(1)))

    # 2 — live numbers (free public APIs; slug guessed from project)
    slug = project.lower().replace(' ', '')
    cg = fetch('https://api.coingecko.com/api/v3/coins/%s?localization=false&tickers=false&community_data=false&developer_data=false' % slug)
    if cg:
        try:
            j = json.loads(cg); md = j.get('market_data', {})
            def g(path, d=0):
                x = md
                for k in path: x = (x or {}).get(k, {})
                return x if x not in ({}, None) else d
            D['facts'] += [
                ('price usd', '$%s' % g(['current_price', 'usd'])),
                ('market cap', '$%s' % f"{int(g(['market_cap', 'usd'], 0)):,}"),
                ('24h change', '%.2f%%' % (md.get('price_change_percentage_24h') or 0)),
                ('all-time high', '$%s' % g(['ath', 'usd'])),
                ('down from ath', '%.1f%%' % (g(['ath_change_percentage', 'usd'], 0))),
            ]
            img = j.get('image', {}).get('large')
            if img: D['images'].append(('token logo', img))
        except Exception:
            pass
    ll = fetch('https://api.llama.fi/v2/chains')
    if ll:
        try:
            rows = json.loads(ll)
            hit = [r for r in rows if slug in ((r.get('name') or '') + (r.get('gecko_id') or '')).lower().replace(' ', '')]
            if hit:
                D['facts'].append(('TVL', '$%s' % f"{int(hit[0].get('tvl') or 0):,}"))
        except Exception:
            pass

    # 3 — the project's own X posts (public syndication, no login)
    syn = fetch('https://syndication.twitter.com/srv/timeline-profile/screen-name/%s' % slug)
    if syn:
        for t in re.findall(r'"full_text":"(.*?)"', syn)[:6]:
            try: t = t.encode().decode('unicode_escape', errors='ignore')
            except Exception: pass
            t = re.sub(r'https://t\.co/\w+', '', t).strip()
            if len(t) > 12: D['x_pulse'].append(('@' + slug, t[:200]))

    # 4 — wider X chatter via public mirrors (proxy helps a lot here)
    for m in ['xcancel.com', 'nitter.poast.org', 'nitter.privacydev.net', 'lightbrd.com']:
        h = fetch('https://%s/search?q=%s&f=tweets' % (m, slug), timeout=6)
        if h and 'tweet-content' in h:
            for tm in re.findall(r'tweet-content[^>]*>(.*?)</div>', h, re.S)[:6]:
                txt = _clean(tm)
                if len(txt) > 15: D['x_pulse'].append(('mirror', txt[:200]))
            break

    # 5 — download the gathered images for the designs
    for label, u in D['images'][:10]:
        b = fetch(u, binary=True)
        if b and len(b) > 500:
            ext = '.svg' if 'svg' in u else '.png' if 'png' in u else '.jpg'
            fn = os.path.join(assets_dir, hashlib.md5(u.encode()).hexdigest()[:10] + ext)
            try:
                open(fn, 'wb').write(b)
                D['kept'].append({'label': label, 'file': os.path.basename(fn)})
            except Exception:
                pass

    return D


def build_brief(D):
    """Collapse the dossier into the tiny object the writer reads (keeps API cost low)."""
    facts = dict(D['facts'])
    return {
        'project': D['project'],
        'one_liner': facts.get('site description', ''),
        'live_numbers': {k: v for k, v in D['facts']
                         if any(w in k for w in ['price', 'cap', 'change', 'TVL', 'ath', 'high'])},
        'news_feed': ['%s · %s' % (d, t) for d, t in D['news']][:8],
        'pages_read': D['walked'][:8],
        'x_pulse': [{'src': s, 'text': t} for s, t in D['x_pulse']][:10],
        'assets_for_design': D['kept'],
    }



# ==================== THE WRITER ====================
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



# ==================== THE SERVER ====================
"""
THE WORKER PAGE — what you open on your phone.
Flow: paste a project + link -> GATHER (free, the boss) -> read the dossier ->
type your angle -> WRITE (one cheap API call, the writer) -> copy drafts into the app.

Pure standard-library HTTP server so it runs anywhere with zero extra install for the web part.
Serves the app at /app too, so everything lives at one Railway URL.
"""
import os, json, html, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs


HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = HERE
ASSETS = os.path.join(HERE, 'assets')
BRIEF_FILE = os.path.join(HERE, 'last_brief.json')
os.makedirs(ASSETS, exist_ok=True)


def voice():
    return EMBEDDED_VOICE.strip() or None

def esc(s): return html.escape(str(s))

PAGE = """<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>banger worker</title>
<style>
*{{margin:0;box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,Arial}}
body{{background:#0B1120;color:#E8EFFC;padding:20px;max-width:820px;margin:auto}}
h1{{font-size:24px;letter-spacing:-.02em;margin-bottom:4px}} h1 b{{color:#2E6BFF}}
.sub{{color:#8CA3CC;font-size:13px;margin-bottom:18px}}
.card{{background:#111B33;border:1px solid #1E2C4D;border-radius:16px;padding:16px;margin-bottom:16px}}
label{{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7E93C4;display:block;margin-bottom:6px}}
input,textarea,select{{width:100%;background:#0B1526;border:1px solid #24345C;border-radius:10px;color:#EAF2FF;padding:12px;font-size:15px;margin-bottom:12px}}
textarea{{min-height:70px;resize:vertical}}
button{{background:#2E6BFF;color:#fff;border:0;border-radius:12px;padding:14px 18px;font-size:15px;font-weight:800;width:100%}}
button.ghost{{background:#16223E;color:#9FC0FF}}
.row{{display:flex;gap:10px}} .row>div{{flex:1}}
h2{{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#5D7BB8;margin:20px 0 10px}}
.f{{display:inline-block;background:#0B1526;border:1px solid #24345C;border-radius:10px;padding:8px 12px;margin:0 6px 6px 0;font-size:13px}}
.f b{{color:#7E93C4;font-size:10px;display:block;text-transform:uppercase;letter-spacing:.1em}}
.n{{padding:6px 0;border-bottom:1px solid #16223E;font-size:13px}} .n i{{color:#5D7BB8;font-style:normal;margin-right:10px}}
.im{{width:120px;display:inline-block;vertical-align:top;margin:0 8px 8px 0}} .im img{{width:100%;border-radius:10px;background:#fff}}
.draft{{background:#0B1526;border:1px solid #24345C;border-radius:12px;padding:14px;margin-bottom:12px;white-space:pre-wrap;font-size:14px;line-height:1.5}}
.tagrow{{margin-top:10px;font-size:11px;color:#9FC0FF}} .tag{{background:#16295A;border-radius:99px;padding:3px 10px;margin-right:6px}}
.warn{{background:#3A1220;border:1px solid #7A2340;color:#FFB4C4;border-radius:12px;padding:12px;font-size:13px}}
.ok{{color:#7CE0A0}} .spend{{font-size:12px;color:#8CA3CC;margin-top:8px}}
a.applink{{color:#9FC0FF;font-size:13px}}
</style></head><body>
<h1>banger <b>worker</b></h1>
<div class="sub">the boss gathers everything free · the writer only fires when you press write · <a class="applink" href="/app">open the studio app &#8599;</a></div>
{body}
</body></html>"""

FORM = """
<div class="card">
  <label>project name</label>
  <input id="proj" placeholder="MegaETH" value="{proj}">
  <label>project link (site)</label>
  <input id="root" placeholder="https://www.megaeth.com" value="{root}">
  <button onclick="gather()">1 · GATHER (free — no api)</button>
</div>
<div id="out">{out}</div>
<script>
async function gather(){{
  const proj=document.getElementById('proj').value, root=document.getElementById('root').value;
  document.getElementById('out').innerHTML='<div class="card">gathering… the boss is opening the site, pulling numbers, reading X…</div>';
  const r=await fetch('/gather',{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify({{proj,root}})}});
  document.getElementById('out').innerHTML=await r.text();
}}
async function write(){{
  const angle=document.getElementById('angle').value;
  const th=+document.getElementById('th').value, po=+document.getElementById('po').value, qt=+document.getElementById('qt').value;
  document.getElementById('drafts').innerHTML='<div class="card">writing… one small api call on the gathered brief…</div>';
  const r=await fetch('/write',{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify({{angle,th,po,qt}})}});
  document.getElementById('drafts').innerHTML=await r.text();
}}
</script>
"""

def render_dossier(brief):
    facts = ''.join('<span class="f"><b>%s</b>%s</span>' % (esc(k), esc(v)) for k, v in brief['live_numbers'].items())
    news = ''.join('<div class="n"><i>%s</i></div>' % esc(x) for x in brief['news_feed'])
    xp = ''.join('<div class="n"><i>%s</i>%s</div>' % (esc(p['src']), esc(p['text'])) for p in brief['x_pulse'])
    walked = ''.join('<div class="n"><i>%s</i>%s</div>' % (esc(w['page']), esc(' · '.join(w['points'][:3]))) for w in brief['pages_read'])
    imgs = ''.join('<div class="im"><img src="/assets/%s"></div>' % esc(a['file']) for a in brief['assets_for_design'])
    return """
    <div class="card">
      <div class="ok">✓ boss done — this is what the writer will read (cost so far: $0.00)</div>
      <h2>live numbers</h2>%s
      <h2>news feed</h2>%s
      <h2>pages read</h2>%s
      <h2>x pulse</h2>%s
      <h2>images for designs</h2>%s
    </div>
    <div class="card">
      <label>2 · your angle (steer the writer)</label>
      <textarea id="angle" placeholder="push the ecosystem apps, skip price talk, lean bullish but honest">%s</textarea>
      <div class="row">
        <div><label>threads</label><input id="th" type="number" value="2"></div>
        <div><label>posts</label><input id="po" type="number" value="4"></div>
        <div><label>quote-tweets</label><input id="qt" type="number" value="4"></div>
      </div>
      <button onclick="write()">3 · WRITE (fires the api — cents)</button>
      <div class="spend">the api only runs on this button. nothing runs on a timer.</div>
    </div>
    <div id="drafts"></div>
    """ % (facts or '—', news or '—', walked or '—', xp or '—', imgs or '—', '')

def render_drafts(res):
    if 'error' in res:
        return '<div class="card"><div class="warn">%s<br><br>%s</div></div>' % (esc(res['error']), esc(res.get('message', '')))
    d = res.get('drafts', {})
    if 'raw' in d:
        return '<div class="card"><div class="draft">%s</div></div>' % esc(d['raw'])
    out = ['<div class="card"><div class="ok">✓ drafts ready · run cost $%s · month $%s</div></div>'
           % (esc(res.get('run_cost_usd', '?')), esc(res.get('month_spent_usd', '?')))]
    for group, label in [('threads', 'THREADS'), ('posts', 'SHORT POSTS'), ('qts', 'QUOTE-TWEETS')]:
        items = d.get(group, [])
        if not items: continue
        out.append('<h2>%s</h2>' % label)
        for it in items:
            tag = '<div class="tagrow"><span class="tag">design: %s</span>%s</div>' % (
                esc(it.get('template', '—')),
                ('<span class="tag">image: %s</span>' % esc(it['image'])) if it.get('image') else '')
            out.append('<div class="draft">%s%s</div>' % (esc(it.get('draft', '')), tag))
    return ''.join(out)


class H(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype='text/html; charset=utf-8'):
        b = body.encode() if isinstance(body, str) else body
        self.send_response(code); self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(b))); self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        p = self.path.split('?')[0]
        if p in ('/', '/index.html'):
            return self._send(200, PAGE.format(body=FORM.format(proj='MegaETH', root='https://www.megaeth.com', out='')))
        if p == '/app':
            try: return self._send(200, open(os.path.join(ROOT, 'banger-studio-app.html'), 'rb').read())
            except Exception: return self._send(404, 'app not found')
        if p.startswith('/assets/'):
            fp = os.path.join(ASSETS, os.path.basename(p))
            if os.path.exists(fp):
                ext = fp.rsplit('.', 1)[-1]
                ct = {'svg': 'image/svg+xml', 'png': 'image/png', 'jpg': 'image/jpeg'}.get(ext, 'application/octet-stream')
                return self._send(200, open(fp, 'rb').read(), ct)
            return self._send(404, 'no asset')
        if p == '/health':
            return self._send(200, 'ok', 'text/plain')
        return self._send(404, 'not found')

    def do_POST(self):
        ln = int(self.headers.get('Content-Length', 0))
        data = json.loads(self.rfile.read(ln) or '{}')
        if self.path == '/gather':
            D = gather(data.get('proj', 'MegaETH'), data.get('root', ''), ASSETS)
            brief = build_brief(D)
            json.dump(brief, open(BRIEF_FILE, 'w'))
            return self._send(200, render_dossier(brief))
        if self.path == '/write':
            try: brief = json.load(open(BRIEF_FILE))
            except Exception: return self._send(200, '<div class="card"><div class="warn">gather first.</div></div>')
            res = write(brief, data.get('angle', ''),
                               want={'threads': int(data.get('th', 2)), 'posts': int(data.get('po', 4)), 'qts': int(data.get('qt', 4))},
                               voice=voice())
            return self._send(200, render_drafts(res))
        return self._send(404, 'no route')

    def log_message(self, *a): pass


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '8080'))
    ThreadingHTTPServer(('0.0.0.0', port), H).serve_forever()

