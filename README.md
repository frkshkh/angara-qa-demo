# Angara GenAI Agent — public demo site

Standalone static sales demo (HTML/CSS/JS + `data/demo.json`).

**Not** the product app. Host on its own domain (GitHub Pages / Netlify / Cloudflare).

Live: https://frkshkh.github.io/angara-qa-demo/

## Preview

```bash
cd share-demo
python3 -m http.server 8765
```

## Edit story

Change `data/demo.json` — hero, vs-competitors, agents, sample generate run, CUA/MCP/Jira panels.

## Deploy

Push this folder to the `angara-qa-demo` GitHub repo `main` branch (Pages from `/`).
