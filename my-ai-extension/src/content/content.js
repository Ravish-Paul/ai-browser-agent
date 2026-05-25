import { getInteractiveElements } from '../ai/domAnalyzer';
import { clickElement, typeText, pressKey, scrollDown, goBack } from '../ai/actionExecutor';

// Listen for messages from the background worker or sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_DOM') {
    try {
      const elements = getInteractiveElements();
      sendResponse({ 
        success: true, 
        elements: elements,
        url: window.location.href,
        title: document.title
      });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    return true; // Keep connection open for async response
  }

  if (message.type === 'EXECUTE_ACTION') {
    const { action } = message;
    
    // We execute the parsed action
    executeSingleAction(action)
      .then(result => {
        sendResponse({ success: true, result });
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
      
    return true; // Keep connection open for async response
  }
});

// Helper to execute single actions sequentially
async function executeSingleAction(action) {
  switch (action.type) {
    case 'click_element':
      return clickElement(action.selector);
    case 'type_text':
      return typeText(action.selector, action.text);
    case 'press_key':
      return pressKey(action.key);
    case 'scroll_down':
      return scrollDown();
    case 'go_back':
      return goBack();
    default:
      throw new Error(`Unsupported page action: ${action.type}`);
  }
}
