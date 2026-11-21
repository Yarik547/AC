# Batch 4 checks: catalogue, product page, service tools, Інженер AS tips (sign and pointing at a block).
# usage: BASE_URL=http://localhost:8771 python3 test_b4.py
import asyncio, os, re
from playwright.async_api import async_playwright

BASE = os.environ.get('BASE_URL', 'http://localhost:8771').rstrip('/')
OUT = '/tmp/s4'
os.makedirs(OUT, exist_ok=True)

async def booted(pg):
    await pg.mouse.move(3, 3)
    await pg.wait_for_function('() => window.__ta && window.__ta.state', timeout=8000)

async def run(pw, engine, mobile):
    tag = f'{engine}-{"m" if mobile else "d"}'
    br = await getattr(pw, engine).launch()
    if mobile:
        ctx = await br.new_context(**pw.devices['iPhone 14'])
    else:
        ctx = await br.new_context(viewport={'width': 1440, 'height': 900})
    pg = await ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    ok = []
    def check(name, cond):
        ok.append((name, bool(cond)))
        if not cond: print(f'  FAIL [{tag}] {name}')

    # --- catalogue
    await pg.goto(BASE + '/katalog/', wait_until='networkidle')
    await booted(pg)
    n_all = await pg.locator('#catalog .ta-pcard').count()
    check('catalogue lists 32 cards', n_all == 32)
    await pg.get_by_role('button', name=re.compile('^Теплові насоси')).click()
    await pg.wait_for_timeout(200)
    check('filter: heat pumps = 9', await pg.locator('#catalog .ta-pcard').count() == 9)
    await pg.locator('#catalog .ta-pcard-a').first.click()
    await pg.wait_for_load_state('networkidle')
    check('card opens a product page', '/katalog/' in pg.url and pg.url.rstrip('/').split('/')[-1] != 'katalog')

    # --- product page
    await pg.goto(BASE + '/katalog/gibrydna-ses-8-kvt/', wait_until='networkidle')
    await booted(pg)
    check('product h1', 'Гібридна сонячна станція 8 кВт' in await pg.locator('h1').inner_text())
    check('kit table', await pg.locator('.ta-pkit-r').count() >= 5)
    await pg.locator('.ta-pthumb').nth(1).click()
    await pg.wait_for_timeout(200)
    check('thumb switches photo', await pg.locator('.ta-pthumb').nth(1).get_attribute('aria-pressed') == 'true')
    await pg.locator('#ta-pphone').fill('067')
    await pg.get_by_role('button', name='Дізнатися ціну').click()
    await pg.wait_for_timeout(200)
    check('short phone rejected', await pg.locator('#product .ta-qmsg').count() == 1 and 'повністю' in await pg.locator('#product .ta-qmsg').inner_text())
    rel = await pg.locator('#product .ta-prods .ta-pcard').count()
    check('related products', rel >= 2)

    # --- heat tool
    await pg.goto(BASE + '/teplovi-nasosy/', wait_until='networkidle')
    await booted(pg)
    check('heat page has tool', await pg.locator('#heattool').count() == 1)
    check('heat page has products', await pg.locator('#products .ta-pcard').count() == 9)
    check('no solar tool on heat page', await pg.locator('#soltool').count() == 0)
    big = pg.locator('#heattool .ta-hp-big b')
    before = await big.inner_text()
    await pg.locator('#hp-t').fill('-25')
    await pg.wait_for_timeout(250)
    after = await big.inner_text()
    check('COP changes with temperature', before != after)
    check('cold warning', await pg.locator('#heattool .ta-hp-warn').count() == 1)

    # --- Інженер AS: sign, then a trick, then pointing at a block
    await pg.evaluate('window.scrollTo(0, 0)')
    await pg.wait_for_function("window.__ta.state.mascotSec === 'top'", timeout=5000)
    await pg.wait_for_timeout(300)
    m = pg.locator('.ta-masc-live .ta-masc-btn')
    check('bulb lit at the top', await pg.locator('.ta-masc-live.ta-masc-lit').count() == 1)
    await m.click()
    await pg.wait_for_timeout(900)
    check('sign is pulled out', await pg.locator('.ta-mplq').count() == 1)
    check('bulb off after reading', await pg.locator('.ta-masc-live.ta-masc-lit').count() == 0)
    await pg.screenshot(path=f'{OUT}/{tag}-sign.png')
    await pg.locator('.ta-mplq .ta-mbub-x').click()
    await pg.wait_for_timeout(300)
    check('sign closes', await pg.locator('.ta-mplq').count() == 0)
    await m.click()
    await pg.wait_for_timeout(120)
    trick = await pg.evaluate("document.documentElement.classList.contains('ta-mfx-trick')")
    check('tap without a tip: trick, no sign', trick and await pg.locator('.ta-mplq').count() == 0)
    await pg.wait_for_timeout(1400)
    await pg.evaluate("document.getElementById('heattool').scrollIntoView({block:'start'})")
    await pg.wait_for_timeout(700)
    await pg.evaluate('window.scrollBy(0, 120)')
    await pg.wait_for_timeout(700)
    check('bulb lit at the heat tool', await pg.locator('.ta-masc-live.ta-masc-lit').count() == 1)
    await m.click()
    await pg.wait_for_timeout(1500)
    check('points at a block', await pg.locator('.ta-mtag').count() == 1 and await pg.locator('.ta-mspot').count() == 1)
    tb = await pg.locator('#hp-t').bounding_box()
    mb = await pg.locator('.ta-masc-live').bounding_box()
    tg = await pg.locator('.ta-mtag').bounding_box()
    vw = pg.viewport_size
    near = mb and tb and abs((mb['y'] + mb['height'] * 0.6) - tb['y']) < 160 and abs((mb['x'] + mb['width'] * 0.42) - (tb['x'] + tb['width'])) < 220
    check('flew next to the slider', near)
    check('tip on screen', tg and tg['x'] >= 0 and tg['y'] >= 0 and tg['x'] + tg['width'] <= vw['width'] + 1 and tg['y'] + tg['height'] <= vw['height'] + 1)
    check('wrench out', await pg.evaluate("document.querySelector('.ta-masc-live').classList.contains('ta-masc-spot')"))
    await pg.screenshot(path=f'{OUT}/{tag}-spot.png')
    await pg.get_by_role('button', name='Зрозуміло').click()
    await pg.wait_for_timeout(2200)
    check('tip closes', await pg.locator('.ta-mtag').count() == 0)
    mb2 = await pg.locator('.ta-masc-live').bounding_box()
    check('flew back home', mb2 and mb2['x'] + mb2['width'] > vw['width'] - 40 and mb2['y'] + mb2['height'] > vw['height'] - 260)

    # --- solar tool
    await pg.goto(BASE + '/sonyachni-stantsii/', wait_until='networkidle')
    await booted(pg)
    h = pg.locator('#soltool .ta-bat-h')
    h0 = await h.inner_text()
    await pg.locator('#soltool .ta-tapp', has_text='Бойлер').click()
    await pg.wait_for_timeout(200)
    check('battery hours react', await h.inner_text() != h0)
    await pg.locator('#soltool .ta-pv-chips .ta-tchip', has_text='20').click()
    await pg.wait_for_timeout(200)
    check('PV year total for 20 kW', '21' in await pg.locator('#soltool .ta-pv-sum b').first.inner_text())
    check('solar products', await pg.locator('#products .ta-pcard').count() == 8)

    # --- EV tool
    await pg.goto(BASE + '/zaryadni-stantsii/', wait_until='networkidle')
    await booted(pg)
    await pg.locator('#evtool .ta-ev-cars button', has_text='Renault Zoe').click()
    await pg.wait_for_timeout(150)
    check('Zoe on 3 phases: 22 kW', '22' in await pg.locator('#evtool .ta-hp-big b').inner_text())
    await pg.locator('#evtool .ta-ev-ph button', has_text='1 фаза').click()
    await pg.wait_for_timeout(150)
    check('1 phase: 7,4 kW + warning', '7,4' in await pg.locator('#evtool .ta-hp-big b').inner_text() and await pg.locator('#evtool .ta-hp-warn').count() == 1)
    await pg.locator('#evtool .ta-evw-tabs button', has_text='Бізнес').click()
    await pg.wait_for_timeout(150)
    check('install tabs', 'DC' in await pg.locator('#evtool .ta-evw-steps').inner_text())
    check('EV kits shown', await pg.locator('#products .ta-pcard').count() == 3)

    check('no console errors', not errs)
    if errs: print('  errors:', errs[:5])
    await br.close()
    return ok

async def main():
    async with async_playwright() as pw:
        total = []
        for engine in ['chromium', 'webkit']:
            for mobile in [False, True]:
                r = await run(pw, engine, mobile)
                total += r
                print(engine, 'mobile' if mobile else 'desktop', sum(1 for _, v in r if v), '/', len(r))
        print('ALL OK' if all(v for _, v in total) else 'SOME FAILED')

asyncio.run(main())
