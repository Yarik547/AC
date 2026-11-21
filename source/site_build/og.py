"""Render share images (1200x630) and favicon PNGs with headless Chromium.
usage: python3 og.py spec.json
spec: {"font_dir":..., "logo":..., "favicon_svg":..., "out_dir":..., "cards":[{"out","img","title","sub"}]}
"""
import json, sys, html, pathlib
from playwright.sync_api import sync_playwright

spec = json.load(open(sys.argv[1]))
fd = pathlib.Path(spec['font_dir']).as_uri()
out_dir = pathlib.Path(spec['out_dir'])

CARD = """<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:M;src:url({fd}/manrope-cyrillic-wght-normal.woff2) format('woff2');font-weight:200 800;unicode-range:U+0400-045F,U+0490-0491,U+2116}}
@font-face{{font-family:M;src:url({fd}/manrope-latin-wght-normal.woff2) format('woff2');font-weight:200 800;unicode-range:U+0000-00FF,U+2000-206F}}
html,body{{margin:0;width:1200px;height:630px;overflow:hidden;font-family:M,sans-serif}}
.bg{{position:absolute;inset:0;background:url({img}) center/cover}}
.sh{{position:absolute;inset:0;background:linear-gradient(90deg,rgba(14,38,24,.92) 0%,rgba(14,38,24,.78) 42%,rgba(14,38,24,.15) 78%,rgba(14,38,24,0) 100%)}}
.c{{position:absolute;left:72px;top:64px;bottom:60px;width:700px;display:flex;flex-direction:column;color:#fff}}
.lg{{align-self:flex-start;background:#fff;border-radius:22px;padding:14px 20px}}
.lg img{{height:78px;display:block}}
h1{{text-wrap:balance;margin:auto 0 18px;font-size:66px;line-height:1.04;font-weight:800;letter-spacing:-.02em}}
p{{text-wrap:balance;margin:0 0 34px;font-size:30px;line-height:1.3;color:#D7EBDD;font-weight:500}}
.f{{display:flex;gap:14px;align-items:center;font-size:26px;font-weight:700}}
.pill{{background:#F5C542;color:#1C2B22;border-radius:999px;padding:10px 22px}}
.u{{color:#BFE3CB;font-weight:600}}
</style></head><body><div class="bg"></div><div class="sh"></div><div class="c">
<div class="lg"><img src="{logo}"></div><h1>{title}</h1><p>{sub}</p>
<div class="f"><span class="pill">068 409 02 75</span><span class="u">techno-as.com.ua</span></div></div></body></html>"""

with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_page(viewport={'width': 1200, 'height': 630})
    for c in spec['cards']:
        doc = CARD.format(fd=fd, img=pathlib.Path(c['img']).as_uri(), logo=pathlib.Path(spec['logo']).as_uri(),
                          title=html.escape(c['title']), sub=html.escape(c['sub']))
        tmp = out_dir / '_og.html'
        tmp.write_text(doc, encoding='utf-8')
        pg.goto(tmp.as_uri())
        pg.wait_for_timeout(300)
        pg.screenshot(path=str(out_dir / c['out']), type='jpeg', quality=86)
        tmp.unlink()
    svg = pathlib.Path(spec['favicon_svg']).read_text(encoding='utf-8')
    for size, name in [(32, 'favicon-32.png'), (180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
        pad = 0
        inner = svg
        if name != 'favicon-32.png':
            # full-bleed square for touch icons (platform adds its own rounding)
            inner = svg.replace('rx="14"', 'rx="0"')
        p2 = b.new_page(viewport={'width': size, 'height': size})
        tag = '<svg width="%d" height="%d" ' % (size, size)
        p2.set_content('<html><body style="margin:0;background:transparent">' + inner.replace('<svg ', tag, 1) + '</body></html>')
        p2.screenshot(path=str(out_dir / name), omit_background=True)
        p2.close()
    b.close()
print('ok')
