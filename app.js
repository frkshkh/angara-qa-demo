/** One page: GO first · CTA → journey · scroll-scrubbed tour. */

const VH_PER_UNIT = 3.1; // deep runway — next frame waits
/** Cap catch-up so fast wheel never skips a frame (units / second). */
const MAX_UNITS_PER_SEC = 0.9;
/** Within a chapter: hold current until HOLD, then blend until END. */
const HOLD_UNTIL = 0.68;
const BLEND_END = 0.94;
/** Keyboard nudge as fraction of one chapter. */
const KEY_STEP = 0.22;
let data = null;
let scenes = [];
let activeScene = -1;
let step = -1;
let timer = null;
let paused = false;
let checklistTimers = [];
let mode = 'home';
let lastMeta = -1;
let scrollTarget = 0;
let scrollSmooth = 0;
let scrubRaf = 0;
let lastScrubTs = 0;
let idleFrames = 0;
let sceneNodes = [];
/** While set, scrub loop won't pull progress back to lagging scrollY (Home/End/dots). */
let pinProgressUntil = 0;
/** Autopilot header step timer */
let apTickRaf = 0;
let apStepStarted = 0;
let apStepDur = 0;
let apElapsedBeforePause = 0;
/** Content auto-scroll through tall frames */
let contentScrollRaf = 0;
let contentScrollState = null;
/** After user wheel/keys, crawl yields until this timestamp */
let userScrollUntil = 0;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function easeInOut(t) {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}
/** Local 0..1 → blend 0..1. Long hold, short crossfade. */
function chapterBlend(local) {
  local = clamp(local, 0, 1);
  if (local <= HOLD_UNTIL) return 0;
  if (local >= BLEND_END) return 1;
  return easeInOut((local - HOLD_UNTIL) / (BLEND_END - HOLD_UNTIL));
}

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

function totalUnits() {
  // 0 = GO→scene0, then +1 per remaining scene → last index n-1
  return Math.max(1, scenes.length);
}

function layoutTrack() {
  const track = document.getElementById('scroll-track');
  const units = totalUnits() + 0.4;
  track.style.height = `${Math.round(units * VH_PER_UNIT * window.innerHeight)}px`;
}

function updateMeta(i) {
  if (i === lastMeta || i < 0 || i >= scenes.length) return;
  lastMeta = i;
  activeScene = i;
  const s = scenes[i];
  document.getElementById('scene-index').textContent = String(i + 1).padStart(2, '0');
  document.getElementById('scene-kicker').textContent = s.kicker || '';
  document.getElementById('scroll-hint-tour')?.classList.toggle('hide', i > 0);
  document.querySelectorAll('.scene-dots button').forEach((btn, idx) => {
    btn.setAttribute('aria-current', idx === i ? 'true' : 'false');
  });
}

/** Opacity + Y only. No blur / clip-path (those cause jank). */
function paintScene(node, vis, dir) {
  if (!node) return;
  const v = clamp(vis, 0, 1);
  const inv = 1 - v;
  const y = dir < 0 ? -24 * inv : dir > 0 ? 36 * inv : 0;
  node.style.opacity = v.toFixed(4);
  node.style.transform = `translate3d(0,${y.toFixed(2)}px,0)`;
  node.style.visibility = v < 0.01 ? 'hidden' : 'visible';
  node.style.pointerEvents = v > 0.65 ? 'auto' : 'none';
  node.style.zIndex = String(dir > 0 ? 5 : Math.round(v * 4));
  node.setAttribute('aria-hidden', v > 0.5 ? 'false' : 'true');
}

/** Only ever touch the active pair — never flash a third frame. t already eased. */
function showPair(a, b, t) {
  const e = clamp(t, 0, 1);
  const n = sceneNodes.length;
  for (let i = 0; i < n; i++) {
    if (i !== a && i !== b) {
      const node = sceneNodes[i];
      if (node.style.opacity !== '0' && node.style.opacity !== '') {
        node.style.opacity = '0';
        node.style.visibility = 'hidden';
        node.style.pointerEvents = 'none';
        node.style.zIndex = '0';
      }
    }
  }
  if (a === b || e <= 0.001) {
    paintScene(sceneNodes[a], 1, 0);
    if (b !== a) paintScene(sceneNodes[b], 0, 1);
    updateMeta(a);
    return;
  }
  if (e >= 0.999) {
    paintScene(sceneNodes[a], 0, -1);
    paintScene(sceneNodes[b], 1, 0);
    updateMeta(b);
    return;
  }
  paintScene(sceneNodes[a], 1 - e, -1);
  paintScene(sceneNodes[b], e, 1);
  updateMeta(e > 0.5 ? b : a);
}

