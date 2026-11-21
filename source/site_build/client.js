// Browser runtime: keeps the pre-rendered page alive (state, events, updates).
import morphdom from 'morphdom';
import { CHUNKS, PROP_DEFAULTS, makeComponent, setImg } from './gen/template.mjs';
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
  const ovWas = prevStrs.length ? prevStrs[prevStrs.length - 1] : '';
  const ovNow = strs[strs.length - 1];
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
  const ov = wrappers[wrappers.length - 1];
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
  comp = new Component(props);
  // The server already rendered the same initial state, so only the event map is needed now.
  prevStrs = render();
  mounted = true;
  ['click', 'input', 'change'].forEach((t) => appRoot.addEventListener(t, (e) => dispatch(t, e)));
  document.addEventListener('keydown', (e) => {
    if (!vals) return;
    if (e.key === 'Escape') {
      if (vals.objOpen && typeof vals.objClose === 'function') vals.objClose();
      else if (vals.menuOpen && typeof vals.closeMenu === 'function') vals.closeMenu();
      else if (vals.mapOpen && typeof vals.mapClose === 'function') vals.mapClose();
    } else if (vals.objOpen && e.key === 'ArrowRight' && typeof vals.objNext === 'function') vals.objNext();
    else if (vals.objOpen && e.key === 'ArrowLeft' && typeof vals.objPrev === 'function') vals.objPrev();
  });
  if (comp.componentDidMount) comp.componentDidMount();
  window.__ta = { remorphAll: () => { const s = render(); prevStrs = []; patch(s); }, get state() { return comp.state; } };
}

// Start after the first paint; any touch, click or key press before that starts it at once.
let booted = false;
function bootOnce() { if (booted) return; booted = true; ['pointerdown', 'touchstart', 'keydown', 'focusin'].forEach((t) => document.removeEventListener(t, bootOnce, true)); boot(); }
['pointerdown', 'touchstart', 'keydown', 'focusin'].forEach((t) => document.addEventListener(t, bootOnce, { capture: true, passive: true }));
const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200));
const later = () => idle(bootOnce, { timeout: 1500 });
if (document.readyState === 'complete') later(); else window.addEventListener('load', later);
