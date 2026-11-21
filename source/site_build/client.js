// Browser runtime: keeps the pre-rendered page alive (state, events, updates).
import morphdom from 'morphdom';
import { CHUNKS, IN_PAGE, PROP_DEFAULTS, makeComponent, setImg } from './gen/template.mjs';
import { IMG } from './gen/img.mjs';

setImg(IMG);

let comp, vals, appRoot;
let wrappers = [];
let prevStrs = [];
let handlers = [];
let scheduled = false;
let pending = null;
let mounted = false;
let lastFocus = null;

function schedule() {
  if (mounted && !scheduled) { scheduled = true; queueMicrotask(flush); }
}

class DCLogic {
  constructor(props) { this.props = props || {}; }
  setState(u, cb) {
    const patch = typeof u === 'function' ? u(this.state, this.props) : u;
    if (patch == null) return;
    if (!pending) pending = { prevState: this.state, cbs: [] };
    this.state = Object.assign({}, this.state, patch);
    if (cb) pending.cbs.push(cb);
    schedule();
  }
  forceUpdate() { if (!pending) pending = { prevState: this.state, cbs: [] }; schedule(); }
}
const Component = makeComponent(DCLogic);

function render() {
  vals = comp.renderVals();
  const strs = [];
  const hs = [];
  for (let i = 0; i < CHUNKS.length; i++) {
    const list = [];
    const H = (f) => { if (typeof f !== 'function') return ''; list.push(f); return list.length - 1; };
    strs.push(CHUNKS[i](vals, H));
    hs.push(list);
  }
  handlers = hs;
  return strs;
}

const morphOpts = {
  childrenOnly: true,
  onBeforeElUpdated(from, to) {
    if (from.tagName === 'DETAILS') { if (from.open) to.setAttribute('open', ''); else to.removeAttribute('open'); }
    if (from.isEqualNode(to)) return false;
    return true;
  }
};

function patch(strs) {
  for (let i = 0; i < strs.length; i++) {
    if (strs[i] === prevStrs[i]) continue;
    const el = wrappers[i];
    if (!el) continue;
    const t = el.cloneNode(false);
    t.innerHTML = strs[i];
    morphdom(el, t, morphOpts);
    el.querySelectorAll('select[data-value]').forEach((s) => { const v = s.getAttribute('data-value'); if (s.value !== v) s.value = v; });
  }
  const ovWas = prevStrs.length ? prevStrs[IN_PAGE] : '';
  const ovNow = strs[IN_PAGE];
  prevStrs = strs;
  afterRender(ovWas, ovNow);
}

