/* Angara GenAI Agent — sales demo (static sample data). */

const PASS_MIN = 70;

const AGENT_ANCHORS = {
  generate: '#sample',
  cr: '#sample',
  cua: '#run-agents',
  automation: '#run-agents',
  'qa-agent': '#agents',
  mcp: '#run-agents',
  jira: '#run-agents',
  audits: '#agents',
};

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
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

function observeReveals() {
  const nodes = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    nodes.forEach((n) => n.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
  );
  nodes.forEach((n) => io.observe(n));
}

function renderHero(data) {
  const p = data.product;
  document.getElementById('hero-eyebrow').textContent = p.eyebrow;
  document.getElementById('hero-lead').textContent = p.tagline;
  document.getElementById('hero-sub').textContent = p.sub;
  document.getElementById('cta-primary').textContent = p.ctaPrimary;
  document.getElementById('cta-secondary').textContent = p.ctaSecondary;
  document.title = `${p.name} — GenAI QA platform`;

  document.getElementById('hero-stats').replaceChildren(
    ...(data.heroProof || []).map((s) =>
      el('div', { className: 'stat' }, [el('strong', { text: s.value }), el('span', { text: s.label })]),
    ),
  );
}

function renderWhy(data) {
  const w = data.painVsUs;
  if (!w) return;
  document.getElementById('why-title').textContent = w.title;
  document.getElementById('why-sub').textContent = w.subtitle;
  document.getElementById('compare-rows').replaceChildren(
    ...w.rows.map((row) =>
      el('div', { className: 'compare-row reveal' }, [
        el('div', { className: 'compare-card them' }, [
          el('div', { className: 'label', text: 'Normal tools' }),
          el('h3', { text: row.them }),
          el('p', { text: row.themDetail }),
        ]),
        el('div', { className: 'compare-card us' }, [
          el('div', { className: 'label', text: 'Angara GenAI Agent' }),
          el('h3', { text: row.us }),
          el('p', { text: row.usDetail }),
        ]),
      ]),
    ),
  );
}

function renderLoop(data) {
  document.getElementById('power-loop').replaceChildren(
    ...(data.powerLoop || []).map((step) =>
      el('li', {}, [
        el('span', { className: 'n', text: step.n }),
        el('strong', { text: step.title }),
        el('p', { text: step.text }),
      ]),
    ),
  );
}

function renderAgents(data) {
  document.getElementById('agent-grid').replaceChildren(
    ...(data.agents || []).map((a) =>
      el('a', { className: 'agent-card reveal', href: AGENT_ANCHORS[a.id] || '#agents' }, [
        el('div', { className: 'power', text: a.power || a.id }),
        el('h3', { text: a.name }),
        el('p', { className: 'blurb', text: a.blurb }),
        el(
          'ul',
          {},
          (a.bullets || []).map((b) => el('li', { text: b })),
        ),
        el('div', { className: 'sample', text: a.sample }),
      ]),
    ),
  );
}

function renderTicket(data) {
  const t = data.ticket;
  const run = data.run;
  document.getElementById('ticket-panel').replaceChildren(
    el('div', { className: 'mr-head' }, [
      pill(run.mode, 'cr'),
      ...run.options.map((o) => pill(o)),
      pill(`${run.casesAfterDedupe} cases`),
      pill(`${run.checklistProven} proven`, 'pass'),
      pill(run.cost),
      pill(run.duration),
    ]),
    el('div', { className: 'kicker', style: 'margin-top:0.85rem', text: `${t.type} · ${t.priority}` }),
    el('div', { className: 'ticket-key', text: t.key }),
    el('h3', { text: t.summary, style: 'margin:0.35rem 0 0.75rem;font-size:1.2rem;font-family:var(--display);font-weight:550' }),
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
  document.getElementById('timeline').replaceChildren(
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
    const bugs = (mr.bugs || []).map((b) =>
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
        pill(mr.verdict, mr.verdict.includes('No blocking') ? 'pass' : 'warn'),
      ]),
      mr.note ? el('p', { style: 'margin:0 0 0.5rem;font-size:0.82rem;color:var(--muted)', text: mr.note }) : null,
      ...(bugs.length
        ? bugs
        : [el('p', { style: 'margin:0.35rem 0 0;font-size:0.82rem;color:var(--muted)', text: 'No AI findings after shared-file skip — locale & conflict checks still ran.' })]),
    ]);
  });

  root.replaceChildren(
    el('div', { className: 'panel', style: 'margin-bottom:0.85rem' }, [
      el('div', { className: 'mr-head' }, [
        pill('Multi-MR · runs with generate', 'cr'),
        pill(`Store scope: ${cr.storeScope}`, 'warn'),
        pill(`${cr.byMr.length} MRs`),
        pill(cr.verdict, 'warn'),
      ]),
      el('p', {
        style: 'margin:0.5rem 0 0;font-size:0.9rem',
        text: 'Accept/Deny gates Save. Generation continues — confirmed bugs land as F items on the checklist.',
      }),
    ]),
    ...mrs,
    el('div', { className: 'arrow-note', text: cr.generationLink }),
  );
}

