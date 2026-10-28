/** One page: GO first · CTA → journey · scroll → product tour. */

const VH_PER_SCENE = 1.15;
let data = null;
let scenes = [];
let activeScene = -1;
let step = -1;
let timer = null;
let paused = false;
let checklistTimers = [];
let raf = 0;
let mode = 'home'; // home | journey
let goVisible = true;

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

function setAurora(m) {
  const a = document.querySelector('.aurora');
  a.className = 'aurora';
  if (m) a.classList.add(m);
}

function burstFx() {
  const ring = document.querySelector('.fx-ring');
  ring.classList.remove('on');
  void ring.offsetWidth;
  ring.classList.add('on');
}

/* ---------- Tour scene builders ---------- */

function buildScene(d) {
  const root = el('article', { className: 'scene', 'data-id': d.id, 'aria-hidden': 'true' });
  root.append(el('h2', { text: d.title }));
  if (d.body) root.append(el('p', { className: 'body', text: d.body }));

  switch (d.id) {
    case 'hero':
      root.append(
        el(
          'div',
          { className: 'stats' },
          (d.stats || []).map((s) =>
            el('div', { className: 'stat' }, [el('strong', { text: s.v }), el('span', { text: s.l })]),
          ),
        ),
        el('div', { className: 'pill-row', style: 'margin-top:1rem' }, [
          el('button', {
            type: 'button',
            className: 'btn btn-primary',
            text: 'Launch Autopilot ↑',
            onclick: () => goToAutopilot(),
          }),
        ]),
      );
      break;
    case 'pain':
      root.append(
        el(
          'div',
          { className: 'card-grid' },
          (d.cards || []).map((c) =>
            el('div', { className: `mini-card ${c.bad ? 'bad' : 'good'}` }, [
              el('h3', { text: c.h }),
              el('p', { text: c.p }),
            ]),
          ),
        ),
      );
      break;
    case 'loop':
      root.append(
        el(
          'div',
          { className: 'steps-row' },
          (d.steps || []).map((s) =>
            el('div', { className: 'step' }, [
              el('span', { className: 'n', text: s.n }),
              el('strong', { text: s.h }),
              el('p', { text: s.p }),
            ]),
          ),
        ),
      );
      break;
    case 'generate': {
      const t = d.ticket || {};
      root.append(
        el('div', { className: 'pill-row' }, (d.pills || []).map((p) => pill(p, 'pass'))),
        el('div', { className: 'ticket-box' }, [
          el('div', { className: 'ticket-key', text: t.key || '' }),
          el('h3', { text: t.summary || '' }),
          el(
            'ul',
            {},
            (t.ac || []).map((line) => el('li', { text: line })),
          ),
        ]),
      );
      break;
    }
    case 'cr':
      root.append(
        el(
          'div',
          { className: 'mr-row' },
          (d.mrs || []).map((mr) =>
            el('div', { className: 'mr-card' }, [
              el('header', {}, [
                el('strong', { text: mr.label }),
                pill(mr.iid, 'cr'),
                pill(mr.verdict, mr.verdict === 'Clean' ? 'pass' : 'warn'),
              ]),
              ...(mr.bugs || []).length
                ? mr.bugs.map((b) =>
                    el('div', { className: 'bug-line' }, [
                      pill(b.sev, b.sev === 'HIGH' ? 'high' : 'warn'),
                      ' ',
                      pill(`→ ${b.f}`, 'cr'),
                      el('div', { text: b.t, style: 'margin-top:0.25rem' }),
                    ]),
                  )
                : [el('div', { className: 'bug-line', text: 'Shared diffs skipped · locale checks ran' })],
            ]),
          ),
        ),
      );
      break;
    case 'gate':
      root.append(
        el('div', { className: 'gate-layout' }, [
          el('div', { className: 'score-orb' }, [
            el('div', { className: 'big', text: String(d.overall) }),
            el('div', { className: 'sub', text: '/ 100' }),
            pill(d.passed ? 'Pass · strong' : 'Below', d.passed ? 'pass' : 'warn'),
          ]),
          el('div', {}, [
            ...(d.scores || []).map((p) =>
              el('div', { className: 'param' }, [
                el('span', { text: p.l }),
                el('span', { className: 'bar' }, [el('i', { style: `width:${p.s}%` })]),
                el('span', { text: String(p.s) }),
              ]),
            ),
            el('div', { className: 'note', text: d.dedupe || '' }),
            el(
              'div',
              { className: 'house-pills' },
              (d.house || []).map((h) => pill(h, 'pass')),
            ),
          ]),
        ]),
      );
      break;
    case 'run':
      root.append(
        el(
          'div',
          { className: 'run-panels' },
          (d.panels || []).map((p) =>
            el('div', { className: 'run-panel' }, [
              pill(p.tag, 'cr'),
              el('h3', { text: p.h, style: 'margin:0.4rem 0 0;font-size:1.02rem' }),
              el(
                'ol',
                {},
                (p.lines || []).map((line) => el('li', { text: line })),
              ),
            ]),
          ),
        ),
      );
      break;
    case 'platform': {
      const toneClass = (h) => {
        const t = (h || '').toLowerCase();
        if (t.includes('bad') || t.includes('3.4') || t.includes('61')) return 'mini-card bad';
        if (t.includes('good') || t.includes('cls')) return 'mini-card good';
        return 'mini-card';
      };
      root.append(
        el(
          'div',
          { className: 'plat-grid' },
          (d.grid || []).map((g) =>
            el('div', { className: toneClass(g.h) }, [
              el('h3', { text: g.h }),
              el('p', { text: g.p }),
              /AI verdict/i.test(g.h || '')
                ? pill(g.h.includes('BAD') ? 'BAD' : 'GOOD', g.h.includes('BAD') ? 'fail' : 'pass')
                : null,
            ]),
          ),
        ),
      );
      break;
    }
    case 'close':
      root.append(
        el('div', { className: 'cta-line' }, [
          el('button', {
            type: 'button',
            className: 'btn btn-primary',
            text: d.cta || 'Run Autopilot →',
            onclick: () => {
              goToAutopilot();
              setTimeout(startJourney, 480);
            },
          }),
        ]),
      );
      break;
    default:
      break;
  }
  return root;
}

