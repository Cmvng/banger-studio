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
import boss, writer

HERE = os.path.dirname(__file__)
ROOT = os.path.dirname(HERE)
ASSETS = os.path.join(HERE, 'assets')
BRIEF_FILE = os.path.join(HERE, 'last_brief.json')
os.makedirs(ASSETS, exist_ok=True)

VOICE_PATH = os.path.join(HERE, 'voice.txt')
def voice():
    try: return open(VOICE_PATH).read().strip()
    except Exception: return None

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
            D = boss.gather(data.get('proj', 'MegaETH'), data.get('root', ''), ASSETS)
            brief = boss.build_brief(D)
            json.dump(brief, open(BRIEF_FILE, 'w'))
            return self._send(200, render_dossier(brief))
        if self.path == '/write':
            try: brief = json.load(open(BRIEF_FILE))
            except Exception: return self._send(200, '<div class="card"><div class="warn">gather first.</div></div>')
            res = writer.write(brief, data.get('angle', ''),
                               want={'threads': int(data.get('th', 2)), 'posts': int(data.get('po', 4)), 'qts': int(data.get('qt', 4))},
                               voice=voice())
            return self._send(200, render_drafts(res))
        return self._send(404, 'no route')

    def log_message(self, *a): pass


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '8080'))
    ThreadingHTTPServer(('0.0.0.0', port), H).serve_forever()
