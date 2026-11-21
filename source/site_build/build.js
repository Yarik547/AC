// Builds the static site into ../dist from the Claude Design component.
// usage: node build.js [--no-og] [--base=/AStecho/] [--out=../dist] [--site=https://…] [--noindex]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const esbuild = require('esbuild');
const { compileTemplate } = require('./compile');

const ROOT = path.resolve(__dirname, '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const BASE = ('/' + arg('base', '/').replace(/^\/+|\/+$/g, '') + '/').replace('//', '/');
const DIST = path.resolve(__dirname, arg('out', '../dist'));
const GEN = path.join(__dirname, 'gen');
const SITE = arg('site', 'https://www.techno-as.com.ua').replace(/\/+$/, '');
const NOINDEX = process.argv.includes('--noindex');
const U = (p) => BASE + String(p).replace(/^\//, '');
// Files and folders this script writes; only these are removed before a build,
// so the output folder may also hold other things (e.g. the repository root).
const GENERATED = ['index.html', '404.html', 'assets', 'img', 'og', 'teplovi-nasosy', 'sonyachni-stantsii', 'zaryadni-stantsii', 'kredyty', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'site.webmanifest', 'robots.txt', 'sitemap.xml', 'config.js', '_headers', '.htaccess', '.nojekyll'];
const PHONE = '+380684090275';
const TODAY = new Date().toISOString().slice(0, 10);

const PAGES = [
  { page: 'home', url: '/', title: 'Техно-АС — теплові насоси, сонячні та зарядні станції у Львові',
    desc: 'Теплові насоси, сонячні станції та зарядні станції для електромобілів у Львові й області. Працюємо з 2001 року. Калькулятор вартості та консультація інженера.',
    og: { title: 'Тепло, світло і заряд для вашого дому', sub: 'Теплові насоси, сонячні та зарядні станції у Львові й області' } },
  { page: 'heat', url: '/teplovi-nasosy/', title: 'Теплові насоси у Львові — розрахунок і монтаж під ключ | Техно-АС', crumb: 'Теплові насоси',
    desc: 'Тепловий насос для будинку у Львові та області: розрахунок, монтаж, запуск і сервіс. Порахуйте вартість у калькуляторі або отримайте консультацію інженера.',
    service: 'Монтаж теплових насосів', og: { title: 'Теплові насоси під ключ', sub: 'Опалення й гаряча вода за рахунок тепла повітря' } },
  { page: 'solar', url: '/sonyachni-stantsii/', title: 'Сонячні станції для дому й бізнесу у Львові | Техно-АС', crumb: 'Сонячні станції',
    desc: 'Сонячні станції під ключ для дому й бізнесу: власна електроенергія і світло під час відключень. Розрахунок під ваше споживання, монтаж у Львові та області.',
    service: 'Монтаж сонячних електростанцій', og: { title: 'Сонячні станції під ключ', sub: 'Власна електроенергія і світло під час відключень' } },
  { page: 'ev', url: '/zaryadni-stantsii/', title: 'Зарядні станції для електромобілів у Львові | Техно-АС', crumb: 'Зарядні станції',
    desc: 'Домашні зарядні станції 7–22 кВт і швидкі DC-станції для бізнесу. Підбір, монтаж і підключення у Львові та області, можна поєднати із сонячною станцією.',
    service: 'Монтаж зарядних станцій для електромобілів', og: { title: 'Зарядні станції для електромобілів', sub: 'Удома й для бізнесу: від 7 кВт до швидких DC' } },
  { page: 'credit', url: '/kredyty/', title: 'Кредит від 0% на сонячну станцію й генератор — умови 2026 | Техно-АС', crumb: 'Кредит від 0%',
    desc: 'Як узяти кредит від 0% за програмою «Доступні кредити 5–7–9%» на автономне живлення будинку: до 480 тис. грн, компенсація до 30%. Умови станом на листопад 2026 року.',
    og: { title: 'Кредит від 0% на світло для дому', sub: 'До 480 тис. грн і компенсація до 30% тіла кредиту' } }
];

const hash = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const write = (rel, data) => { const p = path.join(DIST, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); return p; };

async function main() {
  const noOg = process.argv.includes('--no-og');
  fs.mkdirSync(DIST, { recursive: true });
  // --no-og keeps the share images and icons from the previous full build
  const KEEP = noOg ? new Set(['og', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) : new Set();
  for (const f of GENERATED) if (!KEEP.has(f)) fs.rmSync(path.join(DIST, f), { recursive: true, force: true });
  fs.mkdirSync(GEN, { recursive: true });

  // 1. Compile the design component
  const src = fs.readFileSync(path.join(ROOT, 'project/Main.dc.html'), 'utf8');
  const { moduleCode, helmet } = compileTemplate(src);
  fs.writeFileSync(path.join(GEN, 'template.mjs'), moduleCode);

  // 2. Images -> WebP variants + manifest
  const used = [...new Set([...src.matchAll(/\/_blob\/([0-9a-f]{32})/g)].map((m) => m[1]))];
  fs.writeFileSync(path.join(GEN, 'used.json'), JSON.stringify(used));
  const man = JSON.parse(execFileSync('python3', [path.join(__dirname, 'images.py'), path.join(ROOT, 'preview/blobs.json'), path.join(GEN, 'used.json'), path.join(DIST, 'img')], { maxBuffer: 1 << 24 }).toString());
  const missing = used.filter((id) => !man[id]);
  if (missing.length) throw new Error('images without a local file: ' + missing.join(', '));
  for (const e of Object.values(man)) { e.src = U(e.src); if (e.set) e.set = e.set.split(', ').map((x) => U(x)).join(', '); }
  fs.writeFileSync(path.join(GEN, 'img.mjs'), `
const MAN=${JSON.stringify(man)};
const E=(s)=>String(s).replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SIZES=[[/ta-heropar/,'100vw'],[/ta-par/,'(max-width: 900px) 100vw, 50vw'],[/ta-gimg/,'(max-width: 640px) 72vw, 300px'],[/ta-oimg-i/,'(max-width: 700px) 100vw, 640px'],[/ta-mthumb-i/,'136px'],[/ta-flogo/,'180px'],[/ta-logo/,'80px']];
export function imgInfo(src){return src&&src.indexOf('/_blob/')===0?MAN[src.slice(7)]||null:null;}
export function sizesFor(cls){for(let i=0;i<SIZES.length;i++)if(SIZES[i][0].test(cls))return SIZES[i][1];return '100vw';}
export function IMG(src,cls){
  const m=imgInfo(src);
  let o=' src="'+E(m?m.src:src)+'"';
  if(m&&m.set)o+=' srcset="'+m.set+'" sizes="'+sizesFor(cls)+'"';
  if(/ta-heropar/.test(cls))o+=' fetchpriority="high"';
  else if(!/ta-logo/.test(cls))o+=' loading="lazy"';
  return o+' decoding="async"';
}`);

  // 3. Fonts
  const fontSrc = path.join(__dirname, 'node_modules/@fontsource-variable/manrope/files');
  const fonts = {};
  for (const sub of ['cyrillic', 'latin', 'cyrillic-ext', 'latin-ext']) {
    const buf = fs.readFileSync(path.join(fontSrc, `manrope-${sub}-wght-normal.woff2`));
    const rel = `/assets/fonts/manrope-${sub}.${hash(buf)}.woff2`;
    write(rel, buf);
    fonts[sub] = U(rel);
  }
  const RANGES = {
    'cyrillic-ext': 'U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F',
    cyrillic: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116',
    'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
    latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
  };
  const fontCss = Object.entries(RANGES).map(([sub, r]) => `@font-face{font-family:'Manrope';font-style:normal;font-display:swap;font-weight:200 800;src:url(${fonts[sub]}) format('woff2');unicode-range:${r}}`).join('\n');

  // 4. CSS
  const designCss = [...helmet.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const siteCss = `${fontCss}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%;scroll-padding-top:92px}
body{margin:0;background:#fff}
.ta-chunk{display:contents}
html.ta-lock{overflow:hidden}
@media (max-width:900px){html{scroll-padding-top:76px}}
${designCss}`;
  const css = (await esbuild.transform(siteCss, { loader: 'css', minify: true })).code;
  const cssRel = `/assets/site.${hash(css)}.css`;
  write(cssRel, css);
  const cssUrl = U(cssRel);

  // 5. Client bundle
  const bundle = await esbuild.build({ entryPoints: [path.join(__dirname, 'client.js')], bundle: true, minify: true, format: 'iife', target: ['es2020', 'safari14', 'chrome90', 'firefox90'], write: false, legalComments: 'none' });
  const jsCode = bundle.outputFiles[0].contents;
  const jsRel = `/assets/app.${hash(jsCode)}.js`;
  write(jsRel, jsCode);
  const jsUrl = U(jsRel);
  write('config.js', [
    '// Адреса обробника форми (POST JSON: name, phone, service, note, page), напр. Cloudflare Worker з папки telegram-worker.',
    '// Порожньо — заявка відкриється листом на tehno.as.lviv@gmail.com.',
    "window.TA_FORM_ENDPOINT = '';",
    '',
    '// Жива генерація станції: адреса, що віддає JSON {"power_kw": 4.2, "today_kwh": 18.5, "place": "Львів"}. Порожньо — блок прихований.',
    "window.TA_LIVE_ENDPOINT = '';",
    '',
    "// Інженер IS: 'always' — завжди видно, 'tips' — з’являється, коли є нова порада, 'off' — вимкнено.",
    "window.TA_MASCOT_MODE = 'always';",
    ''
  ].join('\n'));

  // 6. Pre-render every page
  const tpl = await import(pathToFileURL(path.join(GEN, 'template.mjs')).href + '?v=' + Date.now());
  const img = await import(pathToFileURL(path.join(GEN, 'img.mjs')).href + '?v=' + Date.now());
  tpl.setImg(img.IMG);
  class DCLogic {
    constructor(p) { this.props = p || {}; }
    setState(u) { const p = typeof u === 'function' ? u(this.state, this.props) : u; this.state = Object.assign({}, this.state, p); }
    forceUpdate() {}
  }
  const Component = tpl.makeComponent(DCLogic);

  const business = {
    '@type': 'LocalBusiness', '@id': SITE + '/#business', name: 'Техно-АС', legalName: 'ПП «Техно-АС»', url: SITE + '/',
    logo: SITE + '/img/' + path.basename(man['0b85442bc566a74d30e892c7ea73a51c'].src), image: SITE + '/og/home.jpg',
    telephone: PHONE, email: 'tehno.as.lviv@gmail.com', foundingDate: '2001',
    address: { '@type': 'PostalAddress', streetAddress: 'вул. Пасічна, 160', addressLocality: 'Львів', addressCountry: 'UA' },
    areaServed: ['Львівська область', 'Тернопільська область', 'Закарпатська область'].map((n) => ({ '@type': 'AdministrativeArea', name: n })),
    sameAs: ['https://www.instagram.com/tekhnoas/', 'https://www.tiktok.com/@texno_ac', 'https://www.facebook.com/profile.php?id=100057052601698', 'https://www.youtube.com/channel/UCbAuHbvbUxwZGdfSu9ZNfMg']
  };

  const report = [];
  for (const P of PAGES) {
    const props = Object.assign({}, tpl.PROP_DEFAULTS, { page: P.page, site: true, base: BASE });
    const c = new Component(props);
    const vals = c.renderVals();
    const parts = tpl.CHUNKS.map((f, i) => {
      const list = [];
      const H = (fn) => { if (typeof fn !== 'function') return ''; list.push(fn); return list.length - 1; };
      return `<div class="ta-chunk" data-c="${i}">${f(vals, H)}</div>`;
    });
    const bodyHtml = tpl.ROOT_OPEN + tpl.PAGE_OPEN + parts.slice(0, tpl.IN_PAGE).join('') + '</div>' + parts.slice(tpl.IN_PAGE).join('') + '</div>';
    const canon = SITE + P.url;
    const hero = img.imgInfo(vals.heroImg);
    const graph = [business];
    if (P.page === 'home') graph.push({ '@type': 'WebSite', '@id': SITE + '/#website', url: SITE + '/', name: 'Техно-АС', inLanguage: 'uk', publisher: { '@id': SITE + '/#business' } });
    graph.push({ '@type': 'WebPage', '@id': canon + '#page', url: canon, name: P.title, description: P.desc, inLanguage: 'uk', isPartOf: { '@id': SITE + '/#website' }, about: { '@id': SITE + '/#business' }, primaryImageOfPage: SITE + '/og/' + P.page + '.jpg' });
    if (P.service) {
      graph.push({ '@type': 'Service', name: P.service, serviceType: P.crumb, provider: { '@id': SITE + '/#business' }, areaServed: business.areaServed, url: canon, description: P.desc });
      graph.push({ '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Головна', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: P.crumb, item: canon }] });
    }
    if (Array.isArray(vals.faqs) && vals.faqs.length) {
      graph.push({ '@type': 'FAQPage', mainEntity: vals.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a + (f.link ? ' ' + f.link : '') } })) });
    }
    const ld = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
    const head = [
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
      NOINDEX ? '<meta name="robots" content="noindex">' : '',
      `<title>${esc(P.title)}</title>`,
      `<meta name="description" content="${esc(P.desc)}">`,
      `<link rel="canonical" href="${canon}">`,
      '<meta name="theme-color" content="#ffffff">',
      '<meta name="format-detection" content="telephone=no">',
      `<link rel="preload" href="${fonts.cyrillic}" as="font" type="font/woff2" crossorigin>`,
      `<link rel="preload" href="${fonts.latin}" as="font" type="font/woff2" crossorigin>`,
      hero && hero.set ? `<link rel="preload" as="image" href="${hero.src}" imagesrcset="${hero.set}" imagesizes="100vw" fetchpriority="high">` : '',
      `<style>${css}</style>`,
      `<link rel="icon" href="${U('favicon.svg')}" type="image/svg+xml">`,
      `<link rel="icon" href="${U('favicon-32.png')}" sizes="32x32" type="image/png">`,
      `<link rel="apple-touch-icon" href="${U('apple-touch-icon.png')}">`,
      `<link rel="manifest" href="${U('site.webmanifest')}">`,
      '<meta property="og:type" content="website">',
      '<meta property="og:locale" content="uk_UA">',
      '<meta property="og:site_name" content="Техно-АС">',
      `<meta property="og:title" content="${esc(P.title)}">`,
      `<meta property="og:description" content="${esc(P.desc)}">`,
      `<meta property="og:url" content="${canon}">`,
      `<meta property="og:image" content="${SITE}/og/${P.page}.jpg">`,
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      `<meta property="og:image:alt" content="${esc(P.og.title)}">`,
      '<meta name="twitter:card" content="summary_large_image">',
      `<script type="application/ld+json">${ld}</script>`,
      `<script defer src="${U('config.js')}"></script>`,
      `<script defer src="${jsUrl}"></script>`
    ].filter(Boolean).join('\n');
    const html = `<!doctype html>\n<html lang="uk" data-page="${P.page}" data-base="${BASE}">\n<head>\n${head}\n</head>\n<body>\n${bodyHtml}\n</body>\n</html>\n`;
    write(path.join(P.url, 'index.html'), html);
    report.push(`${P.url} ${Math.round(html.length / 1024)} KB`);
  }

  // 7. Share images and icons
  fs.copyFileSync(path.join(__dirname, 'favicon.svg'), path.join(DIST, 'favicon.svg'));
  fs.mkdirSync(path.join(DIST, 'og'), { recursive: true });
  if (!noOg) {
    const blobs = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, 'preview/blobs.json'), 'utf8'))).map(([k, v]) => [k, path.resolve(ROOT, v)]));
    const heroFile = { home: blobs['9f6a3cecaf9c33a6c058c8f5f038abb9'], heat: blobs['76cf2841f7d367cd383eecd5eb37a33a'], solar: blobs['5d0a412a73e3051a7fdbb9dc3a3ad5d2'], ev: blobs['8f2af6843b0a6094fe99789fa1116c53'], credit: blobs['5d0a412a73e3051a7fdbb9dc3a3ad5d2'] };
    const spec = { font_dir: fontSrc, logo: blobs['0b85442bc566a74d30e892c7ea73a51c'], favicon_svg: path.join(__dirname, 'favicon.svg'), out_dir: path.join(DIST, 'og'),
      cards: PAGES.map((P) => ({ out: P.page + '.jpg', img: heroFile[P.page], title: P.og.title, sub: P.og.sub })) };
    fs.writeFileSync(path.join(GEN, 'og.json'), JSON.stringify(spec));
    execFileSync('python3', [path.join(__dirname, 'og.py'), path.join(GEN, 'og.json')], { stdio: 'inherit' });
    for (const f of ['favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) fs.renameSync(path.join(DIST, 'og', f), path.join(DIST, f));
  }

  // 8. Service files
  write('site.webmanifest', JSON.stringify({
    name: 'Техно-АС', short_name: 'Техно-АС', lang: 'uk', start_url: BASE, scope: BASE, display: 'standalone',
    background_color: '#ffffff', theme_color: '#ffffff',
    icons: [{ src: U('icon-192.png'), sizes: '192x192', type: 'image/png' }, { src: U('icon-512.png'), sizes: '512x512', type: 'image/png' }, { src: U('favicon.svg'), sizes: 'any', type: 'image/svg+xml' }]
  }, null, 2));
  write('robots.txt', NOINDEX ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  write('.nojekyll', '');
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PAGES.map((P) => `  <url><loc>${SITE}${P.url}</loc><lastmod>${TODAY}</lastmod><priority>${P.page === 'home' ? '1.0' : '0.8'}</priority></url>`).join('\n')}\n</urlset>\n`);
  const logo404 = man['0b85442bc566a74d30e892c7ea73a51c'].src;
  write('404.html', `<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Сторінку не знайдено | Техно-АС</title><meta name="robots" content="noindex"><link rel="icon" href="${U('favicon.svg')}" type="image/svg+xml"><link rel="stylesheet" href="${cssUrl}">
<style>.e{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px 20px;box-sizing:border-box;font-family:Manrope,'Segoe UI',Arial,sans-serif;color:#1C2B22;background:#EEF6F1}.e>div{max-width:520px;background:#fff;border-radius:28px;padding:40px 32px;box-shadow:0 24px 50px -30px rgba(16,40,26,.45)}.e img{height:64px}.e h1{font-size:34px;line-height:1.15;margin:28px 0 12px;letter-spacing:-.01em}.e p{font-size:18px;line-height:1.55;color:#44564B;margin:0 0 28px}.e .b{display:flex;flex-wrap:wrap;gap:12px}.e a.x{display:inline-flex;align-items:center;min-height:52px;padding:0 26px;border-radius:999px;font-weight:700;text-decoration:none;font-size:17px}.e .p{background:#28874F;color:#fff}.e .g{border:1.5px solid #9CCAAE;color:#1F6E3F}</style></head>
<body><main class="e"><div><a href="${BASE}"><img src="${logo404}" alt="Техно-АС"></a><h1>Такої сторінки немає</h1><p>Можливо, посилання застаріло. Перейдіть на головну або зателефонуйте — підкажемо.</p><div class="b"><a class="x p" href="${BASE}">На головну</a><a class="x g" href="tel:${PHONE}">068 409 02 75</a></div></div></main></body></html>
`);
  write('_headers', `${U('assets/*')}\n  Cache-Control: public, max-age=31536000, immutable\n${U('img/*')}\n  Cache-Control: public, max-age=2592000\n${U('og/*')}\n  Cache-Control: public, max-age=2592000\n${U('config.js')}\n  Cache-Control: no-cache\n`);
  write('.htaccess', `ErrorDocument 404 ${U('404.html')}
DirectoryIndex index.html
<IfModule mod_mime.c>
  AddType image/webp .webp
  AddType font/woff2 .woff2
  AddType application/manifest+json .webmanifest
</IfModule>
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript image/svg+xml application/manifest+json text/plain application/xml
</IfModule>
<IfModule mod_headers.c>
  <FilesMatch "\\.(woff2|js|css)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "\\.(webp|jpg|png|svg)$">
    Header set Cache-Control "public, max-age=2592000"
  </FilesMatch>
  <FilesMatch "^config\\.js$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
`);
  console.log(report.join('\n'));
  console.log('css', Math.round(css.length / 1024), 'KB; js', Math.round(jsCode.length / 1024), 'KB');
}

main().catch((e) => { console.error(e); process.exit(1); });
