# Angara GenAI Agent — public share demo (standalone)

**Separate site.** Static HTML/CSS/JS + seeded JSON.  
**Not** part of the Next.js app. **Do not** deploy under Angara product hosts (`*.angara.com`, `angaraqa.v4.*`, internal VPN URLs).

Use for LinkedIn / WhatsApp QA groups.

**Surfaces covered:** TEST CASE Generate (quality gate, dedupe, house/OOB, CR∥generate), MR Code Review, CUA Browser Agent, Automation Workbench, QA Agent, MCP Skills & CLI, Jira/Xray, PageSpeed/SEO/Schema.

## What’s inside

| Path | Role |
|------|------|
| `index.html` | Single-page demo |
| `styles.css` / `app.js` | Presentation only |
| `data/demo.json` | Frozen ticket, CR, quality scores, merges, cases |

No API keys. No Mongo. No live generate.

## Preview locally

```bash
cd share-demo
python3 -m http.server 8765
# open http://127.0.0.1:8765
```

(`file://` may block `fetch` of `demo.json` — use a tiny HTTP server.)

## Host on its own domain (required)

Pick **any** host that is not the product:

### GitHub Pages (separate repo — recommended)

1. Create a **new** public repo, e.g. `angara-qa-demo` (not this monorepo’s Pages on the product org if that shares cookies/branding you don’t want).
2. Copy only the contents of `share-demo/` to that repo root (or `docs/`).
3. Enable Pages → Deploy from branch.
4. Custom domain optional: `demo.yourname.dev`, `qa-tool-demo.pages.dev`, etc.

### Netlify / Cloudflare Pages

Drag-drop the `share-demo` folder, or connect the separate demo repo. Publish directory = `/` (or folder with `index.html`).

### S3 + CloudFront

Upload folder; set `index.html` as default object. Own certificate / subdomain.

## Hard rules

- Never reverse-proxy this path onto the QA product origin.
- Never point demo links at staging with real tickets.
- Scrub before changing `demo.json` — no real emails, tokens, customer names, internal hostnames.
- Meta robots is `noindex` by default; remove only if you want search.

## Edit the story

Change `data/demo.json` only. Refresh. Sections: ticket → timeline (CR ∥ generate) → CR findings → quality 7-params → dedupe merges → house/OOB → sample cases.

## Share copy (short)

> Built an AI QA flow: Jira + MR → suite with an independent 7-param quality gate, semantic dedupe, out-of-the-box house cases, and code review that runs *while* cases generate (findings become checklist items). Sample walkthrough (not our product login): [YOUR_DEMO_URL]
