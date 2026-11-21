# AS techno — сайт

Новий сайт AS techno (ПП «Техно-АС», Львів): теплові насоси, сонячні та зарядні станції.

**Перегляд на GitHub Pages:** https://yarik547.github.io/AStecho/

## Що де в репозиторії

- **Корінь репозиторію** — версія для GitHub Pages: адреси з префіксом `/AStecho/`. Пошуковики її не індексують (`noindex`), щоб не дублювати справжній сайт.
- **`dist/`** — версія для справжнього домену `www.techno-as.com.ua`: адреси від кореня сайту. Як її викласти — у [DEPLOY.md](DEPLOY.md).
- **`source/`** — вихідні файли: дизайн і скрипти збірки.
- **`telegram-worker/`** — обробник, що пересилає заявки з форм у Telegram, з інструкцією.

Обидві версії збираються з одного джерела. Руками в них нічого не змінюйте: після наступної збірки правки зникнуть.

## Як це влаштовано

Сайт збирається з дизайн-компонента `source/project/Main.dc.html` — того самого файлу, що на канві Claude Design. Збірка перетворює його на звичайні HTML-сторінки, а на сторінці лишається невеликий скрипт для калькулятора, меню, карток об’єктів і форми.

## Що потрібно

- Node.js 18+ і Python 3.10+.
- Python-пакети: `pip install pillow playwright`, потім `python -m playwright install chromium`. Chromium потрібен лише для картинок поширення й іконок.

## Збірка

```bash
cd source/site_build
npm install

# версія для домену → dist/
node build.js --out=../../dist

# версія для GitHub Pages → корінь репозиторію
node build.js --out=../.. --base=/AStecho/ --site=https://yarik547.github.io/AStecho --noindex

# перегляд локально: http://localhost:8766
node serve.js ../../dist 8766
```

Прапорець `--no-og` пропускає перемальовування картинок для поширення, тож збірка йде швидше. Збірка видаляє й перезаписує лише власні файли (сторінки, `assets/`, `img/`, `og/`, іконки тощо), а `source/`, README і `dist/` у корені не чіпає.

## Вихідні файли

- `source/project/Main.dc.html` — дизайн, тексти й логіка: калькулятор, FAQ, об’єкти, мапа. Інші файли в `source/project/` — сторінки й артборди канви.
- `source/site_build/compile.js` — перетворює шаблон на функції рендеру по блоках.
- `source/site_build/client.js` — оживляє готову сторінку в браузері й оновлює лише змінені блоки (morphdom).
- `source/site_build/build.js` — сторінки, SEO-теги, Schema.org, sitemap, robots, 404, іконки.
- `source/site_build/images.py` — WebP у кількох розмірах; `og.py` — картинки для поширення.
- `source/products/` — каталог: `catalog.py` (назви, характеристики, комплектація, фото), `sel/` (фото товарів з оригінального сайту). `python3 catalog.py` створює `products.js` (вставляється в `Main.dc.html`) і `catalog.json` (з нього `build.js` робить сторінки `/katalog/<товар>/`).
- `source/assets/` і `source/preview/blobs.json` — фото й відповідність між ними та адресами `/_blob/…` у дизайні.

Нове фото:
1. Додайте файл у `source/assets/`.
2. Завантажте його на канву.
3. Пропишіть пару «id → assets/файл» у `source/preview/blobs.json`.
