/**
 * reveal-words.js
 *
 * Word-by-word text reveal animation for paragraphs.
 * Each word fades in with translateY + blur in a staggered sequence,
 * triggered when the paragraph enters the viewport.
 *
 * Usage: Add `data-reveal-words` to any <p> element.
 * Options (via data attributes):
 *   data-reveal-words-delay="150"    — initial delay in ms (default: 100)
 *   data-reveal-words-stagger="40"   — delay between words in ms (default: 35)
 */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const revealEntries = [];

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          animateWords(entry.target);
        }
      });
    },
    {
      threshold: 0.2,
      rootMargin: '0px 0px -60px 0px',
    }
  );

  /**
   * Split element text into individual word spans.
   */
  function splitIntoWords(el) {
    const originalText = el.dataset.revealWordsOriginal || el.textContent;
    el.dataset.revealWordsOriginal = originalText;

    const words = originalText.trim().split(/\s+/);
    if (words.length === 0) return;

    el.innerHTML = '';

    const frag = document.createDocumentFragment();

    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'reveal-word';
      span.textContent = word;
      span.style.setProperty('--word-index', i);
      frag.appendChild(span);

      // Add a text node for the space between words
      if (i < words.length - 1) {
        frag.appendChild(document.createTextNode(' '));
      }
    });

    el.appendChild(frag);
  }

  /**
   * Trigger staggered word reveal.
   */
  function animateWords(el) {
    const wordSpans = el.querySelectorAll('.reveal-word');
    const delay = parseInt(el.dataset.revealWordsDelay || '100', 10);
    const stagger = parseInt(el.dataset.revealWordsStagger || '35', 10);

    if (prefersReducedMotion.matches) {
      wordSpans.forEach((span) => span.classList.add('revealed'));
      el.dataset.revealWordsDone = 'true';
      return;
    }

    wordSpans.forEach((span, index) => {
      setTimeout(() => {
        span.classList.add('revealed');
      }, delay + index * stagger);
    });

    el.dataset.revealWordsDone = 'true';
  }

  /**
   * Initialize a single element.
   */
  function initElement(el) {
    splitIntoWords(el);
    revealEntries.push(el);

    if (prefersReducedMotion.matches) {
      el.querySelectorAll('.reveal-word').forEach((s) => s.classList.add('revealed'));
      el.dataset.revealWordsDone = 'true';
      return;
    }

    observer.observe(el);
  }

  /**
   * Recalculate on resize for elements not yet revealed.
   */
  function handleResize() {
    revealEntries.forEach((el) => {
      if (el.dataset.revealWordsDone === 'true') return;
      observer.unobserve(el);
      splitIntoWords(el);
      observer.observe(el);
    });
  }

  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function init() {
    const elements = document.querySelectorAll('[data-reveal-words]');
    elements.forEach(initElement);

    window.addEventListener('resize', debounce(handleResize, 250));

    prefersReducedMotion.addEventListener('change', () => {
      if (prefersReducedMotion.matches) {
        revealEntries.forEach((el) => {
          el.querySelectorAll('.reveal-word').forEach((s) => s.classList.add('revealed'));
          el.dataset.revealWordsDone = 'true';
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
