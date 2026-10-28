/** Scroll sticky product tour (general demo). */

const VH_PER_SCENE = 1.05;
let scenes = [];
let active = -1;
let raf = 0;

function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
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

function buildScene(data) {
  const root = el('article', { className: 'scene', 'data-id': data.id, 'aria-hidden': 'true' });
  root.append(el('h2', { text: data.title }));
  if (data.body) root.append(el('p', { className: 'body', text: data.body }));

  switch (data.id) {
    case 'hero':
      root.append(
        el(
          'div',
          { className: 'stats' },
          (data.stats || []).map((s) =>
            el('div', { className: 'stat' }, [el('strong', { text: s.v }), el('span', { text: s.l })]),
          ),
        ),
        el('div', { className: 'pill-row', style: 'margin-top:1rem' }, [
          el('a', { className: 'btn btn-primary', href: 'autopilot.html', text: 'Launch Autopilot →' }),
        ]),
      );
      break;
    case 'pain':
      root.append(
        el(
          'div',
          { className: 'card-grid' },
          (data.cards || []).map((c) =>
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
          (data.steps || []).map((s) =>
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
      const t = data.ticket || {};
      root.append(
        el('div', { className: 'pill-row' }, (data.pills || []).map((p) => pill(p, 'pass'))),
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
          (data.mrs || []).map((mr) =>
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
            el('div', { className: 'big', text: String(data.overall) }),
            el('div', { className: 'sub', text: '/ 100' }),
            pill(data.passed ? 'Pass · strong' : 'Below', data.passed ? 'pass' : 'warn'),
          ]),
          el('div', {}, [
            ...(data.scores || []).map((p) =>
              el('div', { className: 'param' }, [
                el('span', { text: p.l }),
                el('span', { className: 'bar' }, [el('i', { style: `width:${p.s}%` })]),
                el('span', { text: String(p.s) }),
              ]),
            ),
            el('div', { className: 'note', text: data.dedupe || '' }),
            el(
              'div',
              { className: 'house-pills' },
              (data.house || []).map((h) => pill(h, 'pass')),
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
          (data.panels || []).map((p) =>
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
          (data.grid || []).map((g) =>
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
          el('a', { className: 'btn btn-primary', href: 'autopilot.html', text: data.cta || 'Open Autopilot →' }),
        ]),
      );
      break;
    default:
      break;
  }
  return root;
}

function setActive(i) {
  if (i === active || i < 0 || i >= scenes.length) return;
  active = i;
  document.querySelectorAll('.scene').forEach((node, idx) => {
    const on = idx === i;
    node.classList.toggle('active', on);
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

function sceneFromScroll() {
  const track = document.getElementById('scroll-track');
  const max = Math.max(1, track.offsetHeight - window.innerHeight);
  const y = Math.min(max, Math.max(0, window.scrollY));
  const t = y / max;
  const idx = Math.min(scenes.length - 1, Math.floor(t * scenes.length));
  document.getElementById('progress-bar').style.width = `${Math.round(t * 100)}%`;
  setActive(idx);
}

function onScroll() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    sceneFromScroll();
  });
}

function jumpTo(i) {
  const track = document.getElementById('scroll-track');
  const max = Math.max(1, track.offsetHeight - window.innerHeight);
  window.scrollTo({ top: ((i + 0.12) / scenes.length) * max, behavior: 'smooth' });
}

function layoutTrack() {
  document.getElementById('scroll-track').style.height = `${Math.round(scenes.length * VH_PER_SCENE * window.innerHeight)}px`;
}

async function main() {
  const res = await fetch(`data/demo.json?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`demo.json ${res.status}`);
  const data = await res.json();
  scenes = data.scenes || [];
  document.title = `${data.product.name} · Product tour`;
  document.getElementById('foot-note').textContent = data.product.disclaimer;

  document.getElementById('stage-frame').replaceChildren(...scenes.map(buildScene));
  document.getElementById('scene-dots').replaceChildren(
    ...scenes.map((s, i) =>
      el('button', { type: 'button', title: s.kicker || s.title, 'aria-label': s.kicker || s.title, onclick: () => jumpTo(i) }),
    ),
  );

  layoutTrack();
  setActive(0);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    layoutTrack();
    sceneFromScroll();
  });
  sceneFromScroll();
}

main().catch((err) => {
  document.getElementById('scene-kicker').textContent = 'Error';
  document.getElementById('stage-frame').textContent = String(err.message || err);
});
