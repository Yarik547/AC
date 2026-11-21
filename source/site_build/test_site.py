"""Smoke test of the built site: errors, hydration, interactions, screenshots."""
import json, sys
from playwright.sync_api import sync_playwright

import os as _os
BASE = _os.environ.get('BASE_URL', 'http://localhost:8766')
OUT = '/home/claude/techno-as/site_build/shots'
import os
os.makedirs(OUT, exist_ok=True)
pages = ['/', '/teplovi-nasosy/', '/sonyachni-stantsii/', '/zaryadni-stantsii/', '/kredyty/']
res = {}

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for vw, vh, tag, mobile in [(1440, 900, 'd', False), (390, 844, 'm', True)]:
        ctx = b.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=1 if not mobile else 2, is_mobile=mobile, has_touch=mobile)
        for url in pages:
            pg = ctx.new_page()
            errs = []
            pg.on('console', lambda m, errs=errs: errs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
            pg.on('pageerror', lambda e, errs=errs: errs.append('pageerror: ' + str(e)))
            failed = []
            pg.on('requestfailed', lambda r, failed=failed: failed.append(r.url))
            pg.on('response', lambda r, failed=failed: failed.append(str(r.status) + ' ' + r.url) if r.status >= 400 else None)
            pg.goto(BASE + url, wait_until='networkidle')
            pg.wait_for_function('window.__ta')
            pg.wait_for_timeout(400)
            # hydration check: re-render everything and count DOM mutations
            muts = pg.evaluate("""() => new Promise(r => { let n = 0; const mo = new MutationObserver(l => { n += l.length; });
              mo.observe(document.querySelector('.ta-root'), {subtree: true, childList: true, attributes: true, characterData: true});
              window.__ta.remorphAll(); setTimeout(() => { mo.disconnect(); r(n); }, 50); })""")
            name = url.strip('/').replace('/', '_') or 'home'
            pg.screenshot(path=f'{OUT}/{tag}_{name}_top.png')
            res[f'{tag} {url}'] = {'errors': errs, 'failed': failed, 'hydration_mutations': muts,
                                   'title': pg.title(), 'h1': pg.inner_text('h1')[:80]}
            pg.close()
        ctx.close()
    b.close()
print(json.dumps(res, ensure_ascii=False, indent=1))
