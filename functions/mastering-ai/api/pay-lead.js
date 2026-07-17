// Cloudflare Pages Function: приём заявки на оплату курса и отправка в Telegram-канал.
// Выполняется в инфраструктуре Cloudflare (вне РФ) — api.telegram.org доступен напрямую.
//
// Секреты задаются в настройках Pages-проекта (Settings -> Variables and Secrets):
//   BOT_TOKEN — токен бота от @BotFather
//   CHAT_ID   — id канала/группы для заявок (например, -1003968370164)

const TARIFFS = {
  lite: 'Лайт — 4 900 ₽',
  review: 'Курс + разбор — 14 900 ₽',
};

const MAX_CONTACT = 128;

function sanitize(str, max) {
  return String(str == null ? '' : str)
    .replace(/[\x00-\x1F\x7F]+/g, ' ') // управляющие символы и переносы строк -> пробел
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function json(code, obj) {
  return new Response(JSON.stringify(obj), {
    status: code,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.BOT_TOKEN || !env.CHAT_ID) {
    console.error('[pay-lead] BOT_TOKEN/CHAT_ID не заданы в секретах проекта');
    return json(502, { ok: false });
  }

  let data;
  try { data = await request.json(); } catch { return json(400, { ok: false, error: 'bad_json' }); }

  const contact = sanitize(data.contact, MAX_CONTACT);
  if (contact.length < 2) return json(400, { ok: false, error: 'no_contact' });

  // название тарифа берём из белого списка; неизвестный ключ — из запроса, но обрезанный
  const tariffLabel = TARIFFS[data.tariff] || sanitize(data.tariff, 64) || '—';

  const text =
    '🧾 Новая заявка на оплату курса\n' +
    `Тариф: ${tariffLabel}\n` +
    `Контакт: ${contact}`;

  try {
    const tg = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.CHAT_ID, text, disable_web_page_preview: true }),
    });
    if (!tg.ok) {
      console.error('[pay-lead] Telegram ответил', tg.status, (await tg.text()).slice(0, 300));
      return json(502, { ok: false });
    }
    return json(200, { ok: true });
  } catch (e) {
    console.error('[pay-lead] ошибка запроса к Telegram:', e.message);
    return json(502, { ok: false });
  }
}

// вызывается только для методов без своего обработчика (все, кроме POST)
export function onRequest() {
  return json(405, { ok: false });
}
