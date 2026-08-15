/**
 * reveal-text.js
 * 
 * Text reveal animation — line-by-line entrance with blur, opacity, and translateY.
 * Inspired by antigravity.google.
 * 
 * Usage: Add `data-reveal` to any element (h1, h2, h3, p, etc.)
 * Options (via data attributes):
 *   data-reveal-delay="200"    — initial delay in ms before the first line animates
 *   data-reveal-stagger="80"   — delay between consecutive lines in ms (default: 80)
 */

(function () {
  'use strict';

  // Respect reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Store references for resize recalculation
  const revealEntries = [];

  // Single IntersectionObserver for all reveal blocks
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          observer.unobserve(el);
          animateReveal(el);
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: '0px 0px -40px 0px',
    }
  );

  /**
   * Split an element's text content into visual lines.
   * Works by wrapping each word in a temporary span,
   * then grouping words that share the same offsetTop.
   */
  function splitIntoLines(el) {
    // Get the original text (preserve it for re-splits)
    const originalText = el.dataset.revealOriginal || el.textContent;
    el.dataset.revealOriginal = originalText;

    // Temporarily reset element to plain text for measurement
    el.innerHTML = '';
    el.style.visibility = 'hidden';

    const words = originalText.trim().split(/\s+/);
    if (words.length === 0) return [];

    // Create temporary word spans for measurement
    const wordSpans = words.map((word) => {
      const span = document.createElement('span');
      span.style.display = 'inline';
      span.style.whiteSpace = 'pre'; // preserve single spaces
      span.textContent = word + ' ';
      return span;
    });

    // Append all word spans to measure positions
    const frag = document.createDocumentFragment();
    wordSpans.forEach((s) => frag.appendChild(s));
    el.appendChild(frag);

    // Group words by their visual line (same offsetTop)
    const lines = [];
    let currentLine = [];
    let currentTop = wordSpans[0].offsetTop;

    wordSpans.forEach((span, i) => {
      const top = span.offsetTop;
      if (Math.abs(top - currentTop) > 2) {
        // New line detected
        lines.push(currentLine.map((s) => s.textContent).join('').trim());
        currentLine = [span];
        currentTop = top;
      } else {
        currentLine.push(span);
      }
    });

    // Push last line
    if (currentLine.length > 0) {
      lines.push(currentLine.map((s) => s.textContent).join('').trim());
    }

    return lines;
  }

  /**
   * Build the reveal DOM structure for an element.
   * Each line is wrapped in:
   *   <span class="reveal-line">
   *     <span class="reveal-line__inner">...line text...</span>
   *   </span>
   */
  function buildRevealDOM(el, lines) {
    el.innerHTML = '';

    lines.forEach((lineText) => {
      const outer = document.createElement('span');
      outer.className = 'reveal-line';

      const inner = document.createElement('span');
      inner.className = 'reveal-line__inner';
      inner.textContent = lineText;

      outer.appendChild(inner);
      el.appendChild(outer);
    });

    el.style.visibility = '';
  }

  /**
   * Trigger the staggered reveal animation for an element.
   */
  function animateReveal(el) {
    const innerSpans = el.querySelectorAll('.reveal-line__inner');
    const delay = parseInt(el.dataset.revealDelay || '0', 10);
    const stagger = parseInt(el.dataset.revealStagger || '80', 10);

    if (prefersReducedMotion.matches) {
      // Show immediately without animation
      innerSpans.forEach((span) => span.classList.add('revealed'));
      el.dataset.revealDone = 'true';
      return;
    }

    innerSpans.forEach((span, index) => {
      setTimeout(() => {
        span.classList.add('revealed');
      }, delay + index * stagger);
    });

    el.dataset.revealDone = 'true';
  }

  /**
   * Initialize a single reveal element: split, build DOM, observe.
   */
  function initRevealElement(el) {
    const lines = splitIntoLines(el);

    if (lines.length === 0) {
      el.style.visibility = '';
      return;
    }

    buildRevealDOM(el, lines);

    // Store for resize recalculation
    revealEntries.push(el);

    // If reduced motion, show immediately
    if (prefersReducedMotion.matches) {
      el.querySelectorAll('.reveal-line__inner').forEach((s) =>
        s.classList.add('revealed')
      );
      el.dataset.revealDone = 'true';
      return;
    }

    // Observe for viewport entry
    observer.observe(el);
  }

  /**
   * Recalculate line splits on resize (debounced).
   * Only recalculates elements that have NOT been revealed yet.
   */
  function handleResize() {
    revealEntries.forEach((el) => {
      if (el.dataset.revealDone === 'true') return;

      // Unobserve during rebuild
      observer.unobserve(el);

      const lines = splitIntoLines(el);
      if (lines.length > 0) {
        buildRevealDOM(el, lines);
      } else {
        el.style.visibility = '';
      }

      // Re-observe
      observer.observe(el);
    });
  }

  // Debounce utility
  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  /**
   * Main initialization
   */
  function init() {
    const elements = document.querySelectorAll('[data-reveal]');
    elements.forEach(initRevealElement);

    // Recalculate on resize
    window.addEventListener('resize', debounce(handleResize, 250));

    // Re-check if reduced motion preference changes
    prefersReducedMotion.addEventListener('change', () => {
      if (prefersReducedMotion.matches) {
        revealEntries.forEach((el) => {
          el.querySelectorAll('.reveal-line__inner').forEach((s) =>
            s.classList.add('revealed')
          );
          el.dataset.revealDone = 'true';
        });
      }
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