/** Side/bottom rail: where you are in current → next. */
function updateChapterRail(opts) {
  const rail = document.getElementById('chapter-rail');
  if (!rail) return;
  const { from, to, local, blend } = opts;
  const fromEl = document.getElementById('rail-from');
  const toEl = document.getElementById('rail-to');
  const fill = document.getElementById('rail-fill');
  const thumb = document.getElementById('rail-thumb');
  const hold = document.getElementById('rail-hold');

  rail.hidden = false;
  rail.dataset.phase = blend <= 0 ? 'hold' : blend >= 1 ? 'done' : 'blend';
  if (fromEl) fromEl.textContent = from;
  if (toEl) toEl.textContent = to;

  const pct = clamp(local, 0, 1) * 100;
  if (fill) fill.style.width = `${pct}%`;
  if (thumb) thumb.style.left = `${pct}%`;
  if (hold) hold.style.width = `${HOLD_UNTIL * 100}%`;
}

function hideChapterRail() {
  const rail = document.getElementById('chapter-rail');
  if (rail) rail.hidden = true;
}

function setLayers(goVis, tourVis) {
  const go = document.getElementById('layer-go');
  const tour = document.getElementById('layer-tour');
  const cue = document.getElementById('scroll-cue');
  const g = clamp(goVis, 0, 1);
  const t = clamp(tourVis, 0, 1);

  go.style.opacity = g.toFixed(4);
  go.style.transform = `translate3d(0,${((-40 * (1 - g))).toFixed(2)}px,0)`;
  go.style.pointerEvents = g > 0.6 ? 'auto' : 'none';
  go.style.visibility = g < 0.01 ? 'hidden' : 'visible';
  go.style.zIndex = g >= t ? '3' : '1';

  tour.style.opacity = t.toFixed(4);
  tour.style.transform = `translate3d(0,${((48 * (1 - t))).toFixed(2)}px,0)`;
  tour.style.pointerEvents = t > 0.6 ? 'auto' : 'none';
  tour.style.visibility = t < 0.01 ? 'hidden' : 'visible';
  tour.style.zIndex = t > g ? '3' : '2';

  if (cue) cue.classList.toggle('hide', g < 0.88);
  const onTour = t > 0.55;
  document.body.dataset.frame = onTour ? 'tour' : 'go';
  document.body.classList.toggle('on-tour', onTour);
}

function readScrollTarget() {
  const track = document.getElementById('scroll-track');
  const max = Math.max(1, track.offsetHeight - window.innerHeight);
  const y = clamp(window.scrollY, 0, max);
  const bar = document.getElementById('progress-bar');
  if (bar) bar.style.width = `${(y / max) * 100}%`;
  return (y / max) * totalUnits();
}

function paintProgress(progress) {
  if (mode === 'journey') return;
  const n = scenes.length;
  if (!n) {
    setLayers(1, 0);
    hideChapterRail();
    return;
  }

  // Unit 0: GO → scene 0 (long hold on GO, then blend)
  if (progress < 1) {
    const local = clamp(progress, 0, 1);
    const blend = chapterBlend(local);
    setLayers(1 - blend, blend);
    showPair(0, 0, 0);
    paintScene(sceneNodes[0], blend, 1);
    if (blend > 0.35) updateMeta(0);
    const s0 = scenes[0];
    updateChapterRail({
      kind: 'go',
      from: 'Autopilot',
      to: s0 ? `${String(1).padStart(2, '0')} ${s0.kicker || s0.title}` : 'Tour',
      local,
      blend,
    });
    return;
  }

  setLayers(0, 1);
  if (n === 1) {
    showPair(0, 0, 0);
    updateChapterRail({
      kind: 'tour',
      from: `01 ${scenes[0].kicker || scenes[0].title}`,
      to: 'End',
      local: 1,
      blend: 1,
    });
    return;
  }

  // progress 1 → n : scenes 0 → n-1. Long hold, short blend via chapterBlend.
  const pos = clamp(progress - 1, 0, n - 1 - 1e-6);
  const i = Math.floor(pos);
  const local = pos - i;
  const blend = chapterBlend(local);
  const j = Math.min(n - 1, i + 1);
  showPair(i, j, blend);

  const a = scenes[i];
  const b = scenes[j];
  updateChapterRail({
    kind: 'tour',
    from: `${String(i + 1).padStart(2, '0')} ${a.kicker || a.title}`,
    to: i === j ? 'End' : `${String(j + 1).padStart(2, '0')} ${b.kicker || b.title}`,
    local,
    blend,
  });
}

