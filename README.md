# Техно-АС — сайт

Новий сайт ПП «Техно-АС» (Львів): теплові насоси, сонячні та зарядні станції. Готовий до викладання сайт лежить у `dist/`, інструкція — у [DEPLOY.md](DEPLOY.md).

## Як це влаштовано

Сайт збирається з дизайн-компонента `project/Main.dc.html` (той самий файл, що на канві Claude Design). Збірка перетворює його на звичайні HTML-сторінки, а на сторінці лишається невеликий скрипт для калькулятора, меню, карток об’єктів і форми.

## Що потрібно

- Node.js 18+ і Python 3.10+.
- Python-пакети: `pip install pillow playwright`, потім `python -m playwright install chromium` (Chromium потрібен лише для картинок поширення й іконок).

## Збірка

```bash
cd site_build
npm install
node build.js          # результат — у папці dist/
node build.js --no-og  # швидше: без перемальовування картинок для поширення
node serve.js ../dist 8766   # перегляд: http://localhost:8766
```

## Що де

- `project/Main.dc.html` — дизайн, тексти й логіка (калькулятор, FAQ, об’єкти, мапа). Інші файли в `project/` — сторінки й артборди канви Claude Design.
- `site_build/compile.js` — перетворює шаблон на функції рендеру по блоках.
- `site_build/client.js` — оживляє готову сторінку в браузері: оновлює лише змінені блоки (morphdom).
- `site_build/build.js` — сторінки, SEO-теги, Schema.org, sitemap, robots, 404, іконки.
- `site_build/images.py` — WebP у кількох розмірах; `og.py` — картинки для поширення.
- `assets/` і `preview/blobs.json` — фото й відповідність між ними та адресами `/_blob/…` у дизайні.

Нове фото: додайте файл в `assets/`, завантажте його на канву і пропишіть пару «id → assets/файл» у `preview/blobs.json`.
