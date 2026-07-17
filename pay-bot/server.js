'use strict';

/*
 * pay-bot — крошечный релей заявок на оплату курса в Telegram-группу.
 *
 * Принимает POST /mastering-ai/api/pay-lead с JSON { tariff, price, contact }
 * и отправляет сообщение в группу через Telegram Bot API.
 *
 * Секреты берутся ТОЛЬКО из окружения (файл .env на сервере, не в репозитории
 * и не во фронтенде):
 *   BOT_TOKEN   — токен бота от @BotFather
 *   CHAT_ID     — id группы, куда слать заявки (обычно отрицательное число)
 *   PORT        — порт (по умолчанию 4332)
 */

const http = require('node:http');
const https = require('node:https');
const tls = require('node:tls');

const PORT = Number(process.env.PORT) || 4332;
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const CHAT_ID = process.env.CHAT_ID || '';
// Сервер в РФ, api.telegram.org напрямую недоступен -> ходим через HTTP-прокси.
// Формат: http://user:pass@host:port (задаётся в .env, в репозиторий не попадает).
const PROXY_URL = process.env.PROXY_URL || '';
const PATHNAME = '/mastering-ai/api/pay-lead';
const TG_HOST = 'api.telegram.org';

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('[pay-bot] BOT_TOKEN и CHAT_ID обязательны (задайте в .env). Выхожу.');
  process.exit(1);
}

// Известные тарифы — чужие значения не пропускаем, чтобы группу не засоряли.
const TARIFFS = {
  lite: 'Лайт — 4 900 ₽',
  review: 'Курс + разбор — 14 900 ₽',
};

const MAX_BODY = 4 * 1024; // 4 КБ на запрос — заявка крошечная
const MAX_CONTACT = 128;

// Простой per-IP лимит: не больше 5 заявок за 10 минут (антиспам).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map(); // ip -> number[] (timestamps)

function rateLimited(ip, now) {
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > MAX_PER_WINDOW;
}

// периодическая чистка карты, чтобы не росла бесконечно
setInterval(() => {
  const now = Date.now();
  for (const [ip, arr] of hits) {
    const fresh = arr.filter((t) => now - t < WINDOW_MS);
    if (fresh.length) hits.set(ip, fresh);
    else hits.delete(ip);
  }
}, WINDOW_MS).unref();

function sanitize(str, max) {
  return String(str == null ? '' : str)
    .replace(/[\x00-\x1F\x7F]+/g, ' ') // управляющие символы и переносы строк -> пробел
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// обёртка над ответом Telegram: логируем не-200 и резолвим true/false
function readTelegramResponse(res, resolve) {
  let body = '';
  res.on('data', (c) => (body += c));
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error('[pay-bot] Telegram ответил', res.statusCode, body.slice(0, 300));
    }
    resolve(res.statusCode === 200);
  });
}

// Прямой запрос (используется локально / без прокси).
function postDirect(path, payload, resolve) {
  const req = https.request(
    {
      method: 'POST',
      hostname: TG_HOST,
      path,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 8000,
    },
    (res) => readTelegramResponse(res, resolve)
  );
  req.on('timeout', () => req.destroy(new Error('timeout')));
  req.on('error', (e) => { console.error('[pay-bot] ошибка запроса к Telegram:', e.message); resolve(false); });
  req.write(payload);
  req.end();
}

// Запрос через HTTP-прокси: CONNECT-туннель -> TLS поверх него -> HTTPS.
function postViaProxy(path, payload, resolve) {
  let proxy;
  try { proxy = new URL(PROXY_URL); } catch { console.error('[pay-bot] некорректный PROXY_URL'); return resolve(false); }

  const headers = {};
  if (proxy.username) {
    const creds = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`;
    headers['Proxy-Authorization'] = 'Basic ' + Buffer.from(creds).toString('base64');
  }

  const connectReq = http.request({
    host: proxy.hostname,
    port: Number(proxy.port) || 80,
    method: 'CONNECT',
    path: `${TG_HOST}:443`,
    headers,
    timeout: 8000,
  });

  connectReq.on('connect', (res, socket) => {
    if (res.statusCode !== 200) {
      console.error('[pay-bot] прокси CONNECT вернул', res.statusCode);
      socket.destroy();
      return resolve(false);
    }
    const tgReq = https.request(
      {
        method: 'POST',
        hostname: TG_HOST,
        port: 443,
        path,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout: 8000,
        agent: false,
        createConnection: () => tls.connect({ host: TG_HOST, servername: TG_HOST, socket }),
      },
      (r) => readTelegramResponse(r, resolve)
    );
    tgReq.on('timeout', () => tgReq.destroy(new Error('timeout')));
    tgReq.on('error', (e) => { console.error('[pay-bot] ошибка запроса к Telegram (proxy):', e.message); resolve(false); });
    tgReq.write(payload);
    tgReq.end();
  });
  connectReq.on('timeout', () => connectReq.destroy(new Error('proxy timeout')));
  connectReq.on('error', (e) => { console.error('[pay-bot] ошибка прокси:', e.message); resolve(false); });
  connectReq.end();
}

function sendToTelegram(text) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ chat_id: CHAT_ID, text, disable_web_page_preview: true });
    const path = `/bot${BOT_TOKEN}/sendMessage`;
    if (PROXY_URL) postViaProxy(path, payload, resolve);
    else postDirect(path, payload, resolve);
  });
}

const server = http.createServer((req, res) => {
  const send = (code, obj) => {
    const data = JSON.stringify(obj || {});
    res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
    res.end(data);
  };

  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== PATHNAME) return send(404, { ok: false });
  if (req.method !== 'POST') return send(405, { ok: false });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';
  if (rateLimited(ip, Date.now())) return send(429, { ok: false, error: 'too_many' });

  let body = '';
  let tooBig = false;
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > MAX_BODY) { tooBig = true; req.destroy(); }
  });
  req.on('end', async () => {
    if (tooBig) return send(413, { ok: false });

    let data;
    try { data = JSON.parse(body); } catch { return send(400, { ok: false, error: 'bad_json' }); }

    const contact = sanitize(data.contact, MAX_CONTACT);
    if (contact.length < 2) return send(400, { ok: false, error: 'no_contact' });

    // название тарифа берём из белого списка; неизвестный ключ — из запроса, но обрезанный
    const tariffLabel = TARIFFS[data.tariff] || sanitize(data.tariff, 64) || '—';

    const text =
      '🧾 Новая заявка на оплату курса\n' +
      `Тариф: ${tariffLabel}\n` +
      `Контакт: ${contact}`;

    const ok = await sendToTelegram(text);
    // фронтенд не должен блокироваться: всегда отвечаем без деталей
    return send(ok ? 200 : 502, { ok });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[pay-bot] слушаю 127.0.0.1:${PORT}${PATHNAME}`);
});