function scrubTick(ts) {
  if (mode === 'journey') {
    scrubRaf = 0;
    lastScrubTs = 0;
    idleFrames = 0;
    return;
  }
  if (!lastScrubTs) lastScrubTs = ts;
  const dt = Math.min(0.05, (ts - lastScrubTs) / 1000);
  lastScrubTs = ts;

  scrollTarget = readScrollTarget();
  if (ts < pinProgressUntil) {
    // Keep intentional snap until window.scrollY catches up
    paintProgress(scrollSmooth);
  } else {
    const delta = scrollTarget - scrollSmooth;
    // Small wheel: rate-limit. Big jumps: snap so UI never lags chapters behind.
    let maxStep = MAX_UNITS_PER_SEC * dt;
    if (Math.abs(delta) > 1.25) maxStep = Math.abs(delta);
    else if (Math.abs(delta) > 0.55) maxStep = Math.max(maxStep, 2.8 * dt);
    if (Math.abs(delta) <= maxStep) scrollSmooth = scrollTarget;
    else scrollSmooth += Math.sign(delta) * maxStep;
    paintProgress(scrollSmooth);
  }

  if (Math.abs(scrollTarget - scrollSmooth) < 1e-4) {
    idleFrames += 1;
    if (idleFrames > 12) {
      scrubRaf = 0;
      lastScrubTs = 0;
      idleFrames = 0;
      return;
    }
  } else {
    idleFrames = 0;
  }
  scrubRaf = requestAnimationFrame(scrubTick);
}

function startScrubLoop() {
  idleFrames = 0;
  if (scrubRaf) return;
  lastScrubTs = 0;
  scrubRaf = requestAnimationFrame(scrubTick);
}

function stopScrubLoop() {
  if (scrubRaf) cancelAnimationFrame(scrubRaf);
  scrubRaf = 0;
  lastScrubTs = 0;
  idleFrames = 0;
}

function onScroll() {
  scrollTarget = readScrollTarget();
  startScrubLoop();
}

function scrubFromScroll() {
  scrollTarget = readScrollTarget();
  scrollSmooth = scrollTarget;
  paintProgress(scrollSmooth);
}

function scrollMax() {
  const track = document.getElementById('scroll-track');
  return Math.max(1, track.offsetHeight - window.innerHeight);
}

function snapProgress(unit, scrollTop, smooth) {
  const max = scrollMax();
  window.scrollTo({ top: scrollTop ?? 0, behavior: smooth ? 'smooth' : 'auto' });
  scrollTarget = unit;
  scrollSmooth = unit;
  pinProgressUntil = performance.now() + (smooth ? 900 : 120);
  paintProgress(scrollSmooth);
  startScrubLoop();
}

function jumpToScene(i) {
  const max = scrollMax();
  const units = totalUnits();
  // Land in hold zone of scene i (progress = 1 + i + small)
  const unit = clamp(1 + i + HOLD_UNTIL * 0.35, 0, units);
  snapProgress(unit, (unit / units) * max, true);
}

function nudgeScroll(deltaUnits, smooth) {
  if (mode === 'journey') return;
  const max = scrollMax();
  const units = totalUnits();
  const cur = (window.scrollY / max) * units;
  const next = clamp(cur + deltaUnits, 0, units);
  window.scrollTo({ top: (next / units) * max, behavior: smooth ? 'smooth' : 'auto' });
  startScrubLoop();
}

