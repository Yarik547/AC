# Заявки з сайту в Telegram

Невеликий обробник на Cloudflare Workers (безкоштовного тарифу вистачає). Він приймає заявку з форм сайту й надсилає її повідомленням у Telegram. Токен бота лежить у Cloudflare, а не на сайті, тому його ніхто не побачить.

## 1. Бот і чат

1. У Telegram напишіть [@BotFather](https://t.me/BotFather) → `/newbot` → придумайте назву. Отримаєте **токен** виду `123456:ABC…`.
2. Додайте бота в чат або групу, куди мають приходити заявки, і напишіть туди будь-що.
3. Відкрийте `https://api.telegram.org/bot<ТОКЕН>/getUpdates` і знайдіть `"chat":{"id": …}` — це **TG_CHAT_ID**. У групи він починається з мінуса.

## 2. Worker

**Через сайт Cloudflare (без командного рядка):**
1. dash.cloudflare.com → Workers & Pages → Create → Worker → назвіть `techno-as-leads` → Deploy.
2. Edit code → вставте вміст `worker.js` → Deploy.
3. Settings → Variables and Secrets:
   - `TG_TOKEN` — Secret, токен бота;
   - `TG_CHAT_ID` — id чату;
   - `ALLOWED_ORIGINS` — `https://www.techno-as.com.ua,https://techno-as.com.ua,https://yarik547.github.io`.
4. Скопіюйте адресу воркера, напр. `https://techno-as-leads.<ваш-акаунт>.workers.dev`.

**Або через wrangler:** `npx wrangler deploy`, потім `npx wrangler secret put TG_TOKEN` і `npx wrangler secret put TG_CHAT_ID`.

## 3. Сайт

У файлі `config.js` на сайті (і в корені репозиторію для GitHub Pages, і в `dist/`) вкажіть адресу:

```js
window.TA_FORM_ENDPOINT = 'https://techno-as-leads.<ваш-акаунт>.workers.dev';
```

Після цього обидві форми (у першому екрані й у контактах) шлють заявки в Telegram. Якщо надіслати не вдасться, сайт покаже телефон і месенджери.
