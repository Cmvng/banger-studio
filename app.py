"""
BANGER WORKER — single-file version (no folder needed).
Contains: the boss (gather), the writer (one AI call), and the web server.
Serves the studio app at /app and the worker page at /.
"""
import urllib.request, urllib.error, json, re, ssl, hashlib, os, time, html, socket, base64, gzip, hmac, ipaddress, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

EMBEDDED_VOICE = """You are ghost-writing AS @cmvng. Below is how he ACTUALLY writes, distilled from 1,348 of his real tweets, plus a bank of his real posts. Match the SHAPE, RHYTHM and RESTRAINT of those examples above any generic idea of a 'good crypto post'. He openly hates long-form explainer threads (his own words: "I get tired of reading long form contents on X... the original idea for X was short form").

HOW HE WRITES:
- DIVES STRAIGHT INTO THE POINT. no throat-clearing, no "here's what i missed", no "the thing about X is", no "let me explain".
- shares HIS OWN stake or number FIRST when he has one (rank 13, earned 7.53 quacks, took a 250 usdc loss), then opens it up to others.
- ends many posts on a real question they must answer ("how many quacks did you get?", "above or below 800m fdv on TGE?"). a flat statement nobody can reply to is a dead post.
- honest parenthetical asides, the human tell: "(sadly didn't expect this decline)", "(loud and proud)".
- trailing dots "..." and "....." constantly, mid-thought and at the end. his signature.
- lowercase, casual, phone-typed. short stacked lines, blank line between beats. small imperfections are fine, do not over-polish.
- deep-dives are SHORT bullet facts, never essays: "be [Project]" then "- fact" "- fact" then a dry kicker ("website now offline....."). not six paragraphs of analysis.
- real project names + real numbers always. plain hyphens only, never em-dashes. never "1/ 2/ 3/" numbering. emoji sparing (a stray 👀 🔥 👇), usually one or none.

NEVER (his slop tells): bloomberg / macro-finance voice; "here's what i missed" / "the other thing that's happening" / "sounds boring. it's not" / "that changes everything" / "just took longer than anyone thought" / "here's the thing"; "privacy is the whole point" style generics; "which side are you on?" bait; hashtag spam; "hot take:"; flawless grammar; any flat hook with no personal stake and no real number.

HIS REAL POSTS (imitate the shape and rhythm, do NOT reuse their facts):

[update, own stake first, honest aside]
yoooo... seems @trylimitless is trending with over 643% increase in revenue in q4
about 7 days left for Epoch II but price is down to 98m fdv
(sadly didn't expect this decline)
my thesis is we get a pump when season 2 drops...

[deep-dive = short bullets + dry kicker]
be Genome
- launch 888 genesis NFTs at 0.3 ETH
- raise $840k+ from mint
- TGE slated Q2 2025... then Q3... then Q4
website now offline.....

[short, own stake + question close]
okay regardless...
earned 7.53 quacks on wallchain yesterday
how many Quacks did you get?

[premarket take + question]
this is how the Zama premarket chart looks like... down to 690M fdv....
do you think it trades above 800m fdv on TGE? or below....

[genuine first-person observation]
is it only me or do i get tired of reading long form content on X... i thought the whole idea of X was short form... now i see articles everywhere like i'm reading a newspaper....

[use-case woven into a real moment, not explained]
he needed help with a quick task, so instead of a bank transfer i sent him $50 USDC on Base using @HeyElsaAI. just told Elsa what i wanted in plain language. done in seconds.

[honest reflection]
please whatever you do.. don't fall in love with any project, it always ends in tears.... 99% of the time
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

CTX = ssl.create_default_context()
UA = {'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'}
PROXY = os.environ.get('PROXY_URL', '').strip()

def _opener():
    handlers = []
    if PROXY:
        handlers.append(urllib.request.ProxyHandler({'http': PROXY, 'https': PROXY}))
    return urllib.request.build_opener(*handlers)

def _safe_public_url(url):
    """Only allow public http(s) targets; blocks localhost, metadata, and private networks."""
    try:
        parsed = urlparse(str(url or '').strip())
        if parsed.scheme not in ('http', 'https') or not parsed.hostname:
            return False
        host = parsed.hostname.rstrip('.').lower()
        if host in ('localhost', 'localhost.localdomain') or host.endswith(('.local', '.internal')):
            return False
        for info in socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == 'https' else 80), type=socket.SOCK_STREAM):
            addr = ipaddress.ip_address(info[4][0])
            if any((addr.is_private, addr.is_loopback, addr.is_link_local, addr.is_multicast, addr.is_reserved, addr.is_unspecified)):
                return False
        return True
    except Exception:
        return False

def fetch(url, binary=False, timeout=10):
    if not _safe_public_url(url):
        return None
    try:
        req = urllib.request.Request(url, headers=UA)
        with _opener().open(req, timeout=timeout) as r:
            data = r.read(4 * 1024 * 1024 + 1)
        if len(data) > 4 * 1024 * 1024:
            return None
        return data if binary else data.decode('utf-8', 'ignore')
    except Exception:
        return None

def _clean(t):
    return re.sub(r'<[^>]+>', '', t or '').strip()

def _readable(t):
    """Keep text human-readable: strip control chars, collapse whitespace, drop if mostly non-latin."""
    if not t: return ''
    t = t.replace('\n', ' ').replace('\r', ' ')
    t = re.sub(r'[\x00-\x1f\x7f]', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    # if less than 40% ascii letters/spaces, it's another script — skip for an english writer
    if t:
        latin = sum(1 for c in t if c.isascii())
        if latin / max(len(t),1) < 0.5:
            return ''
    return t


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
    got_token = False
    cg = fetch('https://api.coingecko.com/api/v3/coins/%s?localization=false&tickers=false&community_data=false&developer_data=false' % slug)
    if cg:
        try:
            j = json.loads(cg); md = j.get('market_data', {})
            def g(path, d=0):
                x = md
                for k in path: x = (x or {}).get(k, {})
                return x if x not in ({}, None) else d
            price = g(['current_price', 'usd'], 0)
            if price:
                got_token = True
                D['facts'] += [
                    ('price usd', '$%s' % price),
                    ('market cap', '$%s' % f"{int(g(['market_cap', 'usd'], 0)):,}"),
                    ('24h change', '%.2f%%' % (md.get('price_change_percentage_24h') or 0)),
                    ('all-time high', '$%s' % g(['ath', 'usd'])),
                    ('down from ath', '%.1f%%' % (g(['ath_change_percentage', 'usd'], 0))),
                ]
                img = j.get('image', {}).get('large')
                if img: D['images'].append(('token logo', img))
        except Exception:
            pass
    if not got_token:
        D['facts'].append(('token price', 'no token found (probably none exists)'))
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
        texts = []
        try:
            # syndication returns JSON; parse it so unicode decodes correctly
            for m in re.finditer(r'"full_text":"((?:[^"\\]|\\.)*)"', syn):
                raw = '"' + m.group(1) + '"'
                try: texts.append(json.loads(raw))
                except Exception: pass
        except Exception:
            pass
        for t in texts[:6]:
            t = re.sub(r'https?://\S+', '', t).strip()
            t = _readable(t)
            if len(t) > 12: D['x_pulse'].append(('@' + slug, t[:200]))

    # 4 — wider X chatter via public mirrors (proxy helps a lot here)
    for m in ['xcancel.com', 'nitter.poast.org', 'nitter.privacydev.net', 'lightbrd.com']:
        h = fetch('https://%s/search?q=%s&f=tweets' % (m, slug), timeout=6)
        if h and 'tweet-content' in h:
            for tm in re.findall(r'tweet-content[^>]*>(.*?)</div>', h, re.S)[:6]:
                txt = _readable(_clean(tm))
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
EDITS_FILE = os.environ.get('EDITS_FILE', 'edits.json')
EDITS_KEEP = 30   # how many raw corrections to retain on disk
EDITS_INJECT = 8  # how many recent lessons actually go into the writer prompt

# rough per-mtok prices for the guard (USD) — conservative
PRICE = {'in': 1.0, 'out': 5.0}

TEMPLATES = ("news, minimal, bars, tiles, feecompare, versus, bignum, quote, gmcard, "
             "iceberg, timeline, stack, sticker, squad, orbit10 (dark top-10 orbit), "
             "leadboard, mindshare, ifbought, threadcover")

REAL_VOICE = r"""
# CMVNG — REAL VOICE (recovered from his archive analysis, chat 0e5af358)