let lastMapCard = '';
function afterRender(ovWas, ovNow) {
  // Bring the map card into view when it opens off-screen (e.g. tapping a city in the list on a phone).
  const mapName = vals.mapOpen && vals.mapCard ? vals.mapCard.name : '';
  if (mapName && mapName !== lastMapCard) {
    const card = [...document.querySelectorAll('.ta-mapcard, .ta-mapcard-d')].find((el) => el.offsetParent !== null);
    if (card) {
      const r = card.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight - 96) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
  lastMapCard = mapName;
  const lock = !!(vals.objOpen || vals.menuOpen);
  document.documentElement.classList.toggle('ta-lock', lock);
  const ov = wrappers[IN_PAGE];
  if (!ovWas && ovNow && ov) {
    lastFocus = document.activeElement;
    const btn = ov.querySelector('[role=dialog] button[aria-label="Закрити"]') || ov.querySelector('[role=dialog] button');
    if (btn) btn.focus({ preventScroll: true });
  } else if (ovWas && !ovNow && lastFocus && document.contains(lastFocus)) {
    lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }
}

function flush() {
  scheduled = false;
  const p = pending;
  pending = null;
  patch(render());
  if (comp.componentDidUpdate) comp.componentDidUpdate(comp.props, p ? p.prevState : comp.state);
  if (p) p.cbs.forEach((f) => f());
}

function dispatch(type, e) {
  let el = e.target;
  while (el && el !== appRoot && el !== document) {
    if (el.nodeType === 1) {
      const id = el.getAttribute('data-h-' + type);
      if (id != null && id !== '') {
        const w = el.closest('[data-c]');
        const list = w ? handlers[+w.getAttribute('data-c')] : null;
        const f = list && list[+id];
        if (f) { f(e); if (e.cancelBubble) break; }
      }
    }
    el = el.parentNode;
  }
}

function boot() {
  appRoot = document.querySelector('.ta-root');
  if (!appRoot) return;
  appRoot.querySelectorAll('[data-c]').forEach((w) => { wrappers[+w.getAttribute('data-c')] = w; });
  const props = Object.assign({}, PROP_DEFAULTS, { page: document.documentElement.getAttribute('data-page') || 'home', site: true, base: document.documentElement.getAttribute('data-base') || '/' });
  const modeOverride = window.TA_MASCOT_MODE && window.TA_MASCOT_MODE !== PROP_DEFAULTS.mascot;
  if (window.TA_MASCOT_MODE) props.mascot = window.TA_MASCOT_MODE;
  comp = new Component(props);
  // The server already rendered the same initial state, so only the event map is needed now.
  prevStrs = render();
  if (modeOverride) prevStrs = prevStrs.map(() => '');
  mounted = true;
  ['click', 'input', 'change'].forEach((t) => appRoot.addEventListener(t, (e) => dispatch(t, e)));
  document.addEventListener('keydown', (e) => {
    if (!vals) return;
    if (e.key === 'Escape') {
      if (vals.objOpen && typeof vals.objClose === 'function') vals.objClose();
      else if (vals.menuOpen && typeof vals.closeMenu === 'function') vals.closeMenu();
      else if (vals.mascotOpen && typeof vals.mascotClose === 'function') vals.mascotClose();
      else if (vals.mapOpen && typeof vals.mapClose === 'function') vals.mapClose();
    } else if (vals.objOpen && e.key === 'ArrowRight' && typeof vals.objNext === 'function') vals.objNext();
    else if (vals.objOpen && e.key === 'ArrowLeft' && typeof vals.objPrev === 'function') vals.objPrev();
  });
  if (comp.componentDidMount) comp.componentDidMount();
  try { if (window.localStorage.getItem('ta-masc') === 'off') comp.setState({ mascotOff: true }); } catch (e) {}
  if (modeOverride) comp.forceUpdate();
  startScrollFx();
  mascotFx.start();
  window.__ta = { remorphAll: () => { const s = render(); prevStrs = []; patch(s); }, get state() { return comp.state; } };
}


// Інженер IS: drag, throw with physics, return on the jetpack, small idle animations.
const mascotFx = (() => {
  const root = document.documentElement;
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let mode = 'home';
  let x = 0, y = 0, r = 0, vx = 0, vy = 0, vr = 0;
  let home = null, grab = null, samples = [], raf = 0, last = 0, t0 = 0, suppress = false, dizzyUntil = 0;
  const timers = {};
  const cls = (n, on) => root.classList.toggle('ta-mfx-' + n, on);
  const flash = (n, ms) => {
    if (reduce || mode !== 'home') return;
    cls(n, false); void root.offsetWidth; cls(n, true);
    clearTimeout(timers[n]); timers[n] = setTimeout(() => cls(n, false), ms);
  };
  const el = () => document.querySelector('.ta-masc-live');
  const set = () => {
    root.style.setProperty('--masc-x', x.toFixed(1) + 'px');
    root.style.setProperty('--masc-y', y.toFixed(1) + 'px');
    root.style.setProperty('--masc-r', r.toFixed(1) + 'deg');
  };
  const cap = (v) => Math.max(-55, Math.min(55, v));
  const dyNow = () => parseFloat(root.style.getPropertyValue('--masc-dy')) || 0;
  function measure() {
    const e = el();
    if (!e) return null;
    const rc = e.getBoundingClientRect();
    return { l: rc.left - x, t: rc.top - y - dyNow(), w: rc.width, h: rc.height };
  }
  function bounds() {
    return { minX: -home.l, maxX: window.innerWidth - home.l - home.w, minY: -home.t, maxY: window.innerHeight - home.t - home.h };
  }
  function startDrag() {
    mode = 'drag';
    cancelAnimationFrame(raf); raf = 0;
    cls('phys', true); cls('drag', true); cls('fly', false); cls('ret', false);
    ['new', 'pop', 'trick', 'wave'].forEach((n) => cls(n, false));
    y += dyNow();
    root.style.setProperty('--masc-dy', '0px');
    set();
    root.style.setProperty('--masc-tilt', '0deg');
    if (comp && comp.state.mascotOpen) comp.setState({ mascotOpen: false });
  }
  function release(vx0, vy0) {
    cls('drag', false);
    vx = cap(vx0); vy = cap(vy0); vr = vx * 0.9;
    mode = reduce ? 'ret' : 'fly';
    if (mode === 'fly') cls('fly', true); else cls('ret', true);
    t0 = performance.now(); last = t0;
    loop();
  }
  function loop() { raf = requestAnimationFrame(step); }
  function step(now) {
    const f = Math.min(3, (now - last) / 16.7);
    last = now;
    const b = bounds();
    if (mode === 'fly') {
      vy += 0.85 * f;
      vx *= Math.pow(0.993, f); vy *= Math.pow(0.993, f);
      x += vx * f; y += vy * f; r += vr * f; vr *= Math.pow(0.986, f);
      if (x < b.minX) { x = b.minX; vx = -vx * 0.62; vr = -vr * 0.7; }
      if (x > b.maxX) { x = b.maxX; vx = -vx * 0.62; vr = -vr * 0.7; }
      if (y < b.minY) { y = b.minY; vy = -vy * 0.62; }
      const floor = y >= b.maxY;
      if (floor) {
        y = b.maxY; vy = -vy * 0.5; vx *= 0.8; vr = vr * 0.5 + vx * 0.7;
        if (Math.abs(vy) < 2.2) vy = 0;
      }
      if (Math.abs(vr) > 5 || Math.hypot(vx, vy) > 20) dizzyUntil = now + 1400;
      cls('dizzy', now < dizzyUntil);
      const settled = floor && Math.abs(vx) < 0.5 && vy === 0;
      if (settled || now - t0 > 3000) {
        mode = 'ret'; cls('fly', false); cls('ret', true);
        r = ((r % 360) + 540) % 360 - 180;
        t0 = now;
      }
    } else if (mode === 'ret') {
      const k = 0.05, c = 0.24;
      vx += (-k * x - c * vx) * f; vy += (-k * y - c * vy) * f; vr += (-k * r - c * vr) * f;
      x += vx * f; y += vy * f; r += vr * f;
      cls('dizzy', now < dizzyUntil);
      if (Math.abs(x) < 0.6 && Math.abs(y) < 0.6 && Math.abs(r) < 1 && Math.hypot(vx, vy) < 0.4) {
        x = y = r = vx = vy = vr = 0; set();
        mode = 'home';
        ['phys', 'ret', 'fly', 'dizzy'].forEach((n) => cls(n, false));
        flash('wave', 1000);
        raf = 0;
        return;
      }
    }
    set();
    loop();
  }
  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const btn = e.target && e.target.closest && e.target.closest('.ta-masc-live .ta-masc-btn');
    if (!btn) return;
    if (mode === 'home') home = measure();
    if (!home) return;
    grab = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: e.clientX - x, oy: e.clientY - y, moved: false, airborne: mode !== 'home' };
    samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    if (grab.airborne) startDrag();
  }
  function onMove(e) {
    eyes(e);
    if (!grab || e.pointerId !== grab.id) return;
    if (!grab.moved && Math.hypot(e.clientX - grab.sx, e.clientY - grab.sy) < 6) return;
    if (!grab.moved) { grab.moved = true; if (mode !== 'drag') startDrag(); }
    if (e.cancelable) e.preventDefault();
    const b = bounds();
    const nx = Math.max(b.minX, Math.min(b.maxX, e.clientX - grab.ox));
    const ny = Math.max(b.minY, Math.min(b.maxY, e.clientY - grab.oy));
    r = r * 0.82 + Math.max(-30, Math.min(30, (nx - x) * 1.4)) * 0.18;
    x = nx; y = ny; set();
    samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (samples.length > 8) samples.shift();
  }
  function onUp(e) {
    if (!grab || e.pointerId !== grab.id) return;
    const g = grab; grab = null;
    if (!g.moved) {
      if (g.airborne) { suppress = true; release(0, 0); }
      else flash('pop', 450);
      return;
    }
    suppress = true;
    const now = performance.now();
    const s0 = samples.find((s) => now - s.t < 110) || samples[0];
    const s1 = samples[samples.length - 1];
    const dt = Math.max(16, s1.t - s0.t);
    release((s1.x - s0.x) / dt * 16.7, (s1.y - s0.y) / dt * 16.7);
  }
  let eyeRaf = 0, eyeEv = null;
  function eyes(e) {
    if (reduce || e.pointerType !== 'mouse') return;
    eyeEv = e;
    if (eyeRaf) return;
    eyeRaf = requestAnimationFrame(() => {
      eyeRaf = 0;
      const m = el();
      if (!m || !eyeEv) return;
      const rc = m.getBoundingClientRect();
      const dx = eyeEv.clientX - (rc.left + rc.width / 2), dy = eyeEv.clientY - (rc.top + rc.height * 0.38);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 260) * 2.6;
      root.style.setProperty('--eye-x', (dx / d * k).toFixed(2) + 'px');
      root.style.setProperty('--eye-y', (dy / d * k).toFixed(2) + 'px');
    });
  }
  function tricks() {
    const wait = 16000 + Math.random() * 10000;
    setTimeout(() => {
      if (document.visibilityState === 'visible' && mode === 'home' && el() && !(comp && comp.state.mascotOpen)) flash(Math.random() < 0.6 ? 'trick' : 'wave', 1300);
      tricks();
    }, wait);
  }
  return {
    flash,
    start() {
      document.addEventListener('pointerdown', onDown, true);
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      document.addEventListener('click', (e) => {
        if (suppress && e.target && e.target.closest && e.target.closest('.ta-masc-btn')) { e.preventDefault(); e.stopPropagation(); }
        suppress = false;
      }, true);
      window.addEventListener('resize', () => { if (mode === 'home') { x = y = r = 0; set(); } });
      if (!reduce) { tricks(); setTimeout(() => flash('wave', 1000), 1200); }
    }
  };
})();

