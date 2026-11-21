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
  window.__ta = { remorphAll: () => { const s = render(); prevStrs = []; patch(s); }, get state() { return comp.state; } };
}

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
      if (comp.state.mascotSec !== cur && !comp.state.mascotOpen) comp.setState({ mascotSec: cur, mascotIdx: 0 });
    }
  }
  function pinStep() {
    if (!pin || !steps.length) return;
    const r = pin.getBoundingClientRect();
    const total = pin.offsetHeight - window.innerHeight;
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
    if (!reduce) {
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
