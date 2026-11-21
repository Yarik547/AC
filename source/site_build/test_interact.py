"""Interaction test of the built site on phone and desktop."""
import json
from playwright.sync_api import sync_playwright

import os as _os
BASE = _os.environ.get('BASE_URL', 'http://localhost:8766')
OUT = '/home/claude/techno-as/site_build/shots'
log = {}

def ev(pg, js):
    return pg.evaluate(js)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    # ---------- phone ----------
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(BASE + '/', wait_until='networkidle')
    # menu
    pg.click('.ta-burger')
    pg.wait_for_timeout(350)
    log['menu_open'] = ev(pg, "() => ({open: !!document.querySelector('.ta-menu-on'), lock: document.documentElement.classList.contains('ta-lock'), items: document.querySelectorAll('.ta-mitem').length})")
    pg.screenshot(path=f'{OUT}/i_m_menu.png')
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(250)
    log['menu_after_esc'] = ev(pg, "() => !!document.querySelector('.ta-menu-on')")
    # calc: switch tabs, move slider
    pg.evaluate("document.getElementById('calc').scrollIntoView()")
    pg.wait_for_timeout(300)
    tabs = pg.query_selector_all('#calc [role=tab]')
    log['calc_tabs'] = len(tabs)
    before = pg.inner_text('#calc')[:4000]
    if len(tabs) >= 2:
        tabs[1].click()
        pg.wait_for_timeout(1200)
    after = pg.inner_text('#calc')[:4000]
    log['calc_tab_changes_text'] = before != after
    rng = pg.query_selector('#calc input[type=range]')
    if rng:
        v0 = rng.input_value()
        rng.evaluate("(el) => { el.value = String(+el.max); el.dispatchEvent(new Event('input', {bubbles: true})); }")
        pg.wait_for_timeout(1300)
        log['range'] = {'from': v0, 'to': rng.input_value(), 'state': ev(pg, "() => { const s = window.__ta.state; return {calcTab: s.calcTab, pvUse: s.pvUse, hpArea: s.hpArea}; }")}
    pg.screenshot(path=f'{OUT}/i_m_calc.png')
    # complex tab
    if len(tabs) >= 4:
        tabs[3].click()
        pg.wait_for_timeout(1200)
        log['cx_tab'] = ev(pg, "() => window.__ta.state.calcTab")
        pg.locator('#calc').screenshot(path=f'{OUT}/i_m_cx.png')
    # object sheet
    pg.evaluate("document.getElementById('portfolio').scrollIntoView()")
    pg.wait_for_timeout(300)
    pg.click('.ta-pbtn')
    pg.wait_for_timeout(500)
    log['sheet'] = ev(pg, "() => ({open: !!document.querySelector('.ta-ov'), lock: document.documentElement.classList.contains('ta-lock'), focus: document.activeElement && document.activeElement.getAttribute('aria-label'), img: (document.querySelector('.ta-oimg-i')||{}).currentSrc})")
    pg.screenshot(path=f'{OUT}/i_m_sheet.png')
    t1 = pg.inner_text('.ta-ov')
    pg.keyboard.press('ArrowRight')
    pg.wait_for_timeout(300)
    log['sheet_next_changes'] = t1 != pg.inner_text('.ta-ov')
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(300)
    log['sheet_closed'] = ev(pg, "() => !document.querySelector('.ta-ov') && !document.documentElement.classList.contains('ta-lock')")
    # FAQ
    pg.evaluate("document.getElementById('faq').scrollIntoView()")
    pg.click('#faq details summary')
    pg.wait_for_timeout(200)
    log['faq_open'] = ev(pg, "() => document.querySelector('#faq details').open")
    # trigger a re-render and make sure the open FAQ stays open
    pg.fill('#ta-name', 'Андрій')
    pg.wait_for_timeout(100)
    log['faq_still_open_after_rerender'] = ev(pg, "() => document.querySelector('#faq details').open")
    # form: validation, then mailto fallback
    pg.click('.ta-fsub')
    pg.wait_for_timeout(200)
    log['form_error_shown'] = ev(pg, "() => window.__ta.state.error === true")
    pg.fill('#ta-phone', '068 111 22 33')
    pg.select_option('#ta-service', index=1)
    pg.fill('#ta-note', 'Будинок 150 м², Рудно')
    navs = []
    pg.route('mailto:*', lambda r: r.abort())
    pg.on('request', lambda r: navs.append(r.url) if r.url.startswith('mailto:') else None)
    pg.evaluate("() => { window.__mail = null; const d = Object.getOwnPropertyDescriptor(Location.prototype, 'href'); }")
    pg.click('.ta-fsub')
    pg.wait_for_timeout(500)
    log['form_state'] = ev(pg, "() => { const s = window.__ta.state; return {submitted: s.submitted, via: s.via, service: s.service, name: s.name}; }")
    log['form_thanks'] = ev(pg, "() => { const f = document.querySelector('.ta-form'); return f ? f.innerText.slice(0, 300) : ''; }")
    log['mailto_requests'] = navs[:1]
    pg.locator('.ta-form').screenshot(path=f'{OUT}/i_m_form.png')
    # images actually chosen on a phone
    log['img_choice_m'] = ev(pg, "() => [...document.querySelectorAll('img')].filter(i => i.currentSrc).slice(0, 8).map(i => (i.className||'-') + ' ' + i.currentSrc.split('/').pop() + ' @' + Math.round(i.getBoundingClientRect().width))")
    log['errors_m'] = errs
    ctx.close()

    # ---------- desktop ----------
    ctx = b.new_context(viewport={'width': 1440, 'height': 900})
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '/', wait_until='networkidle')
    pg.click('header a[href$="/sonyachni-stantsii/"]')
    pg.wait_for_load_state('networkidle')
    log['nav_to_solar'] = pg.url
    pg.evaluate("document.getElementById('portfolio').scrollIntoView()")
    pg.wait_for_timeout(300)
    pg.click('.ta-pbtn')
    pg.wait_for_timeout(500)
    pg.screenshot(path=f'{OUT}/i_d_sheet.png')
    pg.click('.ta-osheet button[aria-label="Закрити"]')
    pg.wait_for_timeout(300)
    log['d_sheet_closed'] = ev(pg, "() => !document.querySelector('.ta-ov')")
    # share copy
    ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin='/'.join(BASE.split('/')[:3]))
    pg.evaluate("document.getElementById('calc').scrollIntoView()")
    btns = pg.query_selector_all('#calc button')
    copy = [x for x in btns if 'опі' in (x.inner_text() or '')]
    if copy:
        copy[0].click()
        pg.wait_for_timeout(300)
        log['copy_label'] = copy[0].inner_text()
        log['clipboard'] = pg.evaluate("navigator.clipboard.readText()")[:160]
    log['img_choice_d'] = ev(pg, "() => [...document.querySelectorAll('img')].filter(i => i.currentSrc).slice(0, 8).map(i => (i.className||'-') + ' ' + i.currentSrc.split('/').pop() + ' @' + Math.round(i.getBoundingClientRect().width))")
    # anchors land below the sticky header
    pg.goto(BASE + '/#calc', wait_until='networkidle')
    pg.wait_for_timeout(800)
    log['anchor_calc_top'] = ev(pg, "() => Math.round(document.getElementById('calc').getBoundingClientRect().top)")
    log['errors_d'] = errs
    ctx.close()
    b.close()
print(json.dumps(log, ensure_ascii=False, indent=1))
