/**
 * DOM Analysis utility functions for scraping interactive page elements
 */

export function getInteractiveElements(root = document) {
  const elements = [];
  let count = 0;
  const MAX_ELEMENTS = 120;

  function collectInteractive(node) {
    if (count >= MAX_ELEMENTS) return;

    // We look for tags that are typically interactive
    const selectables = node.querySelectorAll('input, textarea, button, a, [role="button"]');
    
    for (const el of selectables) {
      if (count >= MAX_ELEMENTS) break;

      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);

      // Filter out zero-dimension or hidden elements
      if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        continue;
      }

      // Filter out off-screen accessibility/screen-reader elements
      if (rect.left < -100 || rect.top < -100) {
        continue;
      }

      const tag = el.tagName.toLowerCase();
      const id = el.getAttribute('id') || '';
      const name = el.getAttribute('name') || '';
      const placeholder = el.getAttribute('placeholder') || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const title = el.getAttribute('title') || '';
      const text = el.innerText ? el.innerText.trim().replace(/\n/g, ' ') : '';

      // Ignore accessibility skip links
      const lowerText = text.toLowerCase();
      if (lowerText.includes('skip navigation') || lowerText.includes('skip to') || lowerText.includes('jump to')) {
        continue;
      }

      let selector = tag;

      // Prioritize unique or readable selectors
      if ((tag === 'input' || tag === 'textarea') && id) {
        selector = `${tag}#${id}`;
      } else if ((tag === 'input' || tag === 'textarea') && name) {
        selector = `${tag}[name="${name}"]`;
      } else if (tag === 'a' && text) {
        const cleanedText = text.replace(/["']/g, '').substring(0, 45).trim();
        selector = `a:has-text("${cleanedText}")`;
      } else if (id) {
        if (tag === 'button') {
          selector = `${tag}#${id}`;
        } else {
          selector = `#${id}`;
        }
      } else if (name) {
        selector = `${tag}[name="${name}"]`;
      } else if (ariaLabel) {
        selector = `${tag}[aria-label="${ariaLabel.replace(/"/g, '\\"')}"]`;
      } else if (title) {
        selector = `${tag}[title="${title.replace(/"/g, '\\"')}"]`;
      } else if (tag === 'button' && text) {
        const cleanedText = text.replace(/["']/g, '').substring(0, 45).trim();
        selector = `button:has-text("${cleanedText}")`;
      } else if (el.className) {
        const firstClass = el.className.trim().split(/\s+/)[0];
        if (firstClass && !firstClass.includes(':')) {
          selector = `${tag}.${firstClass}`;
        }
      }

      // Ignore completely generic selectors (e.g. bare "a" or "button")
      if (selector === 'a' || selector === 'button' || selector === 'div' || selector === 'span') {
        continue;
      }

      let desc = tag.toUpperCase();
      if (id) desc += ` id="${id}"`;
      if (name) desc += ` name="${name}"`;
      if (placeholder) desc += ` placeholder="${placeholder}"`;
      if (ariaLabel) desc += ` aria-label="${ariaLabel}"`;
      if (title) desc += ` title="${title}"`;
      if (text) desc += ` text="${text.substring(0, 50)}"`;

      if (!elements.some(e => e.selector === selector)) {
        elements.push({
          selector: selector,
          description: desc
        });
        count++;
      }
    }

    // Traverse all nested shadow roots recursively
    const allElements = node.querySelectorAll('*');
    for (const el of allElements) {
      if (el.shadowRoot) {
        collectInteractive(el.shadowRoot);
      }
    }
  }

  collectInteractive(root);
  return elements;
}
