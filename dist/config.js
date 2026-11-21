// Адреса обробника форми (POST JSON: name, phone, service, note, page), напр. Cloudflare Worker з папки telegram-worker.
// Порожньо — заявка відкриється листом на tehno.as.lviv@gmail.com.
window.TA_FORM_ENDPOINT = '';

// Жива генерація станції: адреса, що віддає JSON {"power_kw": 4.2, "today_kwh": 18.5, "place": "Львів"}. Порожньо — блок прихований.
window.TA_LIVE_ENDPOINT = '';

// Інженер IS: 'always' — завжди видно, 'tips' — з’являється, коли є нова порада, 'off' — вимкнено.
window.TA_MASCOT_MODE = 'always';
