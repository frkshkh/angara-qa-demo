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
          el('div', { className: 'ticket-key', text: t.key }),
          el('h3', { text: t.summary }),
          el(
            'ul',
            {},
            t.ac.map((line) => el('li', { text: line })),
          ),
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
                mr.bugs?.length ? pill('Needs decision', 'warn') : pill('Clean', 'pass'),
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
                : [el('div', { className: 'bug-line', text: 'Shared diffs skipped' })],
            ]),
          ),
        ),
      );
      break;
    case 'gate':
      wrap.append(
        el('div', { className: 'gate' }, [
          el('div', { className: 'orb' }, [
            el('div', { className: 'big', text: String(j.overall) }),
            el('div', { className: 'sub', text: '/ 100' }),
            pill('Pass', 'pass'),
          ]),
          el(
            'div',
            {},
            (j.scores || []).map((p) =>
              el('div', { className: 'param' }, [
                el('span', { text: p.l }),
                el('span', { className: 'bar' }, [el('i', { style: `width:${p.s}%` })]),
                el('span', { text: String(p.s) }),
              ]),
            ),
          ),
        ]),
      );
      break;
    case 'cua': {
      const list = el('ul', { className: 'cua-steps', id: 'cua-list' });
      (j.steps || []).forEach((s, i) => {
        list.append(
          el('li', { 'data-i': String(i), className: s.s === 'fail' ? 'fail-row' : '' }, [
            el('span', { text: s.a }),
            pill(s.s === 'fail' ? 'FAIL' : 'OK', s.s === 'fail' ? 'fail' : 'pass'),
          ]),
        );
      });
      wrap.append(
        el('div', { className: 'pill-row' }, [
          pill(`Verdict ${j.verdict}`, 'fail'),
          pill(j.cost || ''),
          pill('Desktop'),
        ]),
        list,
      );
      break;
    }
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
          el(
            'div',
            { className: 'bug-actions' },
            (b.actions || []).map((a, i) => el('span', { className: i === 0 ? 'primary' : '', text: a })),
          ),
        ]),
      );
      break;
    }
    case 'pagespeed':
      wrap.append(
        el('div', { className: 'ticket-key', text: j.url, style: 'margin-bottom:0.65rem;display:block' }),
        el(
          'div',
          { className: 'metric-grid' },
          (j.metrics || []).map((m) =>
            el('div', { className: 'metric' }, [
              el('strong', { text: m.raw || String(m.s) }),
              el('span', { text: m.l }),
            ]),
          ),
        ),
        j.note ? el('div', { className: 'result-banner', text: j.note }) : null,
      );
      break;
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
    checklistTimers.push(setTimeout(() => node.classList.add('on'), 320 + i * 480));
  });
  const n = document.querySelectorAll('#gen-list li').length;
  checklistTimers.push(
    setTimeout(() => {
      const r = document.getElementById('gen-result');
      if (r) r.hidden = false;
    }, 320 + n * 480 + 180),
  );
}

function animateCua() {
  [...document.querySelectorAll('#cua-list li')].forEach((node, i) => {
    checklistTimers.push(setTimeout(() => node.classList.add('on'), 260 + i * 560));
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
  if (j.ui === 'cua') {
    setAurora('fail');
    animateCua();
  } else if (j.ui === 'done') setAurora('done');
  else if (j.ui === 'bug') setAurora('fail');
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
