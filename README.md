# Banger Studio

Banger Studio turns an idea, project URL, or screenshot into three source-aware social concepts, each pairing a draft in the CMVNG voice with a matching 4:5 design direction.

## Product flow

1. Add facts, notes, a project URL, or a screenshot.
2. Optionally research the linked project before writing.
3. Generate three distinct editorial angles in one API call.
4. Review fact/slop checks, edit the draft, and choose a visual family.
5. Continue in the builder, save the project locally, or export a 1080 x 1350 PNG.

## Routes

- /app - the production Studio experience
- /legacy - the preserved original template studio
- / - the low-level worker interface
- /health - Railway health check

## Run

The application uses Python's standard-library HTTP server:

    python app.py

Open http://localhost:8080/app.

## Environment

- ANTHROPIC_API_KEY - required for generation
- STUDIO_ACCESS_KEY - optional private key required by every POST endpoint
- MONTHLY_USD_CAP - monthly AI spend ceiling; defaults to 8
- RATE_LIMIT_PER_MINUTE - POST requests allowed per client per minute; defaults to 30
- MAX_BODY_BYTES - maximum JSON body size; defaults to 8 MB
- PORT - server port; defaults to 8080
- PROXY_URL - optional proxy for public-source gathering

## Safety and reliability

- Research fetches accept only public HTTP(S) destinations and reject private, loopback, link-local, reserved, and metadata addresses.
- Research briefs are isolated by browser session instead of sharing one global file.
- POST routes support access-key protection, rate limits, and request-size limits.
- HTML responses ship with a CSP and standard security headers.
- Large text responses are gzip-compressed.
- The application shell is installable and caches only safe GET assets.
- Projects, brand settings, and builder state autosave locally.

## Tests

    python -m unittest discover -s tests -v

The test suite covers the SSRF guard, session sanitization, health/security headers, access-key protection, compressed app delivery, duplicate IDs, image alternatives, and button naming.
