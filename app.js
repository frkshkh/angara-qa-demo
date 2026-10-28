/* Standalone demo renderer — no backend, no Angara product host. */

const PASS_MIN = 70;

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function pill(text, kind = '') {
  return el('span', { className: `pill ${kind}`.trim(), text });
}

function renderHero(data) {
  document.getElementById('hero-lead').textContent = data.product.tagline;
  const s = data.run;
  const stats = [
    [String(s.casesAfterDedupe), 'cases after dedupe'],
    [s.checklistProven.split(' ')[0], 'checklist proven'],
    [`${s.merges}`, 'semantic merges'],
    [`${data.qualityGate.overall}`, 'quality / 100'],
    [s.duration, 'sample runtime'],
  ];
  const root = document.getElementById('hero-stats');
  root.replaceChildren(
    ...stats.map(([v, label]) =>
      el('div', { className: 'stat' }, [el('strong', { text: v }), el('span', { text: label })]),
    ),
  );
}

function renderTicket(data) {
  const t = data.ticket;
  const panel = document.getElementById('ticket-panel');
  panel.replaceChildren(
    el('div', { className: 'kicker', text: `${t.type} · ${t.priority}` }),
    el('div', { className: 'ticket-key', text: t.key }),
    el('h3', { text: t.summary, style: 'margin:0.35rem 0 0.75rem;font-size:1.15rem' }),
    el('div', { className: 'kicker', text: 'Acceptance criteria' }),
    el(
      'ul',
      { className: 'ac-list' },
      t.acceptanceCriteria.map((line) => el('li', { text: line })),
    ),
    el('p', {
      style: 'margin:0.9rem 0 0;font-size:0.85rem;color:var(--muted)',
      text: `QA scope: ${t.qaNote}`,
    }),
  );
}

function renderTimeline(data) {
  const root = document.getElementById('timeline');
  root.replaceChildren(
    ...data.timeline.map((step) =>
      el('li', { className: step.highlight === 'cr' ? 'cr' : '' }, [
        el('span', { className: 't', text: step.t }),
        el('div', {}, [
          el('strong', { text: step.label }),
          el('div', { className: 'detail', text: step.detail }),
          step.highlight === 'cr' ? pill('CR ∥ generate', 'cr') : null,
        ]),
      ]),
    ),
  );
}

function renderCr(data) {
  const cr = data.codeReview;
  const root = document.getElementById('cr-panel');
  const mrs = cr.byMr.map((mr) => {
    const bugs = mr.bugs.map((b) =>
      el('div', { className: 'bug' }, [
        el('div', {}, [
          pill(b.severity, b.severity === 'HIGH' ? 'high' : 'warn'),
          ' ',
          pill(b.rule),
          ' ',
          pill(`→ ${b.becameF}`, 'cr'),
        ]),
        el('h4', { text: b.title }),
        el('div', { className: 'loc', text: b.location }),
        el('p', { text: b.problem }),
      ]),
    );
    return el('div', { className: 'panel' }, [
      el('div', { className: 'mr-head' }, [
        el('strong', { text: mr.label }),
        el('span', { className: 'ticket-key', text: `!${mr.iid}` }),
        el('span', { style: 'font-size:0.8rem;color:var(--muted)', text: `→ ${mr.target}` }),
        pill(mr.verdict, 'warn'),
      ]),
      mr.note ? el('p', { style: 'margin:0 0 0.5rem;font-size:0.82rem;color:var(--muted)', text: mr.note }) : null,
      ...bugs,
    ]);
  });

  root.replaceChildren(
    el('div', { className: 'panel', style: 'margin-bottom:0.85rem' }, [
      el('div', { className: 'mr-head' }, [
        pill('Runs with generate', 'cr'),
        pill(`Store scope: ${cr.storeScope}`, 'warn'),
        pill(cr.verdict, 'warn'),
      ]),
      el('p', {
        style: 'margin:0.5rem 0 0;font-size:0.9rem',
        text: 'Accept/Deny gates Save. Generation still continues — F items land on the checklist.',
      }),
    ]),
    ...mrs,
    el('div', { className: 'arrow-note', text: cr.generationLink }),
  );
}

