# CMVNG writer/research reliability audit v7

## Result

The research boundary is now fail-closed: unreadable links, X failures, anti-bot pages, URL-only briefs, stale briefs from another project, invalid screenshots, expired research, and contextual mirror chatter cannot authorize a paid writing call.

The backend remains API-compatible. Existing request fields and response fields are unchanged; new research diagnostics, `cached`, and cookie-based session continuity are additive.

## Defects reproduced and fixed

### Redirect safety

`app-v3.py:145` adds a redirect handler that validates every redirect target with the same public-network policy as the original URL. A public URL can no longer redirect the fetcher into localhost, metadata services, or a private network.

### X and mobile-X sources

`app-v3.py:342` normalizes X, Twitter, mobile-X, and mobile-Twitter URLs through one exact-post path. Exact post IDs use syndication first and oEmbed as fallback. A failed lookup records `unreadable`; it never turns the numeric status ID into evidence.

### Multiple pasted links

`app-v3.py:251` extracts, normalizes, deduplicates, and preserves up to four sources from one string or list. `gather` aggregates article and X excerpts while keeping the original ordered URL list in the brief. The research cache key is order-independent.

### Redirect/canonical article identity

Canonical links are resolved relative to the pasted URL, validated as public, and recorded as an additional provenance source. When an article was already fetched during exact-source extraction, `gather` reuses that HTML instead of fetching the page a second time.

### Article JSON-LD

`app-v3.py:298` reads `Article`, `NewsArticle`, `BlogPosting`, `Report`, and `TechArticle` JSON-LD, including arrays and `@graph`. Organization/site descriptions are not promoted to article evidence. This allows real article bodies to work even when metadata says only “Home” or “Welcome.”

### Anti-bot and fetch errors

Known challenge/captcha/access-denied pages are classified as `blocked` and contribute zero excerpts. Empty fetches are `unreadable`. Additive brief fields expose `source_status`, `source_errors`, and `research_timed_out` without fabricating a summary.

### Total research budget

`gather` applies `RESEARCH_DEADLINE_SECONDS` to all source, CoinGecko, DefiLlama, timeline, mirror, page-walk, and asset requests. The default is 35 seconds and the configured value is clamped to 5-60 seconds at startup. Once the deadline is exhausted, no further fetches begin and the brief reports `timed_out` when no evidence was obtained.

### Evidence validation

`app-v3.py:697` validates the contents of every evidence collection. A nonempty `sources` list, URL, empty page object, or mirror-only X pulse is not evidence. Owned X posts, meaningful article excerpts, labeled live metrics, substantive verified facts, official page points, and real updates remain usable.

### Project/brief continuity

`app-v3.py:722` compares a stored brief to the project and source URLs in the compose topic. Research for Project Alpha cannot authorize a Project Beta generation in the same browser session.

### Screenshot evidence

`app-v3.py:775` validates base64, MIME type, file signature, basic image structure/dimensions, and the existing size limit. Invalid or mislabeled bytes do not count as screenshot evidence. Valid PNG/JPEG/GIF/WebP attachments still allow the model to inspect the screenshot and decide whether it contains enough facts.

### Stable anonymous sessions

`app-v3.py:1591` resolves session identity in this order: JSON body, `X-Studio-Session`, HttpOnly same-site cookie, then a new cryptographically random ID. When a client supplies no session, the server sets `banger_session`; subsequent gather/write/compose requests therefore load the same brief. This repairs the legacy worker and protects against frontend storage mismatches.

### Duplicate research

Only evidence-ready briefs are cached, for five minutes by default (`RESEARCH_CACHE_TTL_SECONDS`, clamped to 0-3600). Cache identity includes normalized project plus every source. Per-session locks prevent concurrent duplicate gathers, and atomic file replacement prevents partially written briefs. Failed/blocked research is not cached, so retry remains possible.

### Ambiguous market data

CoinGecko partial-name matches are no longer accepted. Exact name/id and exact-symbol matches remain candidates, but if the supplied X handle conflicts with CoinGecko's X identity, the profile and its prices are discarded. Primary user-supplied identity wins over secondary market data.

### Paid-call gate

The guard remains enforced both in the HTTP handler and inside writer functions. Invalid evidence returns the existing `{"error":"need_facts","message":"..."}` shape with HTTP 200 for frontend compatibility, logs `compose.blocked`, and never reaches `_call_api`.

## Deterministic verification

Writer suite:

```powershell
& 'C:\Users\USER\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m py_compile 'work\banger-studio-rebuild\app-v3.py'
& 'C:\Users\USER\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest discover -s 'work\banger-studio-rebuild\tests' -p 'test_writer_v5.py' -v
```

Result: 22 tests passed.

Full existing project suite, run from `work/banger-studio-rebuild`:

```powershell
& 'C:\Users\USER\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest discover -s tests -v
```

Result: 28 tests passed. The only output outside test success was a pre-existing `ResourceWarning` from `app.py` opening the HTML shell without a context manager; the v7 changes are in `app-v3.py` and did not introduce that warning.

All research tests use fixtures and patched network calls. They cover exact X, mobile X, normal articles, canonical URLs, private redirects, Article JSON-LD, anti-bot HTML, empty fetches, multiple links, conflicting CoinGecko identity, URL-only and mirror-only briefs, stale project sessions, valid/invalid screenshots, stable anonymous cookies, duplicate caching, total-deadline exhaustion, and paid-call prevention.

## Residual operational limits

- X syndication/oEmbed and public data providers remain external dependencies. Their failure is now safe and actionable, but the backend cannot make those services available.
- JavaScript-only pages with no server-rendered metadata or JSON-LD still require an exact readable article, X post, or screenshot.
- The research deadline caps network request time, but operating-system DNS resolution can occasionally exceed an application-level socket timeout on a severely unhealthy host resolver.
