(() => {
  'use strict';

  // ─── Navbar scroll effect ────────────────────────────────────
  const navbar = document.querySelector('.navbar');
  let ticking = false;

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── Arcane mist — cyan smoke + ember sparks rise from below ──
  (function () {
    const cv = document.getElementById('bg-smoke');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let parts = [], raf = null, W = 0, H = 0, pointer = { x: -1e3, y: -1e3 };
    const N = prefersReducedMotion ? 0 : 80;
    const dpr = window.devicePixelRatio || 1;
    // два тона: холодный циан (дым) и янтарь (искры)
    const CYAN = '95,217,228', EMBER = '255,158,74';
    function resize() { W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr; }
    function spawn() {
      const ember = Math.random() < 0.35;
      return {
        x: Math.random() * W, y: H + Math.random() * H * 0.3,
        vx: (Math.random() - 0.5) * 0.2 * dpr, vy: -(0.2 + Math.random() * 0.5) * dpr,
        r: (ember ? 20 + Math.random() * 50 : 40 + Math.random() * 90) * dpr,
        a: 0, max: 0.06 + Math.random() * 0.10,
        life: 0, ttl: 500 + Math.random() * 500,
        c: ember ? EMBER : CYAN
      };
    }
    function step() {
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.life++;
        const dx = p.x - pointer.x, dy = p.y - pointer.y, d2 = dx * dx + dy * dy, R = 160 * dpr;
        if (d2 < R * R) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 2.2; p.vx += dx / d * f; p.vy += dy / d * f; }
        p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy = p.vy * 0.98 - 0.02 * dpr; p.r += 0.25 * dpr;
        p.a = p.life < 60 ? p.a + 0.002 : p.a - 0.0006; p.a = Math.max(0, Math.min(p.max, p.a));
        if (p.y < -p.r || p.life > p.ttl || (p.a <= 0 && p.life > 80)) Object.assign(p, spawn());
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(${p.c},${p.a})`); g.addColorStop(1, `rgba(${p.c},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      }
      raf = requestAnimationFrame(step);
    }
    addEventListener('resize', resize);
    addEventListener('pointermove', e => { pointer.x = e.clientX * dpr; pointer.y = e.clientY * dpr; });
    if (N > 0) { resize(); parts = Array.from({ length: N }, spawn); step(); }
  })();

  // ─── Scroll reveal animations ────────────────────────────────
  const revealElements = document.querySelectorAll('.reveal, .reveal-scale');

  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    let observerFired = false;

    const observer = new IntersectionObserver(
      (entries) => {
        observerFired = true;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -60px 0px',
      }
    );

    revealElements.forEach(el => observer.observe(el));

    // страховка: если observer молчит (сломан/заблокирован) — показываем всё
    setTimeout(() => {
      if (!observerFired) {
        observer.disconnect();
        revealElements.forEach(el => el.classList.add('visible'));
      }
    }, 800);
  } else {
    revealElements.forEach(el => el.classList.add('visible'));
  }

  // ─── Smooth scroll for anchor links ──────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // ─── PDF modal (презентация Anima Poker) ─────────────────────
  (function () {
    const modal = document.getElementById('pdf-modal');
    if (!modal) return;
    const frame = modal.querySelector('.pdf-modal__frame');
    const pdfSrc = frame.dataset.pdfSrc;
    // мобильные браузеры не рендерят PDF в iframe — открываем в новой вкладке
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    function open() {
      if (isMobile) { window.open(pdfSrc, '_blank', 'noopener'); return; }
      if (!frame.src) frame.src = pdfSrc; // 12 МБ — грузим только по клику
      modal.hidden = false;
      document.body.classList.add('modal-open');
    }

    function close() {
      modal.hidden = true;
      document.body.classList.remove('modal-open');
    }

    document.querySelectorAll('.js-open-pdf').forEach(btn => btn.addEventListener('click', open));
    modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) close();
    });
  })();

  // ─── Image lightbox (скриншоты Emberhold) ────────────────────
  (function () {
    const box = document.getElementById('img-lightbox');
    if (!box) return;
    const img = box.querySelector('.img-lightbox__img');

    function open(src, alt) {
      img.src = src;
      img.alt = alt || '';
      box.hidden = false;
      document.body.classList.add('modal-open');
    }

    function close() {
      box.hidden = true;
      document.body.classList.remove('modal-open');
      img.src = '';
    }

    document.querySelectorAll('.js-lightbox').forEach(btn => {
      btn.addEventListener('click', () => {
        const thumb = btn.querySelector('img');
        open(btn.dataset.full, thumb ? thumb.alt : '');
      });
    });
    box.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !box.hidden) close();
    });
  })();

  // ─── Buy modal (оформление и оплата тарифа курса) ────────────
  (function () {
    const modal = document.getElementById('buy-modal');
    if (!modal) return;

    const TARIFFS = {
      lite: {
        name: 'Лайт',
        price: '4 900 ₽',
        includes: ['Запись курса — 12 уроков', 'Методичка с промптами и чек-листами'],
      },
      review: {
        name: 'Курс + разбор',
        price: '14 900 ₽',
        includes: [
          'Всё из тарифа Лайт',
          '45 минут личного разбора со мной — результаты и вопросы',
          'Разберём именно ваш сайт и ваши затыки',
        ],
      },
    };

    const stepForm = modal.querySelector('[data-step="form"]');
    const stepPay = modal.querySelector('[data-step="pay"]');
    const nameEl = modal.querySelector('[data-tariff-name]');
    const priceEl = modal.querySelector('[data-tariff-price]');
    const priceInline = modal.querySelector('[data-tariff-price-inline]');
    const includesEl = modal.querySelector('[data-tariff-includes]');
    const tgInput = modal.querySelector('#buy-tg');
    const consent = modal.querySelector('#buy-consent');
    const submit = modal.querySelector('.buy-submit');
    const errorEl = modal.querySelector('[data-error]');
    const tgEcho = modal.querySelector('[data-tg-echo]');

    function syncSubmit() {
      submit.disabled = !(tgInput.value.trim().length > 1 && consent.checked);
    }

    let currentKey = null;

    function open(key) {
      const t = TARIFFS[key];
      if (!t) return;
      currentKey = key;
      nameEl.textContent = t.name;
      priceEl.textContent = t.price;
      priceInline.textContent = t.price;
      includesEl.innerHTML = '';
      t.includes.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        includesEl.appendChild(li);
      });
      // сброс в шаг 1
      tgInput.value = '';
      consent.checked = false;
      errorEl.hidden = true;
      submit.disabled = true;
      stepPay.hidden = true;
      stepForm.hidden = false;
      modal.hidden = false;
      document.body.classList.add('modal-open');
    }

    function close() {
      modal.hidden = true;
      document.body.classList.remove('modal-open');
    }

    function notifyLead(tariff, contact) {
      // best-effort: заявка в Telegram-группу через серверный релей.
      // не блокируем показ оплаты — если бэкенд недоступен, просто игнорируем.
      try {
        fetch('/mastering-ai/api/pay-lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tariff, contact }),
          keepalive: true,
        }).catch(() => {});
      } catch (e) { /* no-op */ }
    }

    function toPayment() {
      const tg = tgInput.value.trim();
      if (tg.length <= 1) { errorEl.hidden = false; tgInput.focus(); return; }
      errorEl.hidden = true;
      notifyLead(currentKey, tg);
      tgEcho.textContent = tg;
      stepForm.hidden = true;
      stepPay.hidden = false;
      modal.querySelector('.buy-modal__panel').scrollTop = 0;
    }

    document.querySelectorAll('.js-buy').forEach(btn => {
      btn.addEventListener('click', () => open(btn.dataset.tariff));
    });
    tgInput.addEventListener('input', syncSubmit);
    consent.addEventListener('change', syncSubmit);
    submit.addEventListener('click', toPayment);
    modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) close();
    });
  })();
})();