function setActiveScene(i) {
  if (i === activeScene || i < 0 || i >= scenes.length) return;
  const prev = activeScene;
  activeScene = i;
  document.querySelectorAll('.scene').forEach((node, idx) => {
    const on = idx === i;
    node.classList.toggle('active', on);
    node.classList.toggle('exit-up', !on && prev >= 0 && idx === prev && i > prev);
    node.classList.toggle('exit-down', !on && prev >= 0 && idx === prev && i < prev);
    node.setAttribute('aria-hidden', on ? 'false' : 'true');
  });
  const s = scenes[i];
  document.getElementById('scene-index').textContent = String(i + 1).padStart(2, '0');
  document.getElementById('scene-kicker').textContent = s.kicker || '';
  document.getElementById('scroll-hint').classList.toggle('hide', i > 0);
  document.querySelectorAll('.scene-dots button').forEach((btn, idx) => {
    btn.setAttribute('aria-current', idx === i ? 'true' : 'false');
  });
}

function layoutTrack() {
  const track = document.getElementById('scroll-track');
  track.style.height = `${Math.round(scenes.length * VH_PER_SCENE * window.innerHeight)}px`;
}

function sceneFromTourScroll() {
  const zone = document.getElementById('tour-zone');
  const track = document.getElementById('scroll-track');
  const zoneTop = zone.offsetTop;
  const localY = Math.max(0, window.scrollY - zoneTop);
  const max = Math.max(1, track.offsetHeight - window.innerHeight);
  const t = Math.min(1, localY / max);
  const idx = Math.min(scenes.length - 1, Math.floor(t * scenes.length));
  document.getElementById('progress-bar').style.width = `${Math.round(t * 100)}%`;
  setActiveScene(idx);
}

function updateFrameFromScroll() {
  if (mode === 'journey') return;
  const goH = document.getElementById('frame-go').offsetHeight || window.innerHeight;
  const y = window.scrollY;
  const nextGo = y < goH * 0.55;
  if (nextGo !== goVisible) {
    goVisible = nextGo;
    document.body.dataset.frame = nextGo ? 'go' : 'tour';
    document.body.classList.toggle('on-tour', !nextGo);
    document.getElementById('scroll-cue')?.classList.toggle('hide', !nextGo || y > 40);
  }
  if (!nextGo) sceneFromTourScroll();
  else document.getElementById('progress-bar').style.width = '0%';
}

function onScroll() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    updateFrameFromScroll();
  });
}

function jumpToScene(i) {
  const zone = document.getElementById('tour-zone');
  const track = document.getElementById('scroll-track');
  const max = Math.max(1, track.offsetHeight - window.innerHeight);
  const top = zone.offsetTop + ((i + 0.1) / scenes.length) * max;
  window.scrollTo({ top, behavior: 'smooth' });
}

function goToAutopilot() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.body.dataset.frame = 'go';
  document.body.classList.remove('on-tour');
  goVisible = true;
  setTimeout(() => document.getElementById('story-input')?.focus(), 420);
}