## THE NON-NEGOTIABLES (from measured analysis of 1,348 originals)
1. **Openers VARY WILDLY.** Only 15 of 1,348 tweets (~1%) start with "Yoo". NEVER default to it.
   Real openers: straight into the point · "be [Project]" · "Is it only me..." ·
   "there are some interesting markets..." · "this should inspire you..." ·
   "okay regardless..." · "nothing changes...." · "current ranks on..." ·
   "Ran into an old friend..." · most often JUST DIVES INTO THE POINT.
2. **He shares HIS OWN stake FIRST, then opens it up.** Real skin in game:
   "earned 7.53 quacks on wallchain yesterday" · "rank 13 on wallchain leaderboard Epoch II" ·
   "My thesis is we get a pump..." · "I took a very bad loss yesterday on Telsa, lost 250+ usdc"
3. **Ends on a question they MUST answer** (NON-NEGOTIABLE for bangers):
   "how many Quacks did you get?" · "Do you think it will trade above 800m fdv on TGE? or below...." ·
   "what are your thoughts on the $Elsa tokenomics?" · "What's your pick and why?"
   A flat statement with nothing to reply to is a DEAD tweet.
4. **Honest parenthetical asides — the human tell:** "(sadly didn't expect this decline)" · "(loud and proud)"
5. **Trailing dots "....." constantly** — mid-thought AND at the end. His signature.
6. **Lowercase casual starts.** Writes fast on phone. Minor typos FINE ("Micheal","recieve") — DON'T over-polish.
7. **Real project names + real numbers ALWAYS.** ($LMTS, wallchain, quacks, fdv, 98m, 643%)
8. **Emojis sparing:** 👀 🔥 💪 ✅️ 👇 — usually one or none.

## NEVER WRITE (the slop tells)
- Bloomberg/macro finance language
- "crypto is the future" / "privacy isn't a feature, it's the whole point" generics
- "which side are you on?" hollow engagement-bait
- hashtag spam · "hot take:" openers · perfect grammar · forced CT slang
- ANY flat hook with no personal stake and no real number

## REAL TWEETS — the exemplar bank (absorb the rhythm)