function renderQuality(data) {
  const q = data.qualityGate;
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

  const findings = q.findings?.length
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
    : null;

  document.getElementById('quality-panel').replaceChildren(
    el('div', { className: 'score-head' }, [
      el('div', { className: 'score-big', html: `${q.overall}<span> / 100</span>` }),
      pill(q.passed ? 'Pass' : 'Below bar', q.passed ? 'pass' : 'warn'),
      el('span', { style: 'font-size:0.78rem;color:var(--muted)', text: q.note }),
    ]),
    ...rows,
    findings,
  );
}

function renderDedupe(data) {
  const d = data.dedupe;
  document.getElementById('dedupe-panel').replaceChildren(
    el('div', { className: 'mr-head' }, [
      pill(`${d.before} → ${d.after} cases`, 'pass'),
      pill(`${d.merges.length} merges shown`),
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
  document.getElementById('house-grid').replaceChildren(
    ...data.houseCases.map((h) =>
      el('div', { className: 'panel house-card' }, [
        pill(h.tag, 'oob'),
        el('h3', { text: h.summary }),
        el('p', { text: h.why }),
        el('p', { style: 'margin-top:0.4rem;color:var(--text)', text: `Expected: ${h.expected}` }),
      ]),
    ),
  );
}

function renderCases(data) {
  document.getElementById('cases-panel').replaceChildren(
    ...data.cases.map((c) => {
      const badge =
        c.badge && c.badge.includes('CR')
          ? pill(c.badge, 'cr')
          : c.badge
            ? pill(c.badge, 'oob')
            : null;
      return el('details', { className: 'case', open: c.n <= 2 ? '' : null }, [
        el('summary', { className: 'case-head' }, [
          el('span', { className: 'n', text: `#${c.n}` }),
          pill(c.priority),
          pill(c.type),
          badge,
          el('strong', { style: 'flex:1 1 12rem', text: c.summary }),
        ]),
        el('div', {
          style: 'margin-top:0.45rem;font-size:0.78rem;color:var(--muted)',
          text: `Covers: ${c.covers.join(', ')} · ${c.tags.join(', ')}`,
        }),
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

function renderAgentSamples(data) {
  const s = data.agentSamples || {};
  const cards = [];

  if (s.cua) {
    cards.push(
      el('div', { className: 'panel sample-panel reveal' }, [
        pill('CUA Browser Agent', 'cr'),
        el('h3', { text: s.cua.title }),
        el('p', { style: 'font-size:0.88rem;margin:0.35rem 0', text: s.cua.intent }),
        el('div', { className: 'mr-head' }, [
          pill(s.cua.verdict, 'pass'),
          pill(s.cua.cost),
          pill(s.cua.device),
        ]),
        el(
          'ol',
          { className: 'mono-list' },
          s.cua.steps.map((step) => el('li', { text: step })),
        ),
        el('p', { style: 'margin:0.65rem 0 0;font-size:0.8rem;color:var(--muted)', text: s.cua.note }),
      ]),
    );
  }

  if (s.automation) {
    cards.push(
      el('div', { className: 'panel sample-panel reveal' }, [
        pill('Automation Workbench', 'oob'),
        el('h3', { text: s.automation.title }),
        el('p', { style: 'font-size:0.88rem;margin:0.35rem 0', text: s.automation.instruction }),
        el('div', { className: 'mr-head' }, [
          pill(`Confidence ${s.automation.confidence}`, 'pass'),
          ...s.automation.artifacts.map((a) => pill(a)),
          ...s.automation.classes.map((c) => pill(c)),
        ]),
        el('p', { style: 'margin:0.65rem 0 0;font-size:0.8rem;color:var(--muted)', text: s.automation.note }),
      ]),
    );
  }

  if (s.mcp) {
    cards.push(
      el('div', { className: 'panel sample-panel reveal' }, [
        pill('MCP Skills & CLI'),
        el('h3', { text: s.mcp.title }),
        el(
          'ol',
          { className: 'mono-list' },
          s.mcp.flow.map((step) => el('li', { text: step })),
        ),
        el('p', { style: 'margin:0.65rem 0 0;font-size:0.8rem;color:var(--muted)', text: s.mcp.note }),
      ]),
    );
  }

  if (s.jira) {
    cards.push(
      el('div', { className: 'panel sample-panel reveal' }, [
        pill('Jira + Xray', 'warn'),
        el('h3', { text: s.jira.title }),
        el(
          'ul',
          { className: 'mono-list' },
          s.jira.items.map((item) => el('li', { text: item })),
        ),
      ]),
    );
  }

  document.getElementById('agent-samples').replaceChildren(...cards);
}

function renderPoints(data) {
  document.getElementById('talking-points').replaceChildren(
    ...data.talkingPoints.map((t) => el('li', { text: t })),
  );
  document.getElementById('footer-disclaimer').textContent = data.product.disclaimer;
}

async function main() {
  const res = await fetch(`data/demo.json?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load demo.json (${res.status})`);
  const data = await res.json();
  renderHero(data);
  renderWhy(data);
  renderLoop(data);
  renderAgents(data);
  renderTicket(data);
  renderTimeline(data);
  renderCr(data);
  renderQuality(data);
  renderDedupe(data);
  renderHouse(data);
  renderCases(data);
  renderAgentSamples(data);
  renderPoints(data);
  observeReveals();
}

main().catch((err) => {
  document.getElementById('hero-lead').textContent = `Demo failed to load: ${err.message}`;
});
