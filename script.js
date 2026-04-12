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

  // ─── Floating particles ──────────────────────────────────────
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!prefersReducedMotion) {
    const particlesContainer = document.querySelector('.particles');
    if (particlesContainer) {
      const count = 40;
      for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDuration = (12 + Math.random() * 20) + 's';
        p.style.animationDelay = -(Math.random() * 30) + 's';
        p.style.width = p.style.height = (1 + Math.random() * 2) + 'px';
        particlesContainer.appendChild(p);
      }
    }
  }

  // ─── Scroll reveal animations ────────────────────────────────
  if (!prefersReducedMotion) {
    const revealElements = document.querySelectorAll('.reveal, .reveal-scale');

    const observer = new IntersectionObserver(
      (entries) => {
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
  } else {
    document.querySelectorAll('.reveal, .reveal-scale').forEach(el => {
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
