(() => {
  'use strict';

  // ─── Language Switcher ───────────────────────────────────────
  const STORAGE_KEY = 'lang';
  let currentLang = localStorage.getItem(STORAGE_KEY) || 'en';

  function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);

    // Update all translatable elements
    document.querySelectorAll('[data-en]').forEach(el => {
      const text = el.getAttribute(`data-${lang}`);
      if (!text) return;

      // If the element has a child span with data-en, skip — the span handles itself
      if (el.querySelector('[data-en]')) return;

      // For elements with SVG/icon children, update the span child only
      const span = el.querySelector('span');
      if (span && el.querySelector('svg')) {
        span.textContent = text;
      } else {
        el.textContent = text;
      }
    });

    // Update HTML lang attribute
    document.documentElement.lang = lang === 'ru' ? 'ru' : 'en';

    // Update active state on toggle buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
  }

  // Bind language buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });

  // Apply saved language on load
  setLanguage(currentLang);

  // ─── Navbar Scroll Effect ────────────────────────────────────
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
  onScroll(); // Check initial state

  // ─── Scroll Fade-in Animations ───────────────────────────────
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!prefersReducedMotion) {
    const fadeElements = document.querySelectorAll('.fade-in-up');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, index) => {
          if (entry.isIntersecting) {
            // Stagger animation for siblings
            const delay = index * 100;
            setTimeout(() => {
              entry.target.classList.add('visible');
            }, delay);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    fadeElements.forEach(el => observer.observe(el));
  } else {
    // If reduced motion, show everything immediately
    document.querySelectorAll('.fade-in-up').forEach(el => {
      el.classList.add('visible');
    });
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
})();
