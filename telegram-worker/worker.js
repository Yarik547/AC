// Приймає заявку з форм сайту (POST JSON) і пересилає її в Telegram.
// Змінні середовища Cloudflare Worker:
//   TG_TOKEN        — токен бота від @BotFather (додати як Secret)
//   TG_CHAT_ID      — id чату або групи, куди слати заявки
//   ALLOWED_ORIGINS — сайти, з яких дозволено слати, через кому:
//                     https://www.techno-as.com.ua,https://yarik547.github.io

const clean = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const okOrigin = !allowed.length || allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': okOrigin && origin ? origin : (allowed[0] || '*'),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin'
    };
    const json = (body, status) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
    if (!okOrigin) return json({ ok: false, error: 'origin' }, 403);

    let d;
    try { d = await request.json(); } catch (e) { return json({ ok: false, error: 'json' }, 400); }
    if (d && d.website) return json({ ok: true }, 200); // пастка для ботів: поле, якого людина не бачить

    const phone = clean(d.phone, 40);
    if (phone.replace(/\D/g, '').length < 10) return json({ ok: false, error: 'phone' }, 400);
    const lines = [
      'Нова заявка з сайту Техно-АС',
      'Телефон: ' + phone,
      d.name ? 'Ім’я: ' + clean(d.name, 80) : '',
      d.service ? 'Що цікавить: ' + clean(d.service, 120) : '',
      d.note ? 'Коментар: ' + clean(d.note, 1000) : '',
      d.page ? 'Сторінка: ' + clean(d.page, 40) : ''
    ].filter(Boolean);

    const r = await fetch('https://api.telegram.org/bot' + env.TG_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text: lines.join('\n'), disable_web_page_preview: true })
    });
    return json({ ok: r.ok }, r.ok ? 200 : 502);
  }
};
