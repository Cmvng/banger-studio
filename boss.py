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


if __name__ == '__main__':
    d = gather('MegaETH', 'https://www.megaeth.com', 'assets')
    print(json.dumps(build_brief(d), indent=1)[:1500])
