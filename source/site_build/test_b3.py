from playwright.sync_api import sync_playwright
import json, os
B=os.environ.get('BASE_URL','http://localhost:8766')
out={}
with sync_playwright() as pw:
    b=pw.chromium.launch()
    for vw,vh,tag,mob in [(1440,900,'d',False),(390,844,'m',True)]:
        ctx=b.new_context(viewport={'width':vw,'height':vh},device_scale_factor=2 if mob else 1,is_mobile=mob,has_touch=mob)
        pg=ctx.new_page(); errs=[]
        pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
        pg.goto(B+'/',wait_until='networkidle'); pg.wait_for_function('window.__ta')
        pg.wait_for_timeout(500)
        pg.screenshot(path=f'shots/b3_{tag}_hero.png')
        pg.click('.ta-masc-btn'); pg.wait_for_timeout(500)
        pg.screenshot(path=f'shots/b3_{tag}_bubble.png')
        out[tag+'_bubble']=pg.inner_text('.ta-mplq')[:160]
        pg.click('.ta-mplq .ta-mbub-x'); pg.wait_for_timeout(200)
        # quick form validation + submit
        pg.fill('#ta-qphone','067'); pg.click('.ta-qbtn'); pg.wait_for_timeout(200)
        out[tag+'_qerr']=pg.inner_text('.ta-qmsg')
        pg.route('mailto:*', lambda r: r.abort())
        pg.fill('#ta-qphone','067 123 45 67'); pg.click('.ta-qbtn'); pg.wait_for_timeout(300)
        out[tag+'_qok']=pg.inner_text('.ta-qmsg')
        # pinned flow: scroll through
        top=pg.evaluate("document.getElementById('flow').getBoundingClientRect().top+scrollY")
        h=pg.evaluate("document.getElementById('flow').offsetHeight")
        out[tag+'_flow_h']=h
        shots=[]
        for k,frac in enumerate([0.05,0.5,0.9]):
            y=top+frac*(h-vh)
            pg.evaluate(f"window.scrollTo(0,{y})"); pg.wait_for_timeout(700)
            pg.screenshot(path=f'shots/b3_{tag}_pin{k}.png')
            shots.append(pg.evaluate("window.__ta.state.scenario"))
        out[tag+'_pin_steps']=shots
        out[tag+'_mascot_sec']=pg.evaluate("window.__ta.state.mascotSec")
        out[tag+'_flow_fits']=pg.evaluate("(()=>{const i=document.querySelector('.ta-pin-in');return i? [i.scrollHeight, i.clientHeight]:null})()")
        # how section
        pg.evaluate("document.getElementById('how').scrollIntoView({behavior:'instant'})"); pg.wait_for_timeout(500)
        pg.screenshot(path=f'shots/b3_{tag}_how.png')
        out[tag+'_sec_how']=pg.evaluate("window.__ta.state.mascotSec")
        # hide mascot (from a sign: the credit tip on the home page has no target)
        pg.evaluate("document.getElementById('contacts').scrollIntoView({behavior:'instant'})"); pg.wait_for_timeout(600)
        out[tag+'_sec_contacts']=pg.evaluate("window.__ta.state.mascotSec")
        pg.evaluate("window.__ta && (window.__ta.state.mascotSec)")
        pg.click('.ta-masc-btn'); pg.wait_for_timeout(500)
        pg.click('.ta-mplq .ta-mbub-hide'); pg.wait_for_timeout(300)
        out[tag+'_hidden']=pg.evaluate("!document.querySelector('.ta-masc') && localStorage.getItem('ta-masc')")
        pg.reload(wait_until='networkidle'); pg.wait_for_function('window.__ta'); pg.wait_for_timeout(1700)
        out[tag+'_hidden_after_reload']=pg.evaluate("!document.querySelector('.ta-masc')")
        pg.evaluate("document.querySelector('.ta-foot').scrollIntoView({behavior:'instant'})"); pg.wait_for_timeout(300)
        btn=pg.locator('text=Показати Інженера AS')
        out[tag+'_show_btn']=btn.count()
        if btn.count(): btn.first.click(); pg.wait_for_timeout(300)
        out[tag+'_back']=pg.evaluate("!!document.querySelector('.ta-masc')")
        # credit page
        pg.goto(B+'/kredyty/',wait_until='networkidle'); pg.wait_for_function('window.__ta'); pg.wait_for_timeout(400)
        pg.evaluate("document.getElementById('credit').scrollIntoView({behavior:'instant'})"); pg.wait_for_timeout(400)
        pg.locator('#credit').screenshot(path=f'shots/b3_{tag}_credit.png')
        pg.locator('.ta-cr-chip').nth(1).click(); pg.wait_for_timeout(200)
        rng=pg.query_selector('#cr-amt'); rng.evaluate("(el)=>{el.value='480';el.dispatchEvent(new Event('input',{bubbles:true}))}"); pg.wait_for_timeout(300)
        out[tag+'_credit_calc']=pg.evaluate("(()=>{const c=document.querySelector('#credit');return [...c.querySelectorAll('span')].map(s=>s.innerText).filter(t=>/≈|тис/.test(t)).slice(0,6)})()")
        out[tag+'_errors']=errs
        ctx.close()
    b.close()
print(json.dumps(out,ensure_ascii=False,indent=0))
