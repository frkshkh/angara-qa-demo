/** GO autopilot — separate feature from the scroll product tour. */

let data = null;
let step = -1;
let timer = null;
let paused = false;
let checklistTimers = [];

function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v != null) n.setAttribute(k, String(v));
  }
  for (const c of [].concat(kids)) {
    if (c == null || c === false) continue;
    n.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return n;
}

function pill(text, kind = '') {
  return el('span', { className: `pill ${kind}`.trim(), text });
}

function clearTimers() {
  if (timer) clearTimeout(timer);
  timer = null;
  checklistTimers.forEach(clearTimeout);
  checklistTimers = [];
}

function setAurora(mode) {
  const a = document.querySelector('.aurora');
  a.className = 'aurora';
  if (mode) a.classList.add(mode);
}

function renderStage(j) {
  const wrap = el('div', { className: 'stage-inner' });

  switch (j.ui) {
    case 'ticket': {
      const t = j.ticket;
      wrap.append(
        el('div', { className: 'ticket-box' }, [
          el('div', { className: 'pill-row' }, [pill(t.key, 'cr'), t.type ? pill(t.type) : null]),
          el('h3', { text: t.summary }),
          el(
            'ul',
            {},
            t.ac.map((line) => el('li', { text: line })),
          ),
          t.meta
            ? el(
                'div',
                { className: 'meta-grid' },
                t.meta.map((m) =>
                  el('div', { className: 'meta-cell' }, [
                    el('span', { className: 'l', text: m.k }),
                    el('span', { className: 'v', text: m.v }),
                  ]),
                ),
              )
            : null,
        ]),
      );
      break;
    }
    case 'generate': {
      const list = el('ul', { className: 'checklist', id: 'gen-list' });
      (j.progress || []).forEach((row, i) => {
        list.append(
          el('li', { 'data-i': String(i) }, [
            el('span', { className: 'tick', text: '✓' }),
            el('span', { text: row.t }),
          ]),
        );
      });
      wrap.append(list);
      if (j.result) wrap.append(el('div', { className: 'result-banner', text: j.result, id: 'gen-result', hidden: true }));
      if (j.casesPreview?.length) {
        wrap.append(
          el(
            'div',
            { className: 'case-preview', id: 'gen-preview', hidden: true },
            j.casesPreview.map((c) =>
              el('div', { className: 'case-row' }, [
                el('span', { className: 'n', text: `#${c.n}` }),
                pill(c.p),
                c.badge ? pill(c.badge, 'cr') : null,
                el('span', { text: c.s }),
              ]),
            ),
          ),
        );
      }
      break;
    }
    case 'cr':
      wrap.append(
        el(
          'div',
          { className: 'mr-grid' },
          (j.mrs || []).map((mr) =>
            el('div', { className: 'mr-card' }, [
              el('header', {}, [
                el('span', { text: mr.label }),
                mr.target ? pill(mr.target) : null,
                mr.bugs?.length ? pill(mr.verdict || 'Needs decision', 'warn') : pill(mr.verdict || 'Clean', 'pass'),
              ]),
              ...(mr.bugs || []).length
                ? mr.bugs.map((b) =>
                    el('div', { className: 'bug-line' }, [
                      pill(b.sev, b.sev === 'HIGH' ? 'high' : 'warn'),
                      ' ',
                      b.rule ? pill(b.rule) : null,
                      ' ',
                      pill(`→ ${b.f}`, 'cr'),
                      el('div', { text: b.t, style: 'margin-top:0.25rem' }),
                    ]),
                  )
                : [el('div', { className: 'bug-line', text: 'Shared diffs skipped · locale OK' })],
            ]),
          ),
        ),
        j.note ? el('div', { className: 'result-banner', text: j.note }) : null,
      );
      break;
    case 'gate':
      wrap.append(
        el('div', { className: 'gate' }, [
          el('div', { className: 'orb' }, [
            el('div', { className: 'big', text: String(j.overall) }),
            el('div', { className: 'sub', text: '/ 100' }),
            pill(j.passed ? 'Pass · strong' : 'Below', j.passed ? 'pass' : 'warn'),
          ]),
          el('div', {}, [
            ...(j.scores || []).map((p) =>
              el('div', { className: 'param' }, [
                el('span', { text: p.l }),
                el('span', { className: 'bar' }, [el('i', { style: `width:${p.s}%` })]),
                el('span', { text: String(p.s) }),
              ]),
            ),
            j.extras
              ? el(
                  'div',
                  { className: 'meta-grid tight' },
                  j.extras.map((x) =>
                    el('div', { className: 'meta-cell' }, [
                      el('span', { className: 'l', text: x.k }),
                      el('span', { className: 'v', text: x.v }),
                    ]),
                  ),
                )
              : null,
          ]),
        ]),
      );
      break;
    case 'cua-advisory':
      wrap.append(
        el(
          'ul',
          { className: 'advisory-list', id: 'cua-list' },
          (j.advisories || []).map((a) =>
            el('li', {}, [
              el('div', { className: 'pill-row' }, [
                pill(a.kind, a.kind === 'merge' ? 'cr' : 'warn'),
                pill(a.action, a.action === 'Group' ? 'pass' : 'warn'),
              ]),
              el('strong', { text: a.case }),
              el('p', { text: a.why }),
            ]),
          ),
        ),
        j.summary ? el('div', { className: 'result-banner', text: j.summary }) : null,
      );
      break;
    case 'cua-testset': {
      const set = j.set || {};
      wrap.append(
        el('div', { className: 'pill-row' }, [
          pill(set.key || 'Test Set', 'cr'),
          pill(set.env || ''),
          pill(`${set.selected}/${set.total} cases`),
          pill(set.cost || ''),
        ]),
        el(
          'ul',
          { className: 'cua-steps', id: 'cua-list' },
          (j.runs || []).map((r) =>
            el('li', { className: r.v === 'FAIL' ? 'fail-row' : '' }, [
              el('span', { text: r.case }),
              el('span', { className: 'row-end' }, [pill(r.v, r.v === 'FAIL' ? 'fail' : 'pass'), pill(r.cost || '')]),
            ]),
          ),
        ),
        j.batch ? el('div', { className: 'result-banner', text: j.batch }) : null,
      );
      break;
    }
    case 'cua-manual':
      wrap.append(
        el('div', { className: 'intent-box' }, [
          el('div', { className: 'kicker', text: 'Manual intent' }),
          el('p', { text: j.intent }),
        ]),
        el('div', { className: 'pill-row' }, [
          pill(`Verdict ${j.verdict}`, j.verdict === 'PASS' ? 'pass' : 'fail'),
          pill(j.cost || ''),
          ...(j.artifacts || []).map((a) => pill(a)),
        ]),
        el(
          'ol',
          { className: 'plan-list', id: 'cua-list' },
          (j.plan || []).map((line) => el('li', { text: line })),
        ),
      );
      break;
    case 'cua-adversarial':
      wrap.append(
        el('div', { className: 'pill-row' }, [
          pill('Adversarial', 'high'),
          pill(j.verdict || '', 'fail'),
          pill(j.cost || ''),
        ]),
        el(
          'ul',
          { className: 'cua-steps', id: 'cua-list' },
          (j.plan || []).map((r) =>
            el('li', { className: r.v === 'FAIL' ? 'fail-row' : '' }, [
              el('div', {}, [
                el('div', { text: r.a }),
                el('div', { className: 'muted', text: r.note }),
              ]),
              pill(r.v, r.v === 'FAIL' ? 'fail' : 'pass'),
            ]),
          ),
        ),
      );
      break;
    case 'evidence':
      wrap.append(
        el(
          'ul',
          { className: 'evidence-list' },
          (j.items || []).map((it) => el('li', {}, [el('strong', { text: it.k }), el('span', { text: it.v })])),
        ),
      );
      break;
    case 'bug': {
      const b = j.bug;
      wrap.append(
        el('div', { className: 'bug-card' }, [
          el('div', {}, [pill(b.status, 'warn'), ' ', pill(b.sev, 'high')]),
          el('h3', { text: b.summary }),
          el('p', { text: b.covers }),
          b.repro
            ? el(
                'ol',
                { className: 'plan-list' },
                b.repro.map((line) => el('li', { text: line })),
              )
            : null,
          el(
            'div',
            { className: 'bug-actions' },
            (b.actions || []).map((a, i) => el('span', { className: i === 0 ? 'primary' : '', text: a })),
          ),
        ]),
      );
      break;
    }
    case 'pagespeed': {
      const ai = j.ai;
      const verdictKind = ai?.verdict === 'GOOD' ? 'pass' : ai?.verdict === 'BAD' ? 'fail' : 'warn';
      wrap.append(
        el('div', { className: 'pill-row' }, [
          pill(j.device || 'PSI', 'cr'),
          el('span', { className: 'ticket-key', text: j.url }),
        ]),
        el(
          'div',
          { className: 'metric-grid' },
          (j.metrics || []).map((m) =>
            el('div', { className: `metric tone-${m.tone || 'ok'}` }, [
              el('strong', { text: m.raw || String(m.s) }),
              el('span', { text: m.l }),
            ]),
          ),
        ),
        ai
          ? el('div', { className: `ai-verdict ${verdictKind}` }, [
              el('div', { className: 'pill-row' }, [
                pill(`AI verdict · ${ai.verdict}`, verdictKind),
              ]),
              el('h3', { text: ai.headline }),
              el(
                'ul',
                { className: 'ai-bullets' },
                (ai.bullets || []).map((b) => el('li', { text: b })),
              ),
            ])
          : null,
        j.compare ? el('div', { className: 'result-banner', text: j.compare }) : null,
      );
      break;
    }
    case 'done':
      wrap.append(
        el(
          'div',
          { className: 'summary-grid' },
          (j.summary || []).map((s) =>
            el('div', {}, [el('div', { className: 'l', text: s.l }), el('div', { className: 'v', text: s.v })]),
          ),
        ),
        el('div', { className: 'done-cta' }, [
          el('button', { type: 'button', className: 'btn btn-primary', text: 'Run again', onclick: () => restart() }),
          el('a', { className: 'btn btn-secondary', href: './', text: 'Product tour' }),
          el('button', { type: 'button', className: 'btn btn-ghost', text: 'Back to GO', onclick: () => showLanding() }),
        ]),
      );
      break;
    default:
      break;
  }

  document.getElementById('j-stage').replaceChildren(wrap);
}

