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
   * Recursively split text nodes into word spans while preserving HTML structure.
   */
  function splitNode(node, container, wordCounter) {
    if (node.nodeType === Node.TEXT_NODE) {
      const parts = node.textContent.split(/(\s+)/);
      parts.forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          container.appendChild(document.createTextNode(part));
        } else {
          const span = document.createElement('span');
          span.className = 'reveal-word';
          span.textContent = part;
          span.style.setProperty('--word-index', wordCounter.count++);
          container.appendChild(span);
        }
      });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const clone = node.cloneNode(false);
      Array.from(node.childNodes).forEach((child) => {
        splitNode(child, clone, wordCounter);
      });
      container.appendChild(clone);
    }
  }

  /**
   * Split element text into individual word spans while preserving HTML tags (e.g. <strong>).
   */
  function splitIntoWords(el) {
    if (!el.dataset.revealWordsOriginalHtml) {
      el.dataset.revealWordsOriginalHtml = el.innerHTML;
    } else {
      el.innerHTML = el.dataset.revealWordsOriginalHtml;
    }

    const frag = document.createDocumentFragment();
    const wordCounter = { count: 0 };
    Array.from(el.childNodes).forEach((child) => {
      splitNode(child, frag, wordCounter);
    });

    el.innerHTML = '';
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
