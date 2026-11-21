"""Make WebP size variants for every image the site uses; print a manifest as JSON.
usage: python3 images.py blobs.json used_ids.json out_dir
"""
import json, os, re, shutil, sys
from PIL import Image

blobs = json.load(open(sys.argv[1]))
root = os.path.dirname(os.path.dirname(os.path.abspath(sys.argv[1])))
blobs = {k: os.path.join(root, v) for k, v in blobs.items()}
used = json.load(open(sys.argv[2]))
out = sys.argv[3]
os.makedirs(out, exist_ok=True)
man = {}
seen = {}
for bid in used:
    path = blobs.get(bid)
    if not path:
        continue
    base = re.sub(r'[^a-z0-9_-]+', '-', os.path.splitext(os.path.basename(path))[0].lower())
    if path in seen:
        man[bid] = seen[path]
        continue
    if path.endswith('.svg'):
        svg = open(path, encoding='utf-8').read()
        svg = re.sub(r'>\s+<', '><', svg)
        open(os.path.join(out, base + '.svg'), 'w', encoding='utf-8').write(svg)
        entry = {'src': '/img/' + base + '.svg'}
    else:
        im = Image.open(path)
        im.load()
        W, H = im.size
        is_logo = base.startswith('logo')
        if is_logo:
            widths = sorted({W // 2, W})
        elif W <= 640:
            widths = sorted({400, W})
        else:
            widths = [w for w in (480, 640, 800, 1200, 1600) if w < W - 120] + [W]
        alpha = im.mode in ('RGBA', 'LA', 'P')
        src_im = im.convert('RGBA' if alpha else 'RGB')
        variants = []
        for w in widths:
            h = round(H * w / W)
            v = src_im if w == W else src_im.resize((w, h), Image.LANCZOS)
            name = f'{base}-{w}.webp'
            v.save(os.path.join(out, name), 'WEBP', quality=90 if is_logo else (70 if w >= 1200 else 76), method=6)
            variants.append((w, '/img/' + name))
        mid = variants[-1] if is_logo else min(variants, key=lambda x: abs(x[0] - 800))
        entry = {'src': mid[1], 'set': ', '.join(f'{u} {w}w' for w, u in variants), 'w': W, 'h': H}
    man[bid] = entry
    seen[path] = entry
print(json.dumps(man, ensure_ascii=False))