function onKeyNav(e) {
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;

  // Journey keys: scroll card · Left/Right change step · P pause
  if (mode === 'journey') {
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      togglePause();
      return;
    }
    // Don't let focused Pause/Skip/Exit swallow Space / arrows
    if (e.target?.closest?.('.top-actions, .btn')) {
      e.target.blur?.();
    }
    // Smaller steps + smooth — avoid jumpy scroll
    const stepPx = Math.max(48, Math.round(window.innerHeight * 0.12));
    const pagePx = Math.max(96, Math.round(window.innerHeight * 0.32));
    switch (e.key) {
      case 'ArrowDown':
      case 'Down':
        e.preventDefault();
        scrollJourney(stepPx, true);
        break;
      case 'ArrowUp':
      case 'Up':
        e.preventDefault();
        scrollJourney(-stepPx, true);
        break;
      case ' ':
      case 'Spacebar':
        e.preventDefault();
        scrollJourney(e.shiftKey ? -stepPx : stepPx, true);
        break;
      case 'PageDown':
        e.preventDefault();
        scrollJourney(pagePx, true);
        break;
      case 'PageUp':
        e.preventDefault();
        scrollJourney(-pagePx, true);
        break;
      case 'Home':
        e.preventDefault();
        journeyScrollPort()?.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'End':
        e.preventDefault();
        {
          const el = journeyScrollPort();
          if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }
        break;
      case 'ArrowRight':
      case 'Right':
      case ']':
        e.preventDefault();
        skip();
        break;
      case 'ArrowLeft':
      case 'Left':
      case '[':
        e.preventDefault();
        prevStep();
        break;
      default:
        break;
    }
    return;
  }

  const units = totalUnits();
  switch (e.key) {
    case 'ArrowDown':
    case 'Down':
    case 'PageDown':
      e.preventDefault();
      nudgeScroll(e.key === 'PageDown' ? 0.85 : KEY_STEP, true);
      break;
    case 'ArrowUp':
    case 'Up':
    case 'PageUp':
      e.preventDefault();
      nudgeScroll(e.key === 'PageUp' ? -0.85 : -KEY_STEP, true);
      break;
    case ' ':
    case 'Spacebar':
      e.preventDefault();
      nudgeScroll(e.shiftKey ? -KEY_STEP : KEY_STEP, true);
      break;
    case 'Home':
      e.preventDefault();
      snapProgress(0, 0, false);
      break;
    case 'End':
      e.preventDefault();
      snapProgress(totalUnits(), scrollMax(), false);
      break;
    case 'ArrowRight':
    case 'Right':
      e.preventDefault();
      // Jump toward next chapter hold
      {
        const pos = (window.scrollY / scrollMax()) * units;
        const nextChapter = Math.min(units, Math.floor(pos) + 1 + HOLD_UNTIL * 0.3);
        nudgeScroll(nextChapter - pos, true);
      }
      break;
    case 'ArrowLeft':
    case 'Left':
      e.preventDefault();
      {
        const pos = (window.scrollY / scrollMax()) * units;
        const prevChapter = Math.max(0, Math.ceil(pos) - 1 - (1 - HOLD_UNTIL * 0.3));
        nudgeScroll(prevChapter - pos, true);
      }
      break;
    default:
      break;
  }
}

