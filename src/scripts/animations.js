/**
 * animations.js
 *
 * Unified, coordinated animation system for LBC Certification.
 * Replaces reveal-text.js and reveal-words.js with an orchestrated
 * system that sequences elements within each section.
 *
 * Architecture:
 * - [data-animate-group]  → Container that triggers the animation cascade
 * - [data-reveal]         → Text split into visual lines (h1, h2, h3)
 * - [data-reveal-words]   → Text split into individual words (paragraphs)
 * - [data-animate]        → Generic animated element (cards, badges, buttons)
 *     values: "fade-up" | "fade-in" | "scale-in" | "slide-left" | "slide-right"
 * - [data-animate-order]  → Sequence order within a group (0, 1, 2...)
 * - [data-animate-stagger]→ On a parent: stagger delay (ms) between children
 * - [data-animate-delay]  → Extra delay (ms) added to this element
 *
 * The system collects all animatable children of a group, sorts them by
 * data-animate-order, and triggers them in a coordinated cascade.
 */

(function () {
  'use strict';

  // ─── Configuration ───────────────────────────────────────────────
  const BASE_STAGGER = 120;      // ms between order steps
  const CHILD_STAGGER = 80;     // default stagger between grid children
  const HERO_BASE_STAGGER = 180; // slower cascade for hero
  const OBSERVER_THRESHOLD = 0.1;
  const OBSERVER_MARGIN = '0px 0px -40px 0px';

  // ─── Respect reduced motion ──────────────────────────────────────
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ─── Storage for resize recalculation ────────────────────────────
  const textRevealEntries = [];

  // ═══════════════════════════════════════════════════════════════════
  //  TEXT SPLITTING UTILITIES (from original reveal-text.js / reveal-words.js)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Split an element's text content into visual lines.
   */
  function splitIntoLines(el) {
    const originalText = el.dataset.revealOriginal || el.textContent;
    el.dataset.revealOriginal = originalText;

    el.innerHTML = '';
    el.style.visibility = 'hidden';

    const words = originalText.trim().split(/\s+/);
    if (words.length === 0) return [];

    const wordSpans = words.map((word) => {
      const span = document.createElement('span');
      span.style.display = 'inline';
      span.style.whiteSpace = 'pre';
      span.textContent = word + ' ';
      return span;
    });

    const frag = document.createDocumentFragment();
    wordSpans.forEach((s) => frag.appendChild(s));
    el.appendChild(frag);

    const lines = [];
    let currentLine = [];
    let currentTop = wordSpans[0].offsetTop;

    wordSpans.forEach((span) => {
      const top = span.offsetTop;
      if (Math.abs(top - currentTop) > 2) {
        lines.push(currentLine.map((s) => s.textContent).join('').trim());
        currentLine = [span];
        currentTop = top;
      } else {
        currentLine.push(span);
      }
    });

    if (currentLine.length > 0) {
      lines.push(currentLine.map((s) => s.textContent).join('').trim());
    }

    return lines;
  }

  /**
   * Build the reveal DOM structure for line-split elements.
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
   * Recursively split text nodes into word spans while preserving HTML.
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
   * Split element into individual word spans preserving HTML tags.
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

  // ═══════════════════════════════════════════════════════════════════
  //  PREPARE ELEMENTS (split text, add CSS classes)
  // ═══════════════════════════════════════════════════════════════════

  function prepareRevealText(el) {
    const lines = splitIntoLines(el);
    if (lines.length === 0) {
      el.style.visibility = '';
      return;
    }
    buildRevealDOM(el, lines);
    textRevealEntries.push({ el, type: 'lines' });
  }

  function prepareRevealWords(el) {
    splitIntoWords(el);
    textRevealEntries.push({ el, type: 'words' });
  }

  function prepareAnimateElement(el) {
    const type = el.dataset.animate;
    const cssClass = 'anim-' + type;
    if (!el.classList.contains(cssClass)) {
      el.classList.add(cssClass);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  REVEAL FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════

  function revealTextLines(el, baseDelay) {
    const innerSpans = el.querySelectorAll('.reveal-line__inner');
    const stagger = parseInt(el.dataset.revealStagger || '70', 10);

    if (prefersReducedMotion.matches) {
      innerSpans.forEach((s) => s.classList.add('revealed'));
      el.dataset.revealDone = 'true';
      return;
    }

    innerSpans.forEach((span, index) => {
      setTimeout(() => {
        span.classList.add('revealed');
      }, baseDelay + index * stagger);
    });

    el.dataset.revealDone = 'true';
  }

  function revealWords(el, baseDelay) {
    const wordSpans = el.querySelectorAll('.reveal-word');
    const stagger = parseInt(el.dataset.revealWordsStagger || '30', 10);

    if (prefersReducedMotion.matches) {
      wordSpans.forEach((s) => s.classList.add('revealed'));
      el.dataset.revealWordsDone = 'true';
      return;
    }

    wordSpans.forEach((span, index) => {
      setTimeout(() => {
        span.classList.add('revealed');
      }, baseDelay + index * stagger);
    });

    el.dataset.revealWordsDone = 'true';
  }

  function revealAnimateElement(el, baseDelay) {
    if (prefersReducedMotion.matches) {
      el.classList.add('revealed');
      return;
    }

    setTimeout(() => {
      el.classList.add('revealed');
    }, baseDelay);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  GROUP ORCHESTRATION
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Collect all animatable children within a group, ordered by
   * data-animate-order. Elements without an order get Infinity (last).
   */
  function collectAnimatables(group) {
    const children = group.querySelectorAll(
      '[data-reveal], [data-reveal-words], [data-animate]'
    );

    // Filter out elements that belong to a nested group
    const direct = Array.from(children).filter((child) => {
      return child.closest('[data-animate-group]') === group;
    });

    // Sort by order
    direct.sort((a, b) => {
      const orderA = parseInt(a.dataset.animateOrder ?? '999', 10);
      const orderB = parseInt(b.dataset.animateOrder ?? '999', 10);
      return orderA - orderB;
    });

    return direct;
  }

  /**
   * Animate an entire group in sequence.
   */
  function animateGroup(group) {
    const isHero = group.dataset.animateGroup === 'hero';
    const staggerBase = isHero ? HERO_BASE_STAGGER : BASE_STAGGER;

    const animatables = collectAnimatables(group);
    if (animatables.length === 0) return;

    // Group elements by their order value
    const orderGroups = new Map();
    animatables.forEach((el) => {
      const order = parseInt(el.dataset.animateOrder ?? '999', 10);
      if (!orderGroups.has(order)) orderGroups.set(order, []);
      orderGroups.get(order).push(el);
    });

    // Sort order keys
    const sortedOrders = Array.from(orderGroups.keys()).sort((a, b) => a - b);

    let cumulativeDelay = 0;

    sortedOrders.forEach((order, stepIndex) => {
      const elements = orderGroups.get(order);
      const stepDelay = stepIndex * staggerBase;

      elements.forEach((el) => {
        const extraDelay = parseInt(el.dataset.animateDelay || '0', 10);
        const totalDelay = stepDelay + extraDelay;

        // Check if this element is a stagger parent
        if (el.dataset.animateStagger !== undefined) {
          animateStaggerChildren(el, totalDelay);
        } else if (el.hasAttribute('data-reveal')) {
          revealTextLines(el, totalDelay);
        } else if (el.hasAttribute('data-reveal-words')) {
          revealWords(el, totalDelay);
        } else if (el.hasAttribute('data-animate')) {
          revealAnimateElement(el, totalDelay);
        }
      });
    });

    group.dataset.animateGroupDone = 'true';
  }

  /**
   * Animate stagger-parent's direct animated children with incremental delay.
   */
  function animateStaggerChildren(parent, parentDelay) {
    const stagger = parseInt(parent.dataset.animateStagger || String(CHILD_STAGGER), 10);

    // Get direct animated children (that are inside this stagger parent)
    const children = parent.querySelectorAll('[data-animate]');
    const directChildren = Array.from(children).filter((child) => {
      // Must be a direct stagger child — not inside a nested stagger parent
      const closestStagger = child.closest('[data-animate-stagger]');
      return closestStagger === parent;
    });

    directChildren.forEach((child, index) => {
      const totalDelay = parentDelay + index * stagger;
      revealAnimateElement(child, totalDelay);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  STANDALONE ELEMENTS (not inside any group)
  // ═══════════════════════════════════════════════════════════════════

  const standaloneObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          standaloneObserver.unobserve(el);

          if (el.hasAttribute('data-reveal')) {
            revealTextLines(el, 0);
          } else if (el.hasAttribute('data-reveal-words')) {
            revealWords(el, 0);
          } else if (el.hasAttribute('data-animate')) {
            revealAnimateElement(el, 0);
          }
        }
      });
    },
    { threshold: OBSERVER_THRESHOLD, rootMargin: OBSERVER_MARGIN }
  );

  // ═══════════════════════════════════════════════════════════════════
  //  GROUP OBSERVER
  // ═══════════════════════════════════════════════════════════════════

  const groupObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const group = entry.target;
          groupObserver.unobserve(group);
          animateGroup(group);
        }
      });
    },
    { threshold: 0.05, rootMargin: '0px 0px -30px 0px' }
  );

  // ═══════════════════════════════════════════════════════════════════
  //  HEADER ENTRANCE (special: runs on page load, not on scroll)
  // ═══════════════════════════════════════════════════════════════════

  function animateHeader() {
    const header = document.querySelector('[data-animate-header]');
    if (!header) return;

    if (prefersReducedMotion.matches) {
      header.querySelectorAll('[data-animate]').forEach((el) => {
        el.classList.add('revealed');
      });
      return;
    }

    const elements = header.querySelectorAll('[data-animate]');
    elements.forEach((el, index) => {
      const delay = 100 + index * 60;
      setTimeout(() => {
        el.classList.add('revealed');
      }, delay);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  RESIZE HANDLER
  // ═══════════════════════════════════════════════════════════════════

  function handleResize() {
    textRevealEntries.forEach(({ el, type }) => {
      if (type === 'lines' && el.dataset.revealDone !== 'true') {
        const lines = splitIntoLines(el);
        if (lines.length > 0) {
          buildRevealDOM(el, lines);
        } else {
          el.style.visibility = '';
        }
      } else if (type === 'words' && el.dataset.revealWordsDone !== 'true') {
        splitIntoWords(el);
      }
    });
  }

  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════

  function init() {
    // 1. Prepare all text-split elements
    document.querySelectorAll('[data-reveal]').forEach(prepareRevealText);
    document.querySelectorAll('[data-reveal-words]').forEach(prepareRevealWords);
    document.querySelectorAll('[data-animate]').forEach(prepareAnimateElement);

    // 2. If reduced motion, reveal everything immediately
    if (prefersReducedMotion.matches) {
      document.querySelectorAll('.reveal-line__inner').forEach((s) =>
        s.classList.add('revealed')
      );
      document.querySelectorAll('.reveal-word').forEach((s) =>
        s.classList.add('revealed')
      );
      document.querySelectorAll('[data-animate]').forEach((s) =>
        s.classList.add('revealed')
      );
      return;
    }

    // 3. Observe groups
    document.querySelectorAll('[data-animate-group]').forEach((group) => {
      groupObserver.observe(group);
    });

    // 4. Observe standalone elements (not inside any group)
    const allAnimatables = document.querySelectorAll(
      '[data-reveal], [data-reveal-words], [data-animate]'
    );
    allAnimatables.forEach((el) => {
      // Skip if inside a group (group observer handles these)
      if (el.closest('[data-animate-group]')) return;
      // Skip header elements (handled separately)
      if (el.closest('[data-animate-header]')) return;
      standaloneObserver.observe(el);
    });

    // 5. Animate header on load
    animateHeader();

    // 6. Resize handler
    window.addEventListener('resize', debounce(handleResize, 250));

    // 7. Reduced motion change listener
    prefersReducedMotion.addEventListener('change', () => {
      if (prefersReducedMotion.matches) {
        document.querySelectorAll('.reveal-line__inner').forEach((s) =>
          s.classList.add('revealed')
        );
        document.querySelectorAll('.reveal-word').forEach((s) =>
          s.classList.add('revealed')
        );
        document.querySelectorAll('[data-animate]').forEach((s) =>
          s.classList.add('revealed')
        );
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