[UPDATE THREAD w/ data + thesis + honest aside]
yoooo... seems @trylimitless is trending with over 643% increase in revenue in q4
about 7 days left for Epoch II but price is down to 98m fdv
(sadly didn't expect this decline)
Over 1.6m $LMTS unstaked in the last 5days
My thesis is we get a pump when season 2 drops...

[PROJECT DEEP-DIVE — "be [Project]" bullet facts]
be Genome
- peak during info-fi and capture heavy attention
- launch 888 genesis NFTs at 0.3 ETH
- raise $840k+ from mint
- promise $Nome allocation at TGE
- TGE slated Q2 2025... then Q3... then Q4
website now offline.....

[PROJECT DEEP-DIVE 2]
Be XOOB Network
- Founded in 2023
- Built as an on-chain growth system for Web3 projects
- CEO and co-founder goes by Sergii Novozhylov
- Incubated by Chromia
- Raised $1.6M seed round in August 2024

[SHORT w/ own stake + question close]
okay regardless...
earned 7.53 quacks on wallchain yesterday
how many Quacks did you get?

[REFLECTION / life-philosophy w/ trailing dots]
this should inspire you to be a profit maxi in 2026.....
please whatever you do.. don't fall in love with any project, it always ends in tears.... 99% of the time

[MARKET INTEL — lists real markets, question close]
there are some very interesting markets on the Pre-TGE section of @trylimitless
- idos to launch a token by March 31st or February 28th
- reya to launch token by February 28th
- HeyElsa to launch token February 28th

[PREMARKET CHART TAKE w/ question]
this is how the Zama premarket chart looks like... down to 690M fdv....
Do you think it will trade above 800m fdv on TGE? or below....

[HOW-TO / airdrop steps]
Are you ready for the @wardenprotocol airdrop?
$WARD airdrop registration opens Monday, January 19, 2026.
How to register:
>>> Open the Warden App
>>> Tap the wallet icon (top right)
>>> Go to Settings
>>> Bind your wallet, X, Discord...

[PERSONAL NARRATIVE — real life bleeds into web3, real stats]
one thing I really took seriously over the last 1 year and a half was hitting the gym 4-5 times weekly and lifting heavy.....
going to the gym with my brother pushed me to the limits and I saw a competition....
his PR (bench press) = 340kg 1 Rep
my PR (bench press) = 250kg 1 Rep

[GENUINE OBSERVATION — "Is it only me..."]
Is it only me or do I get tired of reading long form contents and articles on X... I thought original idea for X was short form... Now I see articles everywhere like I am reading a newspaper....

[USE-CASE STORY — product woven into real moment]
He needed help with a quick task, so instead of cash or bank transfer, I sent him $50 USDC on Base using @HeyElsaAI. I just told Elsa what I wanted to do in my natural language. Everything happened in seconds.

## HIS AMBASSADOR UNIVERSE (from his real links, not assumptions)
$LMTS/@trylimitless · @wallchain_xyz (quacks) · $Elsa/@HeyElsaAI · @wardenprotocol ($WARD) ·
$XNL/@novastro_xyz · $CXT/@Covalent_HQ · $NOVAS · $NEWT · Beldex/@BeldexCoin

"""

STRUCTURE = r"""
# STRUCTURE LAYER — proven mechanics under his voice
# From X's open-sourced algorithm (Jan 2026) + top-creator teardowns.
# These are ENGINEERING TARGETS the writer optimizes for — WITHOUT breaking his voice.
# His voice already does most of this naturally; this makes it deliberate.

## THE REAL ALGORITHM WEIGHTS (public, from xai-org/x-algorithm)
#   Retweet ×20 · Reply ×13.5 · Profile-click ×12 · Link-click ×11 · Bookmark ×10 · Like ×1
#   NEGATIVE: block -3.0, mute, report → content that ANNOYS is punished hard.
#   Time-decay: post loses half its visibility every ~6h → early engagement is everything.
#   External links = SUPPRESSED. Grok reads text by MEANING (specificity beats keywords).

## WHAT THIS MEANS FOR EVERY DRAFT (priority order)
1. REPLY IS THE #1 LEVER (13.5×). Every banger must give people something to reply TO.
   - a real question they have an opinion on ("above or below 800m fdv on TGE?")
   - a stake-claim they'll agree/disagree with ("my thesis is we pump when s2 drops")
   - NOT hollow bait ("which side are you on?") → that gets blocks (-3.0). Real > provocative.
2. BOOKMARK BAIT FOR DEEP-DIVES (10×). "be [Project]" bullet breakdowns = reference people SAVE.
   - dense facts, real numbers, the full picture in one place → "save this one" energy.
3. HOOK = FIRST LINE DECIDES EVERYTHING. Must work standalone (it's all most people see).
   - specific number > vague · open loop > statement · his real openers, never "Yoo"
   - GOOD: "643% revenue increase but price down to 98m fdv..." (number + tension)
   - DEAD: "some thoughts on Beldex..." / "privacy is important..." (vague = ignored)
4. DEPTH = RETENTION SIGNAL. 2-min reads win. Threads: each line survives alone, transitions pull down.
5. NO RAW LINKS IN THE POST. If a campaign needs a link, it goes in a REPLY. (Link in post = suppressed.)
6. PROFILE-CLICK BAIT (12×): a take so specific/credible people click to see who said it.
   - his real skin-in-game does this: "rank 13 on wallchain leaderboard epoch II"

## THREAD ARCHITECTURE (magazine model — for deep-dives)
- HOOK (standalone, number or open loop) → LEDE (1 line sets the story) →
  BEATS (one idea per line, dash facts, real numbers, vary texture) →
  CLOSE (his question — the reply engine)
- keep each line < ~240 chars, blank lines, mobile-first, no wall of same-length lines

## THE ANTI-SLOP GUARDRAIL (algorithm-backed)
The algorithm PUNISHES annoyance (-3.0 block). So the rule isn't "be edgy," it's "be real."
Every draft must pass: does this give a REAL reason to reply, or is it hollow engagement-bait?
If it reads like every other AI crypto post → it gets muted, not amplified. Specificity is the moat.

## 7 FORMATS THAT PERFORM (matched to his real range)
- deep-dive "be [Project]"  → BOOKMARKS (his signature, algo-gold)
- update + thesis + honest aside → REPLIES (his "trylimitless trending" style)
- market-intel list ("interesting markets on...") → BOOKMARKS + REPLIES
- premarket/chart take + question → REPLIES ("above or below on TGE?")
- how-to / airdrop steps → BOOKMARKS (reference)
- personal narrative w/ real stats → PROFILE CLICKS (the gym story)
- genuine observation "is it only me..." → REPLIES (relatable = discussion)

"""

DEFAULT_VOICE = REAL_VOICE + "\n\n=== STRUCTURE (what the X algorithm rewards) ===\n" + STRUCTURE

def _score(text):
    """Real X-algorithm-weighted quality gate. Rewards reply(13.5x)/bookmark(10x) levers, punishes slop."""
    import re as _re
    t = text.lower(); s = 0.0
    if '?' in text: s += 13.5
    if _re.search(r"\b(my thesis|i think|rank \d|i took|earned|feels? mispriced|my pick|my bag)\b", t): s += 6
    s += min(len(_re.findall(r"^\s*[-\u2022>]", text, _re.M)), 5) * 2
    s += min(len(_re.findall(r"[\$%]|\d+[mkb]?\b|\d{2,}", text)), 6) * 2
    first = text.strip().split(chr(10))[0].lower()
    if any(v in first for v in ["some thoughts", "is important", "feature, it", "which side"]): s -= 10
    elif _re.search(r"\d|be [a-z]", first): s += 8
    s -= sum(1 for p in ["which side are you on", "isn't a feature", "the whole point", "game changer", "to the moon", "wagmi"] if p in t) * 10
    return s



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

# ==================== EDIT LEARNING ====================
"""
"check my edit" - when he rewrites a draft himself, that correction is an instruction about
his voice, not just a fixed typo. we distill WHAT changed and WHY into one short reusable
line (one cheap API call), store it, and feed the last few lessons back into every future
write_styled() call - so the writer actually gets better at sounding like him over time
instead of making the same correction-worthy mistake forever.
"""
def _load_edits():
    try:
        j = json.load(open(EDITS_FILE))
        return j if isinstance(j, list) else []
    except Exception:
        return []

def _save_edits(lst):
    try:
        json.dump(lst[-EDITS_KEEP:], open(EDITS_FILE, 'w'))
    except Exception:
        pass

def learn_edit(original, edited):
    """distill one correction into a reusable lesson line, store it, return it."""
    original = (original or '').strip()
    edited = (edited or '').strip()
    if not edited or edited == original:
        return {'error': 'no_change', 'message': 'nothing to learn - the edit matches the original.'}

    lesson = None
    cost = 0.0
    if API_KEY:
        sys_prompt = (
            "You study ONE correction a crypto writer (@cmvng) made to his own AI-assisted draft. "
            "Output ONE short line (under 22 words, lowercase, no quotes) naming the SPECIFIC pattern he "
            "corrected - not a generic 'improved clarity' summary. Focus on: what kind of phrase/structure/claim "
            "he removed or changed, and what he replaced it with. This line will be shown to the writer before "
            "future drafts as a standing instruction, so make it a rule, not a description. "
            "Example good output: 'cut the corporate opener, he starts straight on his own number instead' "
            "Example good output: 'he removed the invented time-of-day detail, keep timing vague unless given' "
            "Output ONLY the line, nothing else."
        )
        user = "ORIGINAL (AI draft):\n%s\n\nHIS EDIT (what he actually posted):\n%s" % (original[:1200], edited[:1200])
        try:
            text, cost = _call_api(sys_prompt, [{'type': 'text', 'text': user}])
            lesson = text.strip().strip('"').split('\n')[0][:200]
        except Exception:
            lesson = None
    if not lesson:
        # offline / no-key fallback: still capture something useful, just less distilled
        lesson = ('edited draft (auto note, no api): shortened by %d chars' % (len(original) - len(edited))
                  if len(edited) < len(original) else 'edited draft (auto note, no api) - see stored text')

    rec = {'when': time.strftime('%Y-%m-%d %H:%M'), 'lesson': lesson,
           'original': original[:600], 'edited': edited[:600]}
    edits = _load_edits()
    edits.append(rec)
    _save_edits(edits)
    if cost:
        _spend_add(cost)
    return {'ok': True, 'lesson': lesson, 'total_learned': len(edits)}

def edit_learnings_block():
    """the last few lessons, formatted for prompt injection. empty string if none yet."""
    edits = _load_edits()
    if not edits:
        return ''
    recent = edits[-EDITS_INJECT:]
    lines = '\n'.join('- %s' % e['lesson'] for e in recent)
    return ("\n\nLEARNED FROM HIS OWN EDITS (standing corrections he's made before - do not repeat these mistakes):\n"
            + lines)

# ==================== CHARACTER STUDIO ====================
"""
Generate a character image directly in the app - the same style presets + poses proven
in this project. Needs GOOGLE_API_KEY or OPENAI_API_KEY on Railway. Without one, this
returns a clear 'not configured' message and nothing else in the app is touched.
No reference-image identity lock yet (fast-follow) - this generates fresh characters
in the tested styles/poses, same as the Gamma-generated cast already in the builder.
"""
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY', '').strip()
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '').strip()

CHAR_STYLES = {
 "pixar": "rendered as a polished 3D Pixar/Disney-style animation still, soft global illumination, expressive character, subtle subsurface scattering, cinematic depth of field",
 "meme": "bold high-contrast meme illustration, exaggerated expression, punchy saturated colors, comic energy, simple readable composition",
 "pixel": "16-bit retro pixel art, limited palette, crisp dithering, arcade-game aesthetic, clean pixel grid",
 "anime": "modern anime cel-shaded illustration, clean linework, dramatic lighting, vibrant saturated colors, dynamic composition",
}
CHAR_POSES = {
 "locked-in": "hunched forward on a crate at 3am, elbows on knees, face lit from below by the phone in his hands, hood up",
 "sent-it": "mid-jump with both feet off the ground, one fist punched toward the sky, head thrown back mid-shout, celebrating",
 "cooked": "down on one knee on the floor, one fist braced on the ground, head hanging, shoulders collapsed, exhausted",
 "shilling": "leaning toward the viewer, one arm thrust forward pointing directly out of the frame, wide grin, certain",
 "relaxed": "leaning back against a wall with one foot up, phone in hand, chin lifted, completely relaxed",
 "still-holding": "standing in a torn coat, one arm in a sling, feet planted, refusing to move, exhausted but defiant",
}

def _char_prompt(style_key, pose_key, extra=''):
    style = CHAR_STYLES.get(style_key, CHAR_STYLES['pixar'])
    pose = CHAR_POSES.get(pose_key, CHAR_POSES['locked-in'])
    return ("A crypto trader character, %s. Full body, character centred, plain flat white background, "
            "no scenery. Style: %s. Render at a standard resolution (about 1024px on the shortest side); "
            "ignore any request for 4K, 8K, or ultra-high-resolution. no text, no letters, no watermark. %s"
            % (pose, style, extra or '')).strip()

def _gen_image_google(prompt):
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode()
    req = urllib.request.Request(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
        data=body, headers={"content-type": "application/json", "x-goog-api-key": GOOGLE_API_KEY})
    with urllib.request.urlopen(req, timeout=60) as r:
        j = json.loads(r.read().decode())
    parts = (((j.get('candidates') or [{}])[0]).get('content') or {}).get('parts') or []
    for p in parts:
        if 'inlineData' in p:
            return p['inlineData'].get('data', ''), p['inlineData'].get('mimeType', 'image/png')
    raise Exception('no image in response')

def _gen_image_openai(prompt):
    body = json.dumps({"model": "gpt-image-1", "prompt": prompt, "n": 1, "size": "1024x1024"}).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=body, headers={"content-type": "application/json", "authorization": "Bearer " + OPENAI_API_KEY})
    with urllib.request.urlopen(req, timeout=90) as r:
        j = json.loads(r.read().decode())
    d = (j.get('data') or [{}])[0]
    if d.get('b64_json'):
        return d['b64_json'], 'image/png'
    if d.get('url'):
        img = fetch(d['url'], binary=True)
        if img:
            return base64.b64encode(img).decode(), 'image/png'
    raise Exception('no image in response')

def generate_character(style_key, pose_key, extra=''):
    if not GOOGLE_API_KEY and not OPENAI_API_KEY:
        return {'error': 'no_key', 'message': "add GOOGLE_API_KEY or OPENAI_API_KEY in Railway variables to turn this on."}
    prompt = _char_prompt(style_key, pose_key, extra)
    try:
        if GOOGLE_API_KEY:
            data_b64, mime = _gen_image_google(prompt)
        else:
            data_b64, mime = _gen_image_openai(prompt)
        if not data_b64:
            return {'error': 'api_fail', 'message': 'provider returned no image data.'}
        return {'ok': True, 'image': 'data:%s;base64,%s' % (mime, data_b64), 'prompt': prompt}
    except urllib.error.HTTPError as e:
        return {'error': 'api_http', 'message': '%s: %s' % (e.code, e.read().decode()[:300])}
    except Exception as e:
        return {'error': 'api_fail', 'message': str(e)[:300]}



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
        "\n\n" + FOUNDATION +
        "\n\n" + CRITICAL_FRAME +
        edit_learnings_block() +
        "\n\n" + HARD_FACT_RULE +
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

    try:
        text, real = _call_api(sys_prompt, [{'type': 'text', 'text': user}])
    except urllib.error.HTTPError as e:
        return {'error': 'api_http', 'message': '%s: %s' % (e.code, e.read().decode()[:300])}
    except Exception as e:
        return {'error': 'api_fail', 'message': str(e)[:300]}
    spent = _spend_add(real)
    usage = {}  # _call_api doesn't expose raw usage separately; cost is already computed correctly from it

    try:
        drafts = json.loads(text)
    except Exception:
        drafts = {'raw': text}
    if 'raw' not in drafts:
        srctext = json.dumps(brief, ensure_ascii=False) + ' ' + (angle or '')
        for group in ('threads', 'posts', 'qts'):
            for it in drafts.get(group, []) or []:
                _verify(it, srctext, srctext)
    return {'drafts': drafts, 'usage': usage, 'run_cost_usd': round(real, 4), 'month_spent_usd': spent}



# ==================== THE STYLE LIBRARY (studied from ~2,500 real tweets) ====================
# For each content TYPE, several studied creator LENSES. The writer renders the same topic
# through different lenses -> diverse, non-slop versions. Moves are techniques in HIS voice.
STYLE_LENSES = {
 "article": [
   ("Hayes essay", "open WIDE with history or a story (not the token), name ONE bold thesis early, BUILD the argument with a concrete model instead of asserting it, irreverent jabs for texture, end earned"),
   ("Ignas research", "under-the-radar angle, open on a striking researched stat, admit what you didn't know then teach it, lived-in and specific"),
   ("Ryan values", "state the moral stakes plainly, then a time-anchored narrative of what happened and why it actually matters"),
 ],
 "alpha": [
   ("GCR calm", "state the unpopular call quietly, no caps, reflexivity angle (the belief moves the price), skin behind it, say what would invalidate it"),
   ("Cred chronology", "lay a timeline of the project's own contradicting statements and let it convict them; dry, deflating wit"),
   ("Pentoshi", "lead with one hard data point, add a hard-earned warning, close on an aphorism"),
 ],
 "educational": [
   ("Miles structure", "a parallel list that TURNS on the last line, OR two numbers side by side that reveal something undeniable"),
   ("Route2FI practical", "'what if i told you [concrete figure]' hook, then clean practical steps"),
   ("DeFi Dad utility", "exact hands-on steps to do the thing right now; useful enough that people save it"),
 ],
 "banger": [
   ("Cobie deadpan", "one deadpan line; absurdist deflation of hype; the turn; self-implication even in a win; no bait"),
   ("loomdart insight", "a smart observation stated plainly, or a one-line analogy joke"),
   ("beanie awe", "narrate ONE jaw-dropping real fact with genuine wonder"),
 ],
 "viral": [
   ("Ansem personality", "relatable, human, a little off-topic; personality first so the alpha lands later"),
   ("timing", "the exact reaction the timeline wanted about today's event, said first and flat"),
   ("beanie fact", "a wild true fact people feel compelled to reshare"),
 ],
 "deepdive": [
   ("ZachXBT source", "be the SOURCE: first-hand findings from actually using it, names + numbers + receipts, the thing nobody else noticed"),
   ("Ignas angle", "the under-radar angle + an anecdote-as-lesson + a striking stat"),
   ("Route2FI clear", "what it does and how you actually use it, structured and clear for an outsider"),
 ],
 "airdrop": [
   ("Miles opportunity", "'missed X? people made $Y. watch these next: [list]. here's how.' concrete and actionable"),
   ("DeFi Dad steps", "exact steps to do it now, the risk/trap named first"),
   ("Route2FI honest", "name the trap first, then the clean steps, honest on the odds ('might be nothing')"),
 ],
 "update": [
   ("Pentoshi honest", "lead with the real figure, label your own state honestly, one human line"),
   ("Ignas callout", "if the number exposes something, say it straight"),
 ],
}
TYPE_LABEL = {"article":"Article / long-form","alpha":"Alpha / trading call","educational":"Educational thread",
 "banger":"Banger / one-liner","viral":"Viral / culture","deepdive":"Project deep-dive",
 "airdrop":"Airdrop / how-to","update":"Update / milestone"}

# the anti-slop foundation, proven on the corpus — shared across every styled write
FOUNDATION = ("PROVEN ON 2,500 REAL TWEETS: there is NO format formula. what separates great from average is "
 "SHAREABILITY - content worth reposting. every good post is FOR one of six triggers: "
 "1 universal truth, 2 humor/relatability, 3 original revelation, 4 righteous truth sharply framed, "
 "5 genuine utility, 6 vivid spectacle. NEVER lean on the average-creator crutch (bullet-stuffing, "
 "ticker spam, colon-setups, rhetorical questions, forced 'everyone thinks X but actually'). those measurably do nothing.")

CRITICAL_FRAME = ("BEFORE WRITING, silently answer: why does this project exist, what problem is it actually solving, "
 "was that problem real, is it actually being solved or is this just marketing language. Don't just collect and list "
 "features - have a point of view on whether the thing is genuinely interesting or just dressed-up PR. "
 "You must be able to complete 'the point of this post is ___' in one clear sentence before writing a word. "
 "If you can't state that thesis plainly, you don't have an angle yet - find one in the facts given, don't fake one. "
 "Any bullets or listed facts in the draft must be EVIDENCE for that one thesis, never a flat feature dump - "
 "bad: '>>> wallet >>> bridge >>> AI >>> token' (a list of things with no point). good: state the one real idea first, "
 "then each fact demonstrates it. If the bullets could be reordered or deleted without changing the point, they fail.")

import re as _slopre
# HONEST slop detector — substance-level tells (the thin keyword list gave false 'clean').
SLOP_TELLS = {
 "bait-opener": [r"^\s*nobody('s| is| are)? (talk|say)", r"^\s*most people", r"^\s*everyone (thinks|says|is)",
   r"unpopular opinion", r"hot take", r"let that sink in", r"^\s*here('s| is) why\b", r"you('re| are) (doing|farming|using) .* wrong"],
 "cliche-hook": [r"the one (number|thing|metric|chart) that", r"what nobody tells you", r"the truth about",
   r"\bis broken\b", r"nobody('s| is) talking about", r"the real reason", r"changed everything"],
 "let-me-show": [r"here('s| is) what i found", r"let me show you", r"here('s| is) my (exact )?setup",
   r"buckle up", r"a lot to unpack", r"thread (below|incoming)", r"strap in", r"let('s| us) dive"],
 "platitude": [r"stay consistent", r"trust the process", r"\bwagmi\b", r"we('re| are) (so )?early",
   r"boring,? consistent", r"show up every ?day", r"put in the work", r"keep building", r"never the ones complaining"],
 "bait-question": [r"am i the only one", r"who('s| is) with me", r"\bagree\?\s*$", r"right\?\s*$",
   r"isn'?t it\?*\s*$", r"or is it just me"],
 "cliche-phrase": [r"the whole thing", r"quietly build", r"sleeping on this", r"a graveyard",
   r"game.?chang", r"to the moon", r"which side are you on", r"the network is the", r"seamless", r"revolutionary"],
 "closer-cliche": [r"nobody wants to say( it)?( out loud)?", r"everyone'?s doing it", r"say the quiet part",
   r"that'?s the (funny|fact|truth|part)", r"let that sink", r"read that again", r"and somehow that'?s"],
 "explainer-formula": [r"here'?s what i missed", r"the other thing (that'?s )?(happening|going on)", r"sounds boring\.? it'?s not",
   r"that changes (everything|the game)", r"just took longer than anyone thought", r"here'?s the thing",
   r"make no mistake", r"the friction between", r"is (the thing|what) .{0,40}(were|was) supposed to (be|become)",
   r"live or die on", r"changes the game completely"],
 "attention-bait": [r"what caught my attention", r"the bigger picture", r"worth paying attention to",
   r"the bigger opportunity", r"this could be huge", r"what makes this particularly compelling"],
 "interesting-family": [r"the interesting part", r"the most interesting thing", r"this is where things get interesting",
   r"i think this is interesting", r"this isn'?t just", r"it'?s more than"],
 "grandiose": [r"the real story", r"the future of", r"unlocking", r"redefining", r"at the intersection of",
   r"a new era", r"paradigm shift", r"powering the future", r"seamlessly", r"in today'?s rapidly evolving"],
}
def _slopcheck(text):
    t=(text or "").lower(); hits=[]
    for cat,pats in SLOP_TELLS.items():
        for p in pats:
            if _slopre.search(p,t,_slopre.M): hits.append(cat); break
    return hits

def _numtokens(text):
    """normalized numeric tokens: $0.0002 / 7.53 / 20% / 1,200 -> canonical strings"""
    out=set()
    for m in _slopre.findall(r'\d[\d,]*\.?\d*', str(text or '')):
        out.add(m.replace(',','').rstrip('.'))
    return out

def _factcheck(draft, source_text):
    """numbers in the draft that never appear in the given facts = likely fabricated"""
    src=_numtokens(source_text); alien=[]
    for n in sorted(_numtokens(draft)):
        if n in src: continue
        if n in alien: continue
        alien.append(n)
    return alien

_EXP_PATS=[r"\bi (spent|watched|saw|lost|made|realized|noticed|met|sat|remember)\b",
 r"\b(yesterday|last (week|night|month|year))\b", r"\b\d+\s*am\b", r"\bbroke (something )?in me\b",
 r"\bi('ve| have) (been|seen|watched)\b", r"\bi was (there|watching|up)\b"]
def _expcheck(draft, usertext):
    """first-person experiential claims in the draft that the user's own text never gave = fabricated memoir"""
    u=(usertext or '').lower(); d=(draft or '').lower(); hits=[]
    for p in _EXP_PATS:
        m=_slopre.search(p,d)
        if m and not _slopre.search(p,u):
            hits.append(m.group(0))
    return hits[:3]

# content-type -> the ONE real template it fills, and that template's slot schema
CTYPE_TEMPLATE = {"deepdive":"threadcover","article":"threadcover","alpha":"bignum",
 "educational":"stack","airdrop":"stack","banger":"quote","viral":"quote","update":"bignum"}
SLOT_SCHEMA = {
 "threadcover":"eyebrow (2-4 word label, e.g. 'beldex . research'); l1,l2,l3 (three SHORT punchy headline fragments ~2-3 words each, they stack into one headline); subline (one short line under the thread pill)",
 "quote":"q (the standalone line, <=140 chars, no hashtags); who (attribution, usually 'cmvng')",
 "bignum":"lab (short label); n (the ONE big number/stat, e.g. '#13','2000+','+643%'); subline (one short line); note (one honest human line)",
 "stack":"t (title); a (one accent word); layers (2-4 steps as a comma-separated list, each a few words); note (one honest line, e.g. 'could be nothing')",
}
CRITIQUE_RUBRIC = ("MANDATORY LOOP: for each version, silently write a first draft, critique it honestly, and REVISE until it passes ALL: "
 "(1) a real opinion/stake, not 'this is good, go do it'  (2) self-implicating: his real number/rank/loss, not vague  "
 "(3) specific real figures, not abstraction  (4) understated: no hype words, no emoji-as-argument  "
 "(5) ZERO AI tells or cliches ('sleeping on it','nobody's talking about','let me show you','the truth about','game-changer','heating up')  "
 "(6) ends on a real thought or an answerable question, never vague bait  (7) he'd actually post it, not scroll past muttering 'AI slop'. "
 "Output ONLY the revised final + a 1-line note of what you fixed.")
HARD_FACT_RULE = ("HARD FACT RULE (overrides everything, including the rubric and the lenses): every number, price, event, "
 "and first-person experience in your output must come from the topic, brief, or screenshots. NEVER fabricate a personal "
 "story, trade, loss, rank, timeframe, or price to satisfy a lens or to make the post 'self-implicating' - a rubric point "
 "met with an invented fact is a FAIL, not a pass. If a lens calls for a personal anecdote and none was provided, change "
 "the angle to an honest observation of what IS given. If the facts are too thin to write anything true, return the "
 "need-facts JSON instead of inventing. BUT 'too thin' means ZERO concrete facts. If the topic gives even ONE real "
 "number or named event (e.g. 'raising $1b at 20b valuation'), that IS enough - write tightly on exactly that and "
 "nothing more. Demanding extra facts when one usable fact was given is also a FAIL: a sharp take on one true number "
 "is the whole job.")

def _call_api(sys_prompt, content):
    """one Haiku call -> (clean_text, real_cost). raises on transport errors."""
    body = json.dumps({'model': MODEL, 'max_tokens': MAX_TOK, 'system': sys_prompt,
                       'messages': [{'role': 'user', 'content': content}]}).encode()
    req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=body, headers={
        'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01'})
    with urllib.request.urlopen(req, timeout=90) as r:
        j = json.loads(r.read().decode())
    usage = j.get('usage', {})
    cost = (usage.get('input_tokens', 900) * PRICE['in'] + usage.get('output_tokens', MAX_TOK) * PRICE['out']) / 1_000_000
    text = ''.join(b.get('text', '') for b in j.get('content', []) if b.get('type') == 'text')
    return text.strip().removeprefix('```json').removeprefix('```').removesuffix('```').strip(), cost

def _verify(v, srctext, usertext):
    v['slop'] = _slopcheck(v.get('draft', ''))
    v['invented'] = _factcheck(v.get('draft', ''), srctext)
    v['fab'] = _expcheck(v.get('draft', ''), usertext)
    return v

def write_styled(topic, ctype, n=3, brief=None, voice=None, images=None):
    """One topic -> several studied LENSES, each run through the critique loop, each with its real-template slots filled. One API call."""
    if not API_KEY:
        return {'error': 'no_api_key', 'message': 'Set ANTHROPIC_API_KEY in Railway variables.'}
    ctype = (ctype or "banger").lower()
    lenses = STYLE_LENSES.get(ctype) or STYLE_LENSES["banger"]
    n = max(1, min(int(n or 3), len(lenses)))
    lenses = lenses[:n]
    voice = voice or DEFAULT_VOICE

    est = ((900 + 1700 * len(images or [])) * PRICE['in'] + MAX_TOK * PRICE['out']) / 1_000_000
    ok, sofar = _spend_ok(est)
    if not ok:
        return {'error': 'cap_reached', 'message': 'Monthly cap $%.2f reached (spent $%.2f).' % (SPEND_CAP, sofar)}

    lens_txt = "\n".join("- %s: %s" % (nm, mv) for nm, mv in lenses)
    is_long = ctype in ("article", "deepdive", "educational", "airdrop")
    fmt = ("SHORT bullet shape like his: 'be [Project]' then a few '- fact' lines then ONE dry kicker line. NOT an essay, NOT paragraphs" if ctype == "deepdive"
           else "a short thread, a few tight tweets with line breaks between - not an essay" if ctype in ("educational", "airdrop")
           else "short, tight - a few short lines, NOT a long-form explainer article (he hates those)" if ctype == "article"
           else "one short standalone post")
    tpl = CTYPE_TEMPLATE.get(ctype, "quote")
    schema = SLOT_SCHEMA.get(tpl, "")
    sys_prompt = (
        "You are the ghost-writer for a Lagos web3 creator (@cmvng). Write ONLY from what you're given - "
        "do NOT invent facts, numbers, or projects not in the topic/brief. Match this VOICE exactly:\n" + voice +
        "\n\n" + FOUNDATION +
        "\n\n" + CRITICAL_FRAME +
        edit_learnings_block() +
        "\n\n" + CRITIQUE_RUBRIC +
        "\n\n" + HARD_FACT_RULE +
        "\n\nWrite %d DIFFERENT versions of the SAME topic, each through a different studied LENS below. "
        "Every version is unmistakably HIS voice - the lens only changes the ANGLE and craft move. "
        "Each version is a %s.\n\nLENSES:\n%s\n\n"
        "For EACH version, also fill the graphic. Template: '%s'. Slots: %s. "
        "Fill every slot FROM the final post - short, punchy, real, same no-slop bar.\n\n"
        "Return STRICT JSON, no prose, no markdown fences:\n"
        '{"source":"<one line: the concrete facts/numbers you are using, verbatim from the screenshots/topic - your receipts>",'
        '"versions":[{"lens":"<lens name>","draft":"<the FINAL revised post>","critique":"<1 line: what the loop fixed>",'
        '"template":"%s","slots":{<exactly the slot keys above, as key:value>},"image":""}]}. '
        'If and ONLY if the topic+brief+screenshots contain ZERO concrete facts (no real number, no named event), return exactly '
        '{"versions":[],"need":"<one short line naming the specific facts you need>"} and no other text. '
        'If at least one concrete fact was given, you MUST write using only it.'
        % (n, fmt, lens_txt, tpl, schema, tpl))
    if brief and brief.get('x_pulse'):
        chatter = brief['x_pulse'][:6]
        if chatter:
            sys_prompt += ("\n\nOTHERS ARE ALREADY POSTING ABOUT THIS - here's the real chatter already out there:\n" +
                "\n".join("- %s" % (c.get('text', '')[:150]) for c in chatter) +
                "\n\nFirst silently identify: what angle are they all taking, what are they repeating, what are they "
                "missing. Then do NOT write the same angle. Either (a) go one layer deeper - a specific implication "
                "they missed, (b) disagree with one specific reason, or (c) surface what they left out. If your draft "
                "says nothing they haven't already said, it FAILS - change the angle or say less.")
    if images:
        sys_prompt += ("\n\nSCREENSHOTS ATTACHED: they are SOMEONE ELSE'S post/content. You are writing HIS reaction or remix - "
            "he did NOT live it, so NEVER write a first-person experience about it ('i spent', 'i watched', 'i realized', "
            "'last week', '2am') unless the topic text itself gave that experience. Allowed stances only: "
            "(a) sharpen the same truth in fewer, harder words  (b) extend it with one implication the original missed  "
            "(c) disagree with one specific reason  (d) connect it concretely to facts from the topic/brief. "
            "If your version says nothing the original didn't already say, it FAILS - add his angle or say less. "
            "Keep the original's real numbers exactly; never alter or invent numbers.")
    user = "CONTENT TYPE: %s\nTOPIC:\n%s" % (TYPE_LABEL.get(ctype, ctype), topic or "(rewrite the attached content)")
    if brief:
        user += "\n\nBRIEF (real facts to use, do not invent beyond this):\n" + json.dumps(brief, ensure_ascii=False)[:3500]
    content = []
    for im in (images or [])[:3]:
        content.append({'type': 'image', 'source': {'type': 'base64',
            'media_type': im.get('media_type', 'image/jpeg'), 'data': im.get('data', '')}})
    content.append({'type': 'text', 'text': user})

    try:
        text, real = _call_api(sys_prompt, content)
    except urllib.error.HTTPError as e:
        return {'error': 'api_http', 'message': '%s: %s' % (e.code, e.read().decode()[:300])}
    except Exception as e:
        return {'error': 'api_fail', 'message': str(e)[:300]}
    spent = _spend_add(real)
    parsed = None
    try:
        parsed = json.loads(text)
    except Exception:
        a, b = text.find('{'), text.rfind('}')
        if a >= 0 and b > a:
            try: parsed = json.loads(text[a:b + 1])
            except Exception: parsed = None
    if parsed is None:
        mneed = _slopre.search(r'"need"\s*:\s*"((?:[^"\\]|\\.)*)"', text)
        if mneed:
            return {'error': 'need_facts', 'message': mneed.group(1)}
        low = text.lower()
        if any(k in low for k in ('need', 'not enough', 'give me', 'what is', 'provide', 'more detail', "don't have", 'no facts', 'facts about', 'more context')):
            return {'error': 'need_facts', 'message': text[:500]}
        return {'error': 'parse', 'message': text[:400]}
    versions = parsed.get('versions', [])
    if not versions:
        need = parsed.get('need') or parsed.get('message') or ''
        return {'error': 'need_facts', 'message': need or 'the writer needs real facts on this first.'}
    source_line = str(parsed.get('source', '') or '')
    srctext = (topic or '') + ' ' + (json.dumps(brief, ensure_ascii=False) if brief else '') + ' ' + source_line
    usertext = (topic or '') + ' ' + (json.dumps(brief, ensure_ascii=False) if brief else '')
    for v in versions:
        _verify(v, srctext, usertext)
        v.setdefault('template', CTYPE_TEMPLATE.get(ctype, 'quote'))
        v.setdefault('slots', {})
        v.setdefault('critique', '')

    # ---- SELF-CORRECTION PASS: flagged drafts get ONE rewrite naming their exact violations ----
    fix_cost = 0.0
    flagged_idx = [i for i, v in enumerate(versions) if v['slop'] or v['invented'] or v['fab']]
    if flagged_idx and _spend_ok(est)[0]:
        probs = []
        for i in flagged_idx:
            v = versions[i]; items = []
            if v['invented']: items.append('numbers NOT in the source (remove or replace with allowed ones): %s' % ', '.join(v['invented'][:6]))
            if v['fab']: items.append('fabricated first-person experience he never lived (remove entirely): %s' % ', '.join('"%s"' % f for f in v['fab']))
            if v['slop']: items.append('slop tells (rephrase without them): %s' % ', '.join(v['slop']))
            probs.append('DRAFT %d (lens "%s"):\n%s\nVIOLATIONS:\n- %s' % (i, v.get('lens', ''), v.get('draft', ''), '\n- '.join(items)))
        fix_sys = (sys_prompt + "\n\nCORRECTION PASS: the drafts below FAILED verification. Rewrite each one removing every "
            "violation listed. Do NOT add any new number and do NOT add any first-person experience. Keep the same lens, "
            "stance, and his voice. Also refill the slots from the fixed draft. "
            'Return STRICT JSON only: {"versions":[{"i":<draft index>,"draft":"<fixed post>","slots":{<same slot keys>}}]}')
        fix_user = ('ONLY these facts/numbers are allowed:\n%s\n\n%s' % (srctext[:1500], '\n\n'.join(probs)))
        try:
            t2, fix_cost = _call_api(fix_sys, fix_user)
            _spend_add(fix_cost)
            p2 = json.loads(t2)
            for fv in p2.get('versions', []):
                idx = fv.get('i')
                if not (isinstance(idx, int) and 0 <= idx < len(versions) and fv.get('draft')): continue
                cand = dict(versions[idx]); cand['draft'] = fv['draft']
                if isinstance(fv.get('slots'), dict) and fv['slots']: cand['slots'] = fv['slots']
                _verify(cand, srctext, usertext)
                before = len(versions[idx]['slop']) + len(versions[idx]['invented']) + len(versions[idx]['fab'])
                after = len(cand['slop']) + len(cand['invented']) + len(cand['fab'])
                if after < before:
                    cand['fixed'] = True
                    cand['fixnote'] = 'caught %d issue%s, rewrote itself' % (before, 's' if before != 1 else '')
                    versions[idx] = cand
        except Exception:
            pass  # correction is best-effort; flagged originals stay honestly flagged

    return {'type': ctype, 'type_label': TYPE_LABEL.get(ctype, ctype), 'versions': versions,
            'template': CTYPE_TEMPLATE.get(ctype, 'quote'), 'source': source_line,
            'run_cost_usd': round(real + fix_cost, 4), 'month_spent_usd': round(spent + fix_cost, 4)}


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
BRIEF_DIR = os.path.join(HERE, 'data', 'briefs')
ACCESS_KEY = os.environ.get('STUDIO_ACCESS_KEY', '').strip()
MAX_BODY_BYTES = int(os.environ.get('MAX_BODY_BYTES', str(8 * 1024 * 1024)))
RATE_LIMIT_PER_MINUTE = int(os.environ.get('RATE_LIMIT_PER_MINUTE', '30'))
RATE_BUCKETS = {}
RATE_LOCK = threading.Lock()
os.makedirs(ASSETS, exist_ok=True)
os.makedirs(BRIEF_DIR, exist_ok=True)

def _session_id(data):
    raw = str((data or {}).get('session', '') or '')
    clean = re.sub(r'[^a-zA-Z0-9_-]', '', raw)[:80]
    return clean or hashlib.sha256(os.urandom(24)).hexdigest()[:32]

def _brief_path(data):
    return os.path.join(BRIEF_DIR, _session_id(data) + '.json')

def _rate_allowed(client):
    now = time.time()
    with RATE_LOCK:
        recent = [stamp for stamp in RATE_BUCKETS.get(client, []) if now - stamp < 60]
        if len(recent) >= RATE_LIMIT_PER_MINUTE:
            RATE_BUCKETS[client] = recent
            return False
        recent.append(now)
        RATE_BUCKETS[client] = recent
        return True


def voice():
    return EMBEDDED_VOICE.strip() or None

def esc(s): return html.escape(str(s))

STYLED_BLOCK = '<div class="card">\n  <label>&#9733; styled writer &mdash; diverse versions, zero slop</label>\n  <textarea id="stopic" placeholder="topic or paste facts... e.g. Beldex BChat: private messenger, 2000+ masternodes, 3-hop, no phone number, down 82% from ath"></textarea>\n  <div class="row">\n    <div><label>content type</label>\n      <select id="stype">\n        <option value="deepdive">Project deep-dive</option>\n        <option value="article">Article / long-form</option>\n        <option value="alpha">Alpha / trading</option>\n        <option value="educational">Educational thread</option>\n        <option value="airdrop">Airdrop / how-to</option>\n        <option value="banger">Banger / one-liner</option>\n        <option value="viral">Viral / culture</option>\n        <option value="update">Update / milestone</option>\n      </select></div>\n    <div><label>versions</label><input id="snum" type="number" value="3" min="1" max="3"></div>\n  </div>\n  <button onclick="styled()">WRITE STYLED VERSIONS (fires the api - cents)</button>\n  <div class="spend">writes your topic through several studied creator lenses, in your voice. (if you GATHER a project below first, it also uses those real facts.)</div>\n</div>\n<div id="styled-out"></div>\n<script>\nasync function styled(){\n  var topic=document.getElementById(\'stopic\').value, type=document.getElementById(\'stype\').value, n=+document.getElementById(\'snum\').value;\n  document.getElementById(\'styled-out\').innerHTML=\'<div class="card">writing \'+n+\' versions through different studied lenses...</div>\';\n  var r=await fetch(\'/styled\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify({topic:topic,type:type,n:n})});\n  document.getElementById(\'styled-out\').innerHTML=await r.text();\n}\n</script>\n'

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
            slop, inv, fab = it.get('slop', []), it.get('invented', []), it.get('fab', [])
            flags = ''
            if slop: flags += '<span class="tag" style="background:#3A1220;color:#FFB4C4">&#9888; slop: %s</span>' % esc(', '.join(slop))
            if inv: flags += '<span class="tag" style="background:#3A1220;color:#FFB4C4">&#9888; not in source: %s</span>' % esc(', '.join(inv[:4]))
            if fab: flags += '<span class="tag" style="background:#3A1220;color:#FFB4C4">&#9888; fabricated: "%s"</span>' % esc('", "'.join(fab))
            if not (slop or inv or fab): flags = '<span class="tag" style="background:#12331F;color:#7CE0A0">&#10003; clean</span>'
            tag = '<div class="tagrow"><span class="tag">design: %s</span>%s%s</div>' % (
                esc(it.get('template', '—')),
                ('<span class="tag">image: %s</span>' % esc(it['image'])) if it.get('image') else '', flags)
            out.append('<div class="draft">%s%s</div>' % (esc(it.get('draft', '')), tag))
    return ''.join(out)


def render_styled(res):
    if 'error' in res:
        return '<div class="card"><div class="warn">%s<br><br>%s</div></div>' % (esc(res['error']), esc(res.get('message', '')))
    vs = res.get('versions', [])
    if not vs:
        return '<div class="card"><div class="warn">no versions came back.</div></div>'
    out = ['<div class="card"><div class="ok">&#10003; %d versions of a %s &middot; run $%s &middot; month $%s</div></div>'
           % (len(vs), esc(res.get('type_label','')), esc(res.get('run_cost_usd','?')), esc(res.get('month_spent_usd','?')))]
    for v in vs:
        slop, inv, fab = v.get('slop', []), v.get('invented', []), v.get('fab', [])
        flags = ''
        if slop: flags += '<span class="tag" style="background:#3A1220;color:#FFB4C4">&#9888; slop: %s</span>' % esc(', '.join(slop))
        if inv: flags += '<span class="tag" style="background:#3A1220;color:#FFB4C4">&#9888; not in source: %s</span>' % esc(', '.join(inv[:4]))
        if fab: flags += '<span class="tag" style="background:#3A1220;color:#FFB4C4">&#9888; fabricated: "%s"</span>' % esc('", "'.join(fab))
        if not (slop or inv or fab): flags = '<span class="tag" style="background:#12331F;color:#7CE0A0">&#10003; clean</span>'
        tag = ('<div class="tagrow"><span class="tag">lens: %s</span><span class="tag">design: %s</span>%s%s</div>'
               % (esc(v.get('lens','?')), esc(v.get('template','—')),
                  ('<span class="tag">image: %s</span>' % esc(v['image'])) if v.get('image') else '', flags))
        out.append('<div class="draft"><b style="color:#9FC0FF">%s</b>\n\n%s%s</div>' % (esc(v.get('lens','')), esc(v.get('draft','')), tag))
    return ''.join(out)


class H(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype='text/html; charset=utf-8'):
        b = body.encode() if isinstance(body, str) else body
        if len(b) > 1024 and 'gzip' in self.headers.get('Accept-Encoding', '').lower() and (
                ctype.startswith('text/') or 'json' in ctype or 'javascript' in ctype):
            b = gzip.compress(b, compresslevel=6)
            encoded = True
        else:
            encoded = False
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.send_header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        if ctype.startswith('text/html'):
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
            self.send_header('Cache-Control', 'no-cache')
        elif ctype.startswith('image/'):
            self.send_header('Cache-Control', 'public, max-age=86400')
        else:
            self.send_header('Cache-Control', 'no-store')
        if encoded:
            self.send_header('Content-Encoding', 'gzip')
            self.send_header('Vary', 'Accept-Encoding')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        p = self.path.split('?')[0]
        if p in ('/', '/index.html'):
            return self._send(200, PAGE.format(body=STYLED_BLOCK + FORM.format(proj='MegaETH', root='https://www.megaeth.com', out='')))
        if p == '/app':
            try:
                doc = open(os.path.join(ROOT, 'banger-studio-app.html'), 'rb').read().decode('utf-8', 'ignore')
                return self._send(200, doc)
            except Exception as e:
                return self._send(404, 'app not found: ' + str(e))
        if p == '/legacy':
            try:
                doc = open(os.path.join(ROOT, 'legacy-app.html'), 'rb').read().decode('utf-8', 'ignore')
                fp = os.path.join(ROOT, 'fuse.html')
                if os.path.exists(fp):
                    fuse = open(fp, 'r', encoding='utf-8').read()
                    doc = doc.replace('</body>', fuse + '</body>', 1) if '</body>' in doc else doc + fuse
                return self._send(200, doc)
            except Exception:
                return self._send(404, 'legacy app not found')
        static_files = {
            '/manifest.webmanifest': ('manifest.webmanifest', 'application/manifest+json'),
            '/sw.js': ('sw.js', 'application/javascript; charset=utf-8'),
            '/icon.svg': ('icon.svg', 'image/svg+xml')
        }
        if p in static_files:
            name, ctype = static_files[p]
            try:
                return self._send(200, open(os.path.join(ROOT, name), 'rb').read(), ctype)
            except Exception:
                return self._send(404, 'asset not found')
        if p.startswith('/assets/'):
            fp = os.path.join(ASSETS, os.path.basename(p))
            if os.path.exists(fp):
                ext = fp.rsplit('.', 1)[-1]
                ct = {'svg': 'image/svg+xml', 'png': 'image/png', 'jpg': 'image/jpeg'}.get(ext, 'application/octet-stream')
                return self._send(200, open(fp, 'rb').read(), ct)
            return self._send(404, 'no asset')
        if p == '/health':
            return self._send(200, json.dumps({'status': 'ok', 'service': 'banger-studio'}), 'application/json')
        return self._send(404, 'not found')

    def do_POST(self):
        if ACCESS_KEY and not hmac.compare_digest(self.headers.get('X-Studio-Key', ''), ACCESS_KEY):
            return self._send(401, json.dumps({'error': 'access_required', 'message': 'Enter the private studio access key.'}), 'application/json')
        client = self.client_address[0] if self.client_address else 'unknown'
        if not _rate_allowed(client):
            return self._send(429, json.dumps({'error': 'rate_limited', 'message': 'Too many requests. Wait a minute and try again.'}), 'application/json')
        try:
            ln = int(self.headers.get('Content-Length', 0))
        except ValueError:
            ln = 0
        if ln < 0 or ln > MAX_BODY_BYTES:
            return self._send(413, json.dumps({'error': 'too_large', 'message': 'This request is too large.'}), 'application/json')
        try:
            data = json.loads(self.rfile.read(ln) or '{}')
        except Exception:
            return self._send(400, json.dumps({'error': 'bad_json', 'message': 'The request body must be valid JSON.'}), 'application/json')
        if self.path == '/gather':
            D = gather(data.get('proj', 'MegaETH'), data.get('root', ''), ASSETS)
            brief = build_brief(D)
            with open(_brief_path(data), 'w', encoding='utf-8') as fp:
                json.dump(brief, fp)
            return self._send(200, json.dumps({'brief': brief}), 'application/json')
        if self.path == '/write':
            try: brief = json.load(open(_brief_path(data), encoding='utf-8'))
            except Exception: return self._send(200, '<div class="card"><div class="warn">gather first.</div></div>')
            res = write(brief, data.get('angle', ''),
                               want={'threads': int(data.get('th', 2)), 'posts': int(data.get('po', 4)), 'qts': int(data.get('qt', 4))},
                               voice=voice())
            return self._send(200, render_drafts(res))
        if self.path == '/styled':
            try: brief = json.load(open(_brief_path(data), encoding='utf-8'))
            except Exception: brief = None
            res = write_styled(data.get('topic', ''), data.get('type', 'banger'),
                               n=int(data.get('n', 3)), brief=brief, voice=voice())
            return self._send(200, render_styled(res))
        if self.path == '/compose':
            try: brief = json.load(open(_brief_path(data), encoding='utf-8'))
            except Exception: brief = None
            imgs = []
            for s in (data.get('images') or [])[:3]:
                s = str(s)
                if s.startswith('data:') and ';base64,' in s:
                    head, b64 = s.split(';base64,', 1)
                    imgs.append({'media_type': head[5:] or 'image/jpeg', 'data': b64})
            res = write_styled(data.get('topic', ''), data.get('type', 'banger'),
                               n=int(data.get('n', 3)),
                               brief=(brief if data.get('usebrief') else None), voice=voice(),
                               images=imgs)
            return self._send(200, json.dumps(res), 'application/json')
        if self.path == '/learn':
            res = learn_edit(data.get('original', ''), data.get('edited', ''))
            return self._send(200, json.dumps(res), 'application/json')
        if self.path == '/gen-char':
            res = generate_character(data.get('style', 'pixar'), data.get('pose', 'locked-in'), data.get('extra', ''))
            return self._send(200, json.dumps(res), 'application/json')
        return self._send(404, 'no route')

    def log_message(self, *a): pass


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '8080'))
    ThreadingHTTPServer(('0.0.0.0', port), H).serve_forever()
