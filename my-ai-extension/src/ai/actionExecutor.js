/**
 * In-browser Page Actions Executor
 */

// Helper to query element crossing Shadow DOM boundaries
export function querySelectorIncludingShadows(selector, root = document) {
  // Try standard first
  const found = root.querySelector(selector);
  if (found) return found;

  // Traverse all shadow hosts
  const allNodes = root.querySelectorAll('*');
  for (const node of allNodes) {
    if (node.shadowRoot) {
      const nestedFound = querySelectorIncludingShadows(selector, node.shadowRoot);
      if (nestedFound) return nestedFound;
    }
  }
  return null;
}

// Helper to query all elements of a tag crossing Shadow DOM boundaries
export function queryAllIncludingShadows(tag, root = document) {
  let list = Array.from(root.querySelectorAll(tag));
  const allNodes = root.querySelectorAll('*');
  for (const node of allNodes) {
    if (node.shadowRoot) {
      list = list.concat(queryAllIncludingShadows(tag, node.shadowRoot));
    }
  }
  return list;
}

// Resolve custom selectors like a:has-text("Text") or standard CSS selectors
export function resolveSelector(selector, root = document) {
  if (!selector) return null;

  // Custom text-based matcher (supports double and single quotes)
  const hasTextMatch = selector.match(/^([a-zA-Z0-9\-]+):has-text\(['"](.+)['"]\)$/);
  if (hasTextMatch) {
    const tag = hasTextMatch[1];
    const text = hasTextMatch[2];
    
    const elements = queryAllIncludingShadows(tag, root);
    for (const el of elements) {
      const nodeText = el.textContent || el.innerText || '';
      if (nodeText.toLowerCase().includes(text.toLowerCase())) {
        return el;
      }
    }
    return null;
  }

  // Standard selectors crossing shadows
  return querySelectorIncludingShadows(selector, root);
}

// -----------------------------------
// EXECUTE ACTIONS DIRECTLY ON THE DOM
// -----------------------------------

export function clickElement(selector) {
  const el = resolveSelector(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);

  // Highlight the element briefly
  highlightElement(el);

  // Scroll into view
  try {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {}

  // Focus the element
  try {
    el.focus();
  } catch (e) {}

  // Dispatch mouse events to trigger framework listeners
  const mouseEvents = ['mousedown', 'mouseup', 'click'];
  mouseEvents.forEach(name => {
    try {
      const event = new MouseEvent(name, {
        bubbles: true,
        cancelable: true,
        view: window
      });
      el.dispatchEvent(event);
    } catch (e) {}
  });

  // Call the native click() method to trigger native browser actions (like <a> links)
  try {
    if (typeof el.click === 'function') {
      el.click();
    }
  } catch (e) {}

  return `Clicked: ${selector}`;
}

export function typeText(selector, text) {
  const el = resolveSelector(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);

  highlightElement(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  try {
    el.focus();
  } catch (e) {}

  // Fill the value
  el.value = text;

  // Dispatch events to trigger bindings in React/Vue/Angular
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));

  return `Typed "${text}" into: ${selector}`;
}

export function pressKey(key) {
  const el = document.activeElement || document.body;
  
  const eventInit = {
    key: key,
    code: key === 'Enter' ? 'Enter' : '',
    keyCode: key === 'Enter' ? 13 : 0,
    which: key === 'Enter' ? 13 : 0,
    bubbles: true,
    cancelable: true
  };

  el.dispatchEvent(new KeyboardEvent('keydown', eventInit));
  el.dispatchEvent(new KeyboardEvent('keypress', eventInit));
  el.dispatchEvent(new KeyboardEvent('keyup', eventInit));

  // If it's a form input and we press Enter, submit the form with proper events
  if (key === 'Enter' && el.tagName === 'INPUT' && el.form) {
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    const defaultAllowed = el.form.dispatchEvent(submitEvent);
    if (defaultAllowed) {
      try {
        el.form.submit();
      } catch (e) {}
    }
  }

  return `Pressed Key: ${key}`;
}

export function scrollDown() {
  window.scrollBy({
    top: window.innerHeight * 0.7,
    behavior: 'smooth'
  });
  return 'Scrolled down';
}

export function goBack() {
  window.history.back();
  return 'Navigated back';
}

// Highlight helper to show visual focus
function highlightElement(el) {
  const origOutline = el.style.outline;
  el.style.outline = '3px solid #ff4a5a';
  setTimeout(() => {
    el.style.outline = origOutline;
  }, 1000);
}
