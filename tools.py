from playwright.sync_api import sync_playwright


class BrowserTools:

    def __init__(self):

        import os
        import tempfile
        import uuid

        profile_dir = os.path.join(tempfile.gettempdir(), f"playwright_profile_{uuid.uuid4().hex}")

        self.playwright = sync_playwright().start()

        # Load configuration from environment variables (useful for cloud deployments)
        headless = os.getenv("PLAYWRIGHT_HEADLESS", "False").lower() in ("true", "1", "yes")
        channel = os.getenv("PLAYWRIGHT_CHANNEL", "chrome")
        if headless and channel == "chrome":
            # Default to standard chromium in headless cloud environments
            channel = None

        self.browser = (
            self.playwright.chromium.launch_persistent_context(

                user_data_dir=profile_dir,

                headless=headless,

                channel=channel
            )
        )

        self.page = self.browser.pages[0]

    # -----------------------------------
    # OPEN WEBSITE
    # -----------------------------------

    def open_website(self, url):

        self.page.goto(url)

        self.page.wait_for_load_state(
            "domcontentloaded"
        )

        self.page.wait_for_timeout(3000)

        print(f"\nOpened Website: {url}")

    # -----------------------------------
    # TYPE TEXT
    # -----------------------------------

    def type_text(self, selector, text):

        self.page.wait_for_selector(
            selector,
            timeout=5000
        )

        self.page.fill(selector, text, timeout=5000)

        print(f"\nTyped: {text}")

    # -----------------------------------
    # PRESS KEY
    # -----------------------------------

    def press_key(self, key):

        self.page.keyboard.press(key)

        self.page.wait_for_timeout(3000)

        print(f"\nPressed Key: {key}")

    # -----------------------------------
    # CLICK ELEMENT
    # -----------------------------------

    def click_element(self, selector):

        self.page.wait_for_selector(
            selector,
            timeout=5000
        )

        self.page.locator(
            selector
        ).first.click(timeout=5000)

        self.page.wait_for_timeout(3000)

        print(f"\nClicked: {selector}")

    # -----------------------------------
    # SCROLL DOWN
    # -----------------------------------

    def scroll_down(self):

        self.page.mouse.wheel(0, 3000)

        self.page.wait_for_timeout(2000)

        print("\nScrolled Down")

    # -----------------------------------
    # GO BACK
    # -----------------------------------

    def go_back(self):

        self.page.go_back()

        self.page.wait_for_load_state(
            "domcontentloaded"
        )

        self.page.wait_for_timeout(3000)

        print("\nNavigated Back")

    # -----------------------------------
    # GET PAGE TITLE
    # -----------------------------------

    def get_title(self):

        title = self.page.title()

        return title

    # -----------------------------------
    # TAKE SCREENSHOT
    # -----------------------------------

    def take_screenshot(self, name="screenshot.png"):

        self.page.screenshot(path=name)

        print(f"\nScreenshot saved: {name}")

    # -----------------------------------
    # GET PAGE TEXT
    # -----------------------------------

    def get_page_text(self):

        body_text = self.page.locator(
            "body"
        ).inner_text(timeout=5000)

        return body_text

    # -----------------------------------
    # GET INTERACTIVE ELEMENTS
    # -----------------------------------

    def get_interactive_elements(self):

        js_code = """
        () => {
            const elements = [];
            let count = 0;
            const MAX_ELEMENTS = 120;
            
            function collectInteractive(root) {
                if (count >= MAX_ELEMENTS) return;
                
                const selectables = root.querySelectorAll('input, textarea, button, a, [role="button"]');
                for (const el of selectables) {
                    if (count >= MAX_ELEMENTS) break;
                    
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    
                    // Filter out zero-dimension or hidden elements
                    if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                        continue;
                    }
                    
                    // Filter out off-screen screen-reader/accessibility elements
                    if (rect.left < -100 || rect.top < -100) {
                        continue;
                    }
                    
                    let tag = el.tagName.toLowerCase();
                    let id = el.getAttribute('id') || '';
                    let name = el.getAttribute('name') || '';
                    let placeholder = el.getAttribute('placeholder') || '';
                    let ariaLabel = el.getAttribute('aria-label') || '';
                    let title = el.getAttribute('title') || '';
                    let text = el.innerText ? el.innerText.trim().replace(/\\n/g, ' ') : '';
                    
                    // Filter out accessibility links
                    const lowerText = text.toLowerCase();
                    if (lowerText.includes('skip navigation') || lowerText.includes('skip to') || lowerText.includes('jump to')) {
                        continue;
                    }
                    
                    let selector = tag;
                    
                    // Generate best unique/readable selector
                    if ((tag === 'input' || tag === 'textarea') && id) {
                        selector = `${tag}#${id}`;
                    } else if ((tag === 'input' || tag === 'textarea') && name) {
                        selector = `${tag}[name="${name}"]`;
                    } else if (tag === 'a' && text) {
                        const escapedText = text.replace(/"/g, '\\"').substring(0, 40);
                        selector = `a:has-text("${escapedText}")`;
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
                        const escapedText = text.replace(/"/g, '\\"').substring(0, 40);
                        selector = `button:has-text("${escapedText}")`;
                    } else if (el.className) {
                        const firstClass = el.className.trim().split(/\\s+/)[0];
                        if (firstClass && !firstClass.includes(':')) {
                            selector = `${tag}.${firstClass}`;
                        }
                    }
                    
                    // Skip completely generic selectors that cannot be uniquely targeted
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
                            "selector": selector,
                            "description": desc
                        });
                        count++;
                    }
                }
                
                const allElements = root.querySelectorAll('*');
                for (const el of allElements) {
                    if (el.shadowRoot) {
                        collectInteractive(el.shadowRoot);
                    }
                }
            }
            
            collectInteractive(document);
            return elements;
        }
        """
        try:
            return self.page.evaluate(js_code)
        except Exception as e:
            return []

    # -----------------------------------
    # CLOSE
    # -----------------------------------

    def close(self):

        self.browser.close()

        self.playwright.stop()