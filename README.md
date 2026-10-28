# Angara GenAI Agent — GO autopilot demo

Landing CTA → **GO** starts end-to-end autopilot in one frame:

**Story → Generate TCs → Multi-MR CR → Quality gate → CUA → Evidence → Bug (human-gated) → PageSpeed → Done**

Live: https://frkshkh.github.io/angara-qa-demo/

## Local

```bash
cd share-demo && python3 -m http.server 8765
# open http://127.0.0.1:8765 → click GO
```

## Edit

`data/demo.json` — `landing` + `journey[]` (phase timing via `duration` ms).
