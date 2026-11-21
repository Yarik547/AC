from playwright.sync_api import sync_playwright
import json, os
B=os.environ.get('BASE_URL','http://localhost:8766')
res={}
with sync_playwright() as pw:
    for engine in ['chromium','webkit']:
        b=getattr(pw,engine).launch()
        for tag,ctxargs in [('d',dict(viewport={'width':1440,'height':900})),('m',dict(**pw.devices['iPhone 14']) if engine=='webkit' else dict(viewport={'width':390,'height':700},is_mobile=True,has_touch=True))]:
            ctx=b.new_context(**ctxargs); pg=ctx.new_page(); errs=[]
            pg.on('pageerror',lambda e: errs.append(str(e)))
            pg.goto(B+'/',wait_until='networkidle'); pg.wait_for_function('window.__ta'); pg.wait_for_timeout(2600)
            key=f'{engine}_{tag}'
            # flow not pinned
            res[key+'_flowpin']=pg.evaluate("getComputedStyle(document.querySelector('#flow > div')).position + ' h=' + document.getElementById('flow').offsetHeight")
            box=pg.locator('.ta-masc-btn').bounding_box()
            cx,cy=box['x']+box['width']/2, box['y']+box['height']/2
            if tag=='d':
                # tap -> bubble
                pg.mouse.click(cx,cy); pg.wait_for_timeout(400)
                res[key+'_tap_opens']=pg.evaluate("!!document.querySelector('.ta-mplq, .ta-mtag')")
                pg.mouse.click(cx,cy); pg.wait_for_timeout(300)
                # drag and throw left-up
                pg.mouse.move(cx,cy); pg.mouse.down()
                for i in range(1,13):
                    pg.mouse.move(cx-i*40, cy-i*25); pg.wait_for_timeout(12)
                mid=pg.evaluate("[getComputedStyle(document.documentElement).getPropertyValue('--masc-x'),document.documentElement.className]")
                pg.mouse.up()
                pg.wait_for_timeout(250); pg.screenshot(path=f'shots/phys_{key}_fly.png')
                fly=pg.evaluate("[getComputedStyle(document.documentElement).getPropertyValue('--masc-x'),getComputedStyle(document.documentElement).getPropertyValue('--masc-y'),document.documentElement.className]")
                pg.wait_for_timeout(5500)
                end=pg.evaluate("[getComputedStyle(document.documentElement).getPropertyValue('--masc-x'),getComputedStyle(document.documentElement).getPropertyValue('--masc-y'),document.documentElement.className, !!document.querySelector('.ta-mplq, .ta-mtag')]")
                res[key+'_drag']=mid; res[key+'_fly']=fly; res[key+'_end']=end
            else:
                pg.tap('.ta-masc-btn'); pg.wait_for_timeout(400)
                res[key+'_tap_opens']=pg.evaluate("!!document.querySelector('.ta-mplq, .ta-mtag')")
                pg.tap('.ta-mplq .ta-mbub-x'); pg.wait_for_timeout(300)
                # touch drag via CDP-less: dispatch pointer events
                pg.evaluate(f"""(()=>{{const t=document.querySelector('.ta-masc-btn');const ev=(type,x,y)=>t.dispatchEvent(new PointerEvent(type,{{bubbles:true,cancelable:true,pointerId:7,pointerType:'touch',clientX:x,clientY:y,isPrimary:true}}));
                ev('pointerdown',{cx},{cy});}})()""")
                for i in range(1,10):
                    pg.evaluate(f"window.dispatchEvent(new PointerEvent('pointermove',{{bubbles:true,cancelable:true,pointerId:7,pointerType:'touch',clientX:{cx-i*25},clientY:{cy-i*40},isPrimary:true}}))"); pg.wait_for_timeout(14)
                pg.evaluate(f"window.dispatchEvent(new PointerEvent('pointerup',{{bubbles:true,pointerId:7,pointerType:'touch',clientX:{cx-225},clientY:{cy-360},isPrimary:true}}))")
                pg.wait_for_timeout(250); pg.screenshot(path=f'shots/phys_{key}_fly.png')
                res[key+'_fly']=pg.evaluate("[getComputedStyle(document.documentElement).getPropertyValue('--masc-x'),getComputedStyle(document.documentElement).getPropertyValue('--masc-y'),document.documentElement.className]")
                pg.wait_for_timeout(5500)
                res[key+'_end']=pg.evaluate("[getComputedStyle(document.documentElement).getPropertyValue('--masc-x'),getComputedStyle(document.documentElement).getPropertyValue('--masc-y'),document.documentElement.className, !!document.querySelector('.ta-mplq, .ta-mtag')]")
            res[key+'_errors']=errs
            ctx.close()
        b.close()
print(json.dumps(res,ensure_ascii=False,indent=0))