function animateGenerate() {
  [...document.querySelectorAll('#gen-list li')].forEach((node, i) => {
    checklistTimers.push(setTimeout(() => node.classList.add('on'), 280 + i * 420));
  });
  const n = document.querySelectorAll('#gen-list li').length;
  checklistTimers.push(
    setTimeout(() => {
      const r = document.getElementById('gen-result');
      if (r) r.hidden = false;
      const p = document.getElementById('gen-preview');
      if (p) p.hidden = false;
    }, 280 + n * 420 + 160),
  );
}

function animateCua() {
  [...document.querySelectorAll('#cua-list li')].forEach((node, i) => {
    checklistTimers.push(setTimeout(() => node.classList.add('on'), 220 + i * 480));
  });
}

function showStep(i) {
  clearTimers();
  const journey = data.journey;
  if (i < 0 || i >= journey.length) return;
  step = i;
  const j = journey[i];
  paused = false;
  document.getElementById('btn-pause').textContent = 'Pause';

  document.getElementById('j-phase').textContent = j.phase;
  document.getElementById('j-title').textContent = j.title;
  document.getElementById('j-voice').textContent = j.voice;
  document.getElementById('top-phase').textContent = j.phase;
  document.getElementById('j-progress').style.width = `${Math.round(((i + 1) / journey.length) * 100)}%`;
  document.getElementById('rail').style.transform = `scaleY(${(i + 1) / journey.length})`;

  const panel = document.getElementById('journey');
  panel.classList.remove('swap');
  void panel.offsetWidth;
  panel.classList.add('swap');

  renderStage(j);
  if (j.ui === 'generate') animateGenerate();
  if (j.ui === 'cua-testset' || j.ui === 'cua-manual' || j.ui === 'cua-adversarial' || j.ui === 'cua-advisory') {
    animateCua();
  }
  if (j.ui === 'cua-adversarial' || j.ui === 'bug' || (j.ui === 'pagespeed' && j.ai?.verdict === 'BAD')) setAurora('fail');
  else if (j.ui === 'done') setAurora('done');
  else if (j.ui === 'pagespeed' && j.ai?.verdict === 'GOOD') setAurora('done');
  else setAurora('running');

  if (j.duration > 0) {
    timer = setTimeout(() => {
      if (!paused) showStep(i + 1);
    }, j.duration);
  }
}