/* ---------- Journey renderers ---------- */

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
              el('div', { className: 'pill-row' }, [pill(`AI verdict · ${ai.verdict}`, verdictKind)]),
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
          el('button', {
            type: 'button',
            className: 'btn btn-secondary',
            text: 'Product tour ↓',
            onclick: () => {
              exitJourney();
              setTimeout(() => jumpToScene(0), 120);
            },
          }),
          el('button', { type: 'button', className: 'btn btn-ghost', text: 'Back to GO', onclick: () => exitJourney() }),
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
  paused = false;
  document.getElementById('btn-pause').textContent = 'Pause';

  const j = journey[i];
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
  if (['cua-testset', 'cua-manual', 'cua-adversarial', 'cua-advisory'].includes(j.ui)) animateCua();
  if (j.ui === 'cua-adversarial' || j.ui === 'bug' || (j.ui === 'pagespeed' && j.ai?.verdict === 'BAD')) setAurora('fail');
  else if (j.ui === 'done' || (j.ui === 'pagespeed' && j.ai?.verdict === 'GOOD')) setAurora('done');
  else setAurora('running');

  if (j.duration > 0) {
    timer = setTimeout(() => {
      if (!paused) showStep(i + 1);
    }, j.duration);
  }
}

function startJourney() {
  if (mode === 'journey') return;
  burstFx();
  document.getElementById('go-btn').classList.add('launching');
  document.body.classList.add('launching');
  window.scrollTo(0, 0);

  setTimeout(() => {
    mode = 'journey';
    document.body.className = 'mode-journey';
    document.body.dataset.frame = 'journey';
    document.documentElement.classList.add('lock-scroll');
    document.getElementById('landing').hidden = true;
    document.getElementById('frame-go').hidden = true;
    document.getElementById('tour-zone').hidden = true;
    document.getElementById('frame-journey').hidden = false;
    document.getElementById('top-status').hidden = false;
    document.getElementById('top-actions').hidden = false;
    document.getElementById('frame-journey').classList.add('enter');
    setAurora('running');
    showStep(0);
  }, 420);
}

function exitJourney() {
  clearTimers();
  step = -1;
  mode = 'home';
  document.documentElement.classList.remove('lock-scroll');
  document.body.className = 'mode-home';
  document.body.dataset.frame = 'go';
  document.getElementById('frame-journey').hidden = true;
  document.getElementById('frame-journey').classList.remove('enter');
  document.getElementById('frame-go').hidden = false;
  document.getElementById('landing').hidden = false;
  document.getElementById('tour-zone').hidden = false;
  document.getElementById('top-status').hidden = true;
  document.getElementById('top-actions').hidden = true;
  document.getElementById('go-btn').classList.remove('launching');
  setAurora('');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  goVisible = true;
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

/* ---------- Boot ---------- */

async function main() {
  const res = await fetch(`data/demo.json?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`demo.json ${res.status}`);
  data = await res.json();
  scenes = data.scenes || [];
  document.title = data.product.name;
  document.getElementById('foot-note').textContent = data.product.disclaimer;

  const L = data.landing;
  document.getElementById('landing-greet').textContent = L.greeting;
  document.getElementById('landing-prompt').textContent = L.prompt;
  document.getElementById('landing-hint').textContent = L.hint;
  document.getElementById('go-label').textContent = L.cta;
  document.getElementById('story-input').value = L.placeholder;

  document.getElementById('stage-frame').replaceChildren(...scenes.map(buildScene));
  document.getElementById('scene-dots').replaceChildren(
    ...scenes.map((s, i) =>
      el('button', {
        type: 'button',
        title: s.kicker || s.title,
        'aria-label': s.kicker || s.title,
        onclick: () => jumpToScene(i),
      }),
    ),
  );

  layoutTrack();
  setActiveScene(0);

  document.getElementById('go-btn').addEventListener('click', startJourney);
  document.getElementById('story-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startJourney();
  });
  document.getElementById('btn-pause').addEventListener('click', togglePause);
  document.getElementById('btn-skip').addEventListener('click', skip);
  document.getElementById('btn-exit').addEventListener('click', exitJourney);
  document.getElementById('btn-to-go').addEventListener('click', goToAutopilot);
  document.getElementById('brand-home').addEventListener('click', (e) => {
    if (mode === 'journey') {
      e.preventDefault();
      exitJourney();
    }
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    layoutTrack();
    updateFrameFromScroll();
  });

  if (location.hash === '#go' || location.hash === '#autopilot') {
    goToAutopilot();
  } else if (location.hash === '#tour') {
    setTimeout(() => jumpToScene(0), 80);
  }

  updateFrameFromScroll();
  document.body.classList.add('ready');
}

main().catch((err) => {
  document.getElementById('landing-hint').textContent = String(err.message || err);
});