// Scroll effects: Інженер IS flight, the section he talks about, the pinned scene.
const SECTIONS = ['top', 'reviews', 'flow', 'heat', 'solar', 'ev', 'credit', 'how', 'calc', 'portfolio', 'map', 'faq', 'contacts'];
function startScrollFx() {
  const root = document.documentElement;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastY = window.scrollY, vel = 0, dy = 0, raf = 0, idleT = 0, lastSec = '', lastStep = -1;
  const pin = document.querySelector('.ta-pin');
  const steps = pin ? (pin.getAttribute('data-pin-steps') || '').split(',') : [];
  const pinKey = pin ? pin.getAttribute('data-pin-key') : '';
  function sections() {
    const mid = window.innerHeight * 0.45;
    let cur = 'top';
    for (const id of SECTIONS) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top < mid) cur = id;
    }
    if (cur !== lastSec) {
      lastSec = cur;
      if (comp.state.mascotSec !== cur && !comp.state.mascotOpen) {
        comp.setState({ mascotSec: cur, mascotIdx: 0 });
        if (!(comp.state.mascotSeen || {})[cur]) mascotFx.flash('new', 750);
      }
    }
  }
  function pinStep() {
    if (!pin || !steps.length) return;
    const r = pin.getBoundingClientRect();
    const total = pin.offsetHeight - window.innerHeight;
    root.classList.toggle('ta-pin-active', total >= 80 && r.top <= 1 && r.bottom >= window.innerHeight - 1);
    if (total < 80) return;
    const p = Math.min(1, Math.max(0, -r.top / total));
    root.style.setProperty('--ta-pin-p', p.toFixed(3));
    const idx = Math.min(steps.length - 1, Math.floor(p * steps.length));
    if (idx !== lastStep) {
      lastStep = idx;
      if (r.top < 0 && r.bottom > window.innerHeight * 0.5 && comp.state[pinKey] !== steps[idx]) comp.setState({ [pinKey]: steps[idx] });
    }
  }
  function frame() {
    raf = 0;
    const y = window.scrollY;
    const v = y - lastY;
    lastY = y;
    vel = vel * 0.75 + v * 0.25;
    if (!reduce && !root.classList.contains('ta-mfx-phys')) {
      dy = dy * 0.82 + Math.max(-70, Math.min(70, -vel * 2.2)) * 0.18;
      root.style.setProperty('--masc-dy', dy.toFixed(1) + 'px');
      root.style.setProperty('--masc-tilt', Math.max(-14, Math.min(14, vel * 0.5)).toFixed(1) + 'deg');
      root.style.setProperty('--masc-flame', (1 + Math.min(0.9, Math.abs(vel) / 40)).toFixed(2));
    }
    sections();
    pinStep();
    if (Math.abs(vel) > 0.3 || Math.abs(dy) > 0.5) raf = requestAnimationFrame(frame);
  }
  function onScroll() {
    if (!raf) raf = requestAnimationFrame(frame);
    clearTimeout(idleT);
    idleT = setTimeout(() => { if (!raf) raf = requestAnimationFrame(frame); }, 120);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  frame();
}

// Start after the first paint; any touch, click or key press before that starts it at once.
let booted = false;
function bootOnce() { if (booted) return; booted = true; ['pointerdown', 'touchstart', 'keydown', 'focusin'].forEach((t) => document.removeEventListener(t, bootOnce, true)); boot(); }
['pointerdown', 'touchstart', 'keydown', 'focusin'].forEach((t) => document.addEventListener(t, bootOnce, { capture: true, passive: true }));
const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200));
const later = () => idle(bootOnce, { timeout: 1500 });
if (document.readyState === 'complete') later(); else window.addEventListener('load', later);