function startJourney() {
  document.getElementById('go-btn').classList.add('launching');
  setTimeout(() => {
    document.getElementById('landing').hidden = true;
    document.getElementById('journey').hidden = false;
    document.getElementById('top-status').hidden = false;
    document.getElementById('top-actions').hidden = false;
    setAurora('running');
    showStep(0);
  }, 350);
}

function showLanding() {
  clearTimers();
  step = -1;
  document.getElementById('journey').hidden = true;
  document.getElementById('landing').hidden = false;
  document.getElementById('top-status').hidden = true;
  document.getElementById('top-actions').hidden = true;
  document.getElementById('go-btn').classList.remove('launching');
  setAurora('');
}

function restart() {
  clearTimers();
  setAurora('running');
  showStep(0);
}

function togglePause() {
  if (step < 0) return;
  paused = !paused;
  document.getElementById('btn-pause').textContent = paused ? 'Resume' : 'Pause';
  if (paused) clearTimers();
  else if (data.journey[step].duration > 0 && step < data.journey.length - 1) {
    timer = setTimeout(() => showStep(step + 1), 2000);
  }
}

function skip() {
  if (step < 0 || step >= data.journey.length - 1) return;
  showStep(step + 1);
}

async function main() {
  const res = await fetch(`data/demo.json?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`demo.json ${res.status}`);
  data = await res.json();
  document.title = `Autopilot · ${data.product.name}`;
  document.getElementById('foot-note').textContent = data.product.disclaimer;

  const L = data.landing;
  document.getElementById('landing-greet').textContent = L.greeting;
  document.getElementById('landing-prompt').textContent = L.prompt;
  document.getElementById('landing-hint').textContent = L.hint;
  document.getElementById('go-label').textContent = L.cta;
  const input = document.getElementById('story-input');
  input.value = L.placeholder;

  document.getElementById('go-btn').addEventListener('click', startJourney);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startJourney();
  });
  document.getElementById('btn-pause').addEventListener('click', togglePause);
  document.getElementById('btn-skip').addEventListener('click', skip);
  document.getElementById('btn-restart').addEventListener('click', showLanding);
}

main().catch((err) => {
  document.getElementById('landing-hint').textContent = String(err.message || err);
});