function renderQuality(data) {
  const q = data.qualityGate;
  const root = document.getElementById('quality-panel');
  const rows = q.scores.map((p) => {
    const below = p.score < PASS_MIN;
    return el('div', { className: 'param-row' }, [
      el('span', { text: p.label }),
      el('span', { className: `bar${below ? ' below' : ''}`, 'aria-hidden': 'true' }, [
        el('i', { style: `width:${p.score}%` }),
      ]),
      el('span', { className: 'param-score', text: below ? `${p.score} · below` : String(p.score) }),
    ]);
  });

  const findings = q.findings.length
    ? el('div', { style: 'margin-top:1rem' }, [
        el('div', { className: 'kicker', text: 'Findings' }),
        el(
          'ul',
          { style: 'margin:0.35rem 0 0;padding-left:1.1rem;font-size:0.85rem' },
          q.findings.map((f) =>
            el('li', {}, [
              el('strong', { text: `${f.param}: ` }),
              f.issue,
              el('span', { style: 'color:var(--muted)', text: ` — Fix: ${f.fix}` }),
            ]),
          ),
        ),
      ])
    : el('p', {
        style: 'margin:1rem 0 0;font-size:0.85rem;color:var(--muted)',
        text: 'No blocking findings on this sample run. Missing = 0 · Duplicate groups = 0 · Off-scope = 0.',
      });

  root.replaceChildren(
    el('div', { className: 'score-head' }, [
      el('div', { className: 'score-big', html: `${q.overall}<span> / 100</span>` }),
      pill(q.passed ? 'Pass' : 'Below bar', q.passed ? 'pass' : 'warn'),
      el('span', {
        style: 'font-size:0.78rem;color:var(--muted)',
        text: q.note,
      }),
    ]),
    ...rows,
    findings,
  );
}

function renderDedupe(data) {
  const d = data.dedupe;
  const root = document.getElementById('dedupe-panel');
  root.replaceChildren(
    el('div', { className: 'mr-head' }, [
      pill(`${d.before} → ${d.after} cases`, 'pass'),
      pill(`${d.merges.length} merge examples shown`),
    ]),
    ...d.merges.map((m) =>
      el('div', { className: 'merge' }, [
        el('strong', { text: `Kept ${m.kept}` }),
        el('div', { className: 'folded', text: `Folded: ${m.folded.join(' · ')}` }),
        el('div', { className: 'folded', text: m.why }),
      ]),
    ),
    el('div', { className: 'arrow-note', text: d.guard }),
  );
}

function renderHouse(data) {
  const root = document.getElementById('house-grid');
  root.replaceChildren(
    ...data.houseCases.map((h) =>
      el('div', { className: 'panel house-card' }, [
        pill(h.tag, 'oob'),
        el('h3', { text: h.summary }),
        el('p', { text: h.why }),
        el('p', { style: 'margin-top:0.45rem;color:var(--text)', text: `Expected: ${h.expected}` }),
      ]),
    ),
  );
}

function renderCases(data) {
  const root = document.getElementById('cases-panel');
  root.replaceChildren(
    ...data.cases.map((c) => {
      const badge =
        c.badge && c.badge.includes('CR')
          ? pill(c.badge, 'cr')
          : c.badge
            ? pill(c.badge, 'oob')
            : null;
      return el('details', { className: 'case' }, [
        el('summary', { className: 'case-head' }, [
          el('span', { className: 'n', text: `#${c.n}` }),
          pill(c.priority),
          pill(c.type),
          badge,
          el('strong', { style: 'flex:1 1 12rem', text: c.summary }),
        ]),
        el('div', { style: 'margin-top:0.45rem;font-size:0.78rem;color:var(--muted)', text: `Covers: ${c.covers.join(', ')} · ${c.tags.join(', ')}` }),
        el(
          'ol',
          { className: 'steps' },
          c.steps.map((s) =>
            el('li', {}, [
              el('div', { className: 'a', text: s.action }),
              el('div', { className: 'e', text: s.expected }),
            ]),
          ),
        ),
      ]);
    }),
  );
}

function renderPoints(data) {
  document.getElementById('talking-points').replaceChildren(
    ...data.talkingPoints.map((t) => el('li', { text: t })),
  );
  document.getElementById('footer-disclaimer').textContent = data.product.disclaimer;
}

async function main() {
  const res = await fetch('data/demo.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load demo.json (${res.status})`);
  const data = await res.json();
  document.title = `${data.product.name} — Public demo (sample data)`;
  renderHero(data);
  renderTicket(data);
  renderTimeline(data);
  renderCr(data);
  renderQuality(data);
  renderDedupe(data);
  renderHouse(data);
  renderCases(data);
  renderPoints(data);
}

main().catch((err) => {
  document.getElementById('hero-lead').textContent = `Demo failed to load: ${err.message}. Open via a local static server (see README).`;
});