function goToAutopilot() {
  document.body.dataset.frame = 'go';
  document.body.classList.remove('on-tour');
  snapProgress(0, 0, true);
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

function noteUserScroll() {
  userScrollUntil = performance.now() + 2200;
}

/** Scroll journey card so node sits in view (smooth, port-local). */
function revealInStage(node) {
  const port = document.getElementById('journey');
  if (!node || !port || paused) return;
  const pRect = port.getBoundingClientRect();
  const nRect = node.getBoundingClientRect();
  const pad = 24;
  let delta = 0;
  if (nRect.bottom > pRect.bottom - pad) delta = nRect.bottom - pRect.bottom + pad;
  else if (nRect.top < pRect.top + pad) delta = -(pRect.top - nRect.top + pad);
  if (!delta) return;
  // Only move down during autopilot — never yank back against crawl/user
  if (delta > 0) port.scrollBy({ top: delta, behavior: 'smooth' });
}

function stopContentScroll() {
  if (contentScrollRaf) cancelAnimationFrame(contentScrollRaf);
  contentScrollRaf = 0;
  contentScrollState = null;
}

function contentScrollMax(port) {
  return Math.max(0, port.scrollHeight - port.clientHeight);
}

function runContentScrollTick(now) {
  const st = contentScrollState;
  if (!st) {
    contentScrollRaf = 0;
    return;
  }
  if (paused) {
    contentScrollRaf = 0; // hard stop while paused — manual scroll only
    return;
  }
  // User is scrolling — don't fight the wheel/keys
  if (now < userScrollUntil) {
    contentScrollRaf = requestAnimationFrame(runContentScrollTick);
    return;
  }
  if (!st.started) st.started = now;
  // Live max — content grows as checklist/result appear
  const max = contentScrollMax(st.port);
  if (max < 8) {
    contentScrollRaf = requestAnimationFrame(runContentScrollTick);
    return;
  }
  const elapsed = st.elapsedBeforePause + (now - st.started);
  const t = clamp(elapsed / st.dur, 0, 1);
  const eased = t * t * (3 - 2 * t);
  const target = max * eased;
  // Monotonic: never pull scroll backward (reveals / user may be ahead)
  if (target > st.port.scrollTop) st.port.scrollTop = target;
  if (t < 1) contentScrollRaf = requestAnimationFrame(runContentScrollTick);
  else {
    // Ensure bottom on finish
    if (st.port.scrollTop < max - 2) st.port.scrollTop = max;
    contentScrollRaf = 0;
    contentScrollState = null;
  }
}

/**
 * Slow crawl top→bottom over the step. Recalc max each frame.
 * Yields to user input; hard-stops on pause.
 */
function startContentAutoScroll(duration) {
  stopContentScroll();
  const port = document.getElementById('journey');
  if (!port) return;
  const startId = setTimeout(() => {
    if (paused || mode !== 'journey') return;
    const dur = Math.max(2200, Math.min((duration || 4500) * 0.88, 10000));
    contentScrollState = {
      port,
      dur,
      started: performance.now(),
      elapsedBeforePause: 0,
    };
    contentScrollRaf = requestAnimationFrame(runContentScrollTick);
  }, 240);
  checklistTimers.push(startId);
}

/** After list animations, ease to bottom once more content is painted. */
function scheduleTailScroll(duration) {
  const at = Math.max(1000, Math.min((duration || 4500) * 0.62, 5500));
  checklistTimers.push(
    setTimeout(() => {
      if (paused) return;
      const port = document.getElementById('journey');
      if (!port) return;
      const max = contentScrollMax(port);
      if (max > 8) {
        userScrollUntil = performance.now() + 900;
        port.scrollTo({ top: max, behavior: 'smooth' });
      }
    }, at),
  );
}

function pauseContentScrollClock() {
  if (!contentScrollState) return;
  if (contentScrollState.started) {
    contentScrollState.elapsedBeforePause += performance.now() - contentScrollState.started;
    contentScrollState.started = 0;
  }
  if (contentScrollRaf) cancelAnimationFrame(contentScrollRaf);
  contentScrollRaf = 0;
}

function resumeContentScrollClock() {
  if (!contentScrollState || paused) return;
  contentScrollState.started = performance.now();
  if (!contentScrollRaf) contentScrollRaf = requestAnimationFrame(runContentScrollTick);
}

function animateGenerate() {
  const items = [...document.querySelectorAll('#gen-list li')];
  items.forEach((node, i) => {
    checklistTimers.push(
      setTimeout(() => {
        if (paused) return;
        node.classList.add('on');
        revealInStage(node);
      }, 320 + i * 520),
    );
  });
  const n = items.length;
  checklistTimers.push(
    setTimeout(() => {
      if (paused) return;
      const r = document.getElementById('gen-result');
      if (r) r.hidden = false;
      const p = document.getElementById('gen-preview');
      if (p) p.hidden = false;
      revealInStage(r || p);
      if (p) {
        checklistTimers.push(
          setTimeout(() => {
            if (!paused) revealInStage(p.lastElementChild || p);
          }, 450),
        );
      }
    }, 320 + n * 520 + 200),
  );
}

function animateCua() {
  [...document.querySelectorAll('#cua-list li')].forEach((node, i) => {
    checklistTimers.push(
      setTimeout(() => {
        if (paused) return;
        node.classList.add('on');
        revealInStage(node);
      }, 280 + i * 560),
    );
  });
}

/** Walk stage blocks top→bottom; scroll card as each enters view. */
function animateStageWalk() {
  const stage = document.getElementById('j-stage');
  if (!stage) return;
  const nodes = [
    ...stage.querySelectorAll(
      '.ticket-box li, .meta-cell, .mr-card, .bug-line, .param, .meta-grid .meta-cell, .advisory-list li, .evidence-list li, .bug-card h3, .bug-card .plan-list li, .bug-actions, .metric, .ai-verdict, .ai-bullets li, .result-banner, .summary-grid > div, .done-cta, .intent-box, .pill-row',
    ),
  ].filter((n, i, arr) => !arr.some((other, j) => j !== i && other.contains(n) && other !== n));
  if (!nodes.length) {
    checklistTimers.push(
      setTimeout(() => {
        if (!paused) revealInStage(stage.lastElementChild || stage);
      }, 300),
    );
    return;
  }
  const gap = Math.min(640, Math.max(320, Math.floor(3600 / Math.max(nodes.length, 1))));
  nodes.forEach((node, i) => {
    checklistTimers.push(
      setTimeout(() => {
        if (paused) return;
        node.classList.add('ap-seen');
        revealInStage(node);
      }, 240 + i * gap),
    );
  });
}

function stopApTick() {
  if (apTickRaf) cancelAnimationFrame(apTickRaf);
  apTickRaf = 0;
}

function paintApHeader(i, journeyLen, phase, running) {
  const state = document.getElementById('ap-state');
  const stepEl = document.getElementById('ap-step');
  const phaseEl = document.getElementById('top-phase');
  const overall = document.getElementById('ap-fill-overall');
  const track = document.getElementById('ap-track');
  if (state) state.textContent = running ? 'Auto-running' : 'Paused';
  if (stepEl) stepEl.textContent = `${i + 1} / ${journeyLen}`;
  if (phaseEl) phaseEl.textContent = phase || 'Autopilot';
  const pct = Math.round(((i + 1) / journeyLen) * 100);
  if (overall) overall.style.width = `${pct}%`;
  if (track) track.setAttribute('aria-valuenow', String(pct));
}

function runApTick() {
  const fill = document.getElementById('ap-fill-step');
  if (!fill || apStepDur <= 0) return;
  const tick = (now) => {
    if (paused) {
      apTickRaf = requestAnimationFrame(tick);
      return;
    }
    const elapsed = apElapsedBeforePause + (now - apStepStarted);
    const t = clamp(elapsed / apStepDur, 0, 1);
    fill.style.width = `${Math.round(t * 100)}%`;
    if (t < 1) apTickRaf = requestAnimationFrame(tick);
    else apTickRaf = 0;
  };
  apTickRaf = requestAnimationFrame(tick);
}

function startApTick(duration) {
  stopApTick();
  const fill = document.getElementById('ap-fill-step');
  if (fill) fill.style.width = '0%';
  apStepDur = Math.max(0, duration || 0);
  apElapsedBeforePause = 0;
  apStepStarted = performance.now();
  if (apStepDur > 0) runApTick();
  else if (fill) fill.style.width = '100%';
}

function showStep(i, opts = {}) {
  const stayPaused = !!opts.keepPaused && paused;
  clearTimers();
  stopApTick();
  stopContentScroll();
  const journey = data.journey;
  if (i < 0 || i >= journey.length) return;
  step = i;
  if (!stayPaused) setPaused(false);

  const j = journey[i];
  document.getElementById('j-phase').textContent = j.phase;
  document.getElementById('j-title').textContent = j.title;
  document.getElementById('j-voice').textContent = j.voice;
  document.getElementById('j-progress').style.width = `${Math.round(((i + 1) / journey.length) * 100)}%`;
  document.getElementById('rail').style.transform = `scaleY(${(i + 1) / journey.length})`;
  paintApHeader(i, journey.length, j.phase, !stayPaused && !paused);

  const panel = document.getElementById('journey');
  panel.classList.remove('swap');
  void panel.offsetWidth;
  panel.classList.add('swap');

  renderStage(j);
  panel.scrollTop = 0;
  if (j.ui === 'cua-adversarial' || j.ui === 'bug' || (j.ui === 'pagespeed' && j.ai?.verdict === 'BAD')) setAurora('fail');
  else if (j.ui === 'done' || (j.ui === 'pagespeed' && j.ai?.verdict === 'GOOD')) setAurora('done');
  else setAurora('running');

  if (stayPaused) {
    // Stay paused after Left/Right — no auto-advance / no crawl
    const fill = document.getElementById('ap-fill-step');
    if (fill) fill.style.width = '0%';
    apStepDur = j.duration || 0;
    apElapsedBeforePause = 0;
    // Still paint list state fully so paused review sees complete screen
    if (j.ui === 'generate') {
      document.querySelectorAll('#gen-list li').forEach((n) => n.classList.add('on'));
      const r = document.getElementById('gen-result');
      const p = document.getElementById('gen-preview');
      if (r) r.hidden = false;
      if (p) p.hidden = false;
    } else if (['cua-testset', 'cua-manual', 'cua-adversarial', 'cua-advisory'].includes(j.ui)) {
      document.querySelectorAll('#cua-list li').forEach((n) => n.classList.add('on'));
    }
    focusJourneyCard();
    return;
  }

  const listUi = ['generate', 'cua-testset', 'cua-manual', 'cua-adversarial', 'cua-advisory'].includes(j.ui);
  if (j.ui === 'generate') animateGenerate();
  else if (listUi) animateCua();
  else animateStageWalk();
  // List UIs: follow items + tail scroll. Static tall UIs: live-max crawl.
  if (listUi) scheduleTailScroll(j.duration || 4000);
  else startContentAutoScroll(j.duration || 4000);

  startApTick(j.duration);
  if (j.duration > 0) {
    timer = setTimeout(() => {
      if (!paused) showStep(i + 1);
    }, j.duration);
  }
}

function setBodyMode(next) {
  // Never wipe className — that dropped `ready` and blanked the page (opacity:0).
  document.body.classList.remove('mode-home', 'mode-journey', 'launching', 'on-tour');
  document.body.classList.add(next, 'ready');
}

function startJourney() {
  if (mode === 'journey') return;
  burstFx();
  document.getElementById('go-btn').classList.add('launching');
  document.body.classList.add('launching');
  window.scrollTo(0, 0);

  setTimeout(() => {
    mode = 'journey';
    stopScrubLoop();
    hideChapterRail();
    setBodyMode('mode-journey');
    document.body.dataset.frame = 'journey';
    document.documentElement.classList.add('lock-scroll');
    document.getElementById('pin-wrap').hidden = true;
    const fj = document.getElementById('frame-journey');
    fj.hidden = false;
    document.getElementById('ap-progress').hidden = false;
    document.getElementById('top-actions').hidden = false;
    fj.classList.add('enter');
    setAurora('running');
    showStep(0);
  }, 420);
}

function exitJourney() {
  clearTimers();
  stopApTick();
  stopContentScroll();
  step = -1;
  mode = 'home';
  setPaused(false);
  document.documentElement.classList.remove('lock-scroll');
  setBodyMode('mode-home');
  document.body.dataset.frame = 'go';
  const fj = document.getElementById('frame-journey');
  fj.hidden = true;
  fj.classList.remove('enter');
  document.getElementById('pin-wrap').hidden = false;
  document.getElementById('ap-progress').hidden = true;
  document.getElementById('top-actions').hidden = true;
  document.getElementById('go-btn').classList.remove('launching');
  setAurora('');
  lastMeta = -1;
  snapProgress(0, 0, false);
}

function restart() {
  clearTimers();
  setAurora('running');
  showStep(0);
}

function journeyScrollPort() {
  return document.getElementById('journey');
}

function focusJourneyCard() {
  const card = document.getElementById('journey');
  if (!card) return;
  try {
    card.focus({ preventScroll: true });
  } catch {
    card.focus();
  }
}

function setPaused(next) {
  const was = paused;
  paused = !!next;
  document.body.classList.toggle('is-paused', paused);
  const btn = document.getElementById('btn-pause');
  if (btn) {
    btn.textContent = paused ? 'Resume' : 'Pause';
    btn.setAttribute('aria-pressed', paused ? 'true' : 'false');
  }
  const state = document.getElementById('ap-state');
  if (state) state.textContent = paused ? 'Paused' : 'Auto-running';
  if (paused && !was) {
    apElapsedBeforePause += performance.now() - apStepStarted;
    pauseContentScrollClock();
    clearTimers(); // stop reveal timers; keep crawl state frozen for resume
    focusJourneyCard();
  } else if (!paused && was) {
    apStepStarted = performance.now();
    if (apStepDur > 0 && apElapsedBeforePause < apStepDur) runApTick();
    resumeContentScrollClock();
  }
}

function scrollJourney(dy, smooth = true) {
  const el = journeyScrollPort();
  if (!el) return;
  noteUserScroll();
  el.scrollBy({ top: dy, behavior: smooth ? 'smooth' : 'auto' });
}

/** Wheel over overlay or card → scroll journey (works playing + paused). */
function onJourneyWheel(e) {
  if (mode !== 'journey') return;
  const el = journeyScrollPort();
  if (!el) return;
  if (el.scrollHeight <= el.clientHeight + 2) return;
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
  e.preventDefault();
  noteUserScroll();
  el.scrollTop += e.deltaY;
}

function togglePause() {
  if (step < 0) return;
  setPaused(!paused);
  if (paused) {
    clearTimers();
  } else if (data.journey[step].duration > 0 && step < data.journey.length - 1) {
    const left = Math.max(350, apStepDur - apElapsedBeforePause);
    timer = setTimeout(() => {
      if (!paused) showStep(step + 1);
    }, left);
  }
}

function skip() {
  if (step < 0 || step >= data.journey.length - 1) return;
  showStep(step + 1, { keepPaused: paused });
}

function prevStep() {
  if (step <= 0) return;
  showStep(step - 1, { keepPaused: paused });
}

/* ---------- Boot ---------- */

async function main() {
  const res = await fetch(`data/demo.json?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`demo.json ${res.status}`);
  data = await res.json();
  scenes = data.scenes || [];
  document.title = data.product.name;
  document.getElementById('foot-note').textContent = data.product.disclaimer;
  const author = data.product.author || 'Farukh Sheikh';
  const authorUrl = data.product.authorUrl || 'https://www.linkedin.com/in/farukh-shiekh-genaiqa';
  const copyright = data.product.copyright || '© 2026 Angara Ecommerce Pvt Ltd';
  document.querySelectorAll('.js-author').forEach((n) => {
    n.textContent = author;
    if (n.tagName === 'A') {
      n.href = authorUrl;
      n.target = '_blank';
      n.rel = 'noopener noreferrer';
    }
  });
  document.querySelectorAll('.js-copyright').forEach((n) => {
    n.textContent = copyright;
  });

  const L = data.landing;
  document.getElementById('landing-greet').textContent = L.greeting;
  document.getElementById('landing-prompt').textContent = L.prompt;
  document.getElementById('landing-hint').textContent = L.hint;
  document.getElementById('go-label').textContent = L.cta;
  document.getElementById('story-input').value = L.placeholder;

  document.getElementById('stage-frame').replaceChildren(...scenes.map(buildScene));
  sceneNodes = [...document.querySelectorAll('#stage-frame > .scene')];
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
  sceneNodes.forEach((node) => {
    node.classList.remove('active');
    paintScene(node, 0, 1);
  });

  document.getElementById('go-btn').addEventListener('click', startJourney);
  document.getElementById('story-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startJourney();
  });
  document.getElementById('btn-pause').addEventListener('click', () => {
    togglePause();
  });
  document.getElementById('btn-skip').addEventListener('click', skip);
  document.getElementById('btn-exit').addEventListener('click', exitJourney);
  document.getElementById('btn-to-go').addEventListener('click', goToAutopilot);
  document.getElementById('frame-journey').addEventListener('wheel', onJourneyWheel, { passive: false });
  document.getElementById('brand-home').addEventListener('click', (e) => {
    if (mode === 'journey') {
      e.preventDefault();
      exitJourney();
    }
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  // Capture so Pause-button focus can't eat Arrow/Space before we handle them
  window.addEventListener('keydown', onKeyNav, true);
  window.addEventListener('resize', () => {
    layoutTrack();
    scrubFromScroll();
  });

  if (location.hash === '#go' || location.hash === '#autopilot') {
    goToAutopilot();
  } else if (location.hash === '#tour') {
    setTimeout(() => jumpToScene(0), 80);
  }

  scrubFromScroll();
  startScrubLoop();
  document.body.classList.add('ready');
}

main().catch((err) => {
  document.getElementById('landing-hint').textContent = String(err.message || err);
});
