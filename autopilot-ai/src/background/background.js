import { getLLMPlan } from '../ai/llmClient';

// Core Agent State
let agentState = {
  running: false,
  goal: '',
  apiKey: '',
  model: '',
  maxSteps: 10,
  currentStep: 0,
  history: [],
  logs: [],
  errorMsg: null,
  lastScreenshot: null
};

// Helper to capture the current active tab's visible area
function captureActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab) {
        resolve(null);
        return;
      }
      chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 40 }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          resolve(null);
        } else {
          resolve(dataUrl);
        }
      });
    });
  });
}

let liveStreamInterval = null;

function startLiveStream() {
  if (liveStreamInterval) return;
  liveStreamInterval = setInterval(async () => {
    try {
      const dataUrl = await captureActiveTab();
      if (dataUrl) {
        chrome.runtime.sendMessage({
          type: 'LIVE_SCREEN_UPDATE',
          dataUrl: dataUrl
        }).catch(() => {
          stopLiveStream(); // Stop stream if sidepanel/popup is closed
        });
      }
    } catch (e) {
      stopLiveStream();
    }
  }, 90); // ~11-12 FPS
}

function stopLiveStream() {
  if (liveStreamInterval) {
    clearInterval(liveStreamInterval);
    liveStreamInterval = null;
  }
}


// Log helper to store and broadcast agent status
function logToUI(text) {
  const timestamp = new Date().toLocaleTimeString();
  const logLine = `[${timestamp}] ${text}`;
  agentState.logs.push(logLine);
  
  chrome.runtime.sendMessage({
    type: 'LOG_UPDATE',
    log: logLine,
    state: agentState
  }).catch(() => {}); // Ignore error if sidepanel/popup is closed
}

// Action statement parser
function parseActions(codeBlock) {
  const actions = [];
  
  // Clean comments on each line
  const lines = codeBlock.split('\n').map(line => {
    const idx = line.indexOf('#');
    return idx >= 0 ? line.substring(0, idx) : line;
  });
  
  const content = lines.join(' ').trim();
  if (!content) return actions;

  let pos = 0;
  
  function skipWhitespace() {
    while (pos < content.length && /\s/.test(content[pos])) {
      pos++;
    }
  }

  function readString(quoteChar) {
    let str = "";
    pos++; // Skip opening quote
    while (pos < content.length) {
      const char = content[pos];
      if (char === '\\') {
        if (pos + 1 < content.length) {
          str += content[pos + 1];
          pos += 2;
        } else {
          str += char;
          pos++;
        }
      } else if (char === quoteChar) {
        pos++; // Skip closing quote
        return str;
      } else {
        str += char;
        pos++;
      }
    }
    return str;
  }

  function readArguments() {
    const args = [];
    if (content[pos] !== '(') return args;
    pos++; // Skip '('
    
    skipWhitespace();
    if (content[pos] === ')') {
      pos++; // Skip ')'
      return args;
    }

    while (pos < content.length) {
      skipWhitespace();
      const char = content[pos];
      if (char === '"' || char === "'") {
        args.push(readString(char));
      } else {
        let val = "";
        while (pos < content.length && content[pos] !== ',' && content[pos] !== ')' && content[pos] !== ' ') {
          val += content[pos];
          pos++;
        }
        val = val.trim();
        if (!isNaN(val) && val !== '') {
          args.push(Number(val));
        } else {
          args.push(val);
        }
      }

      skipWhitespace();
      if (content[pos] === ',') {
        pos++; // Skip comma
      } else if (content[pos] === ')') {
        pos++; // Skip closing parenthesis
        break;
      } else {
        pos++;
      }
    }
    return args;
  }

  while (pos < content.length) {
    skipWhitespace();
    if (pos >= content.length) break;

    // Read function name
    let name = "";
    while (pos < content.length && /[a-zA-Z0-9_]/.test(content[pos])) {
      name += content[pos];
      pos++;
    }

    if (!name) {
      pos++;
      continue;
    }

    skipWhitespace();
    if (content[pos] === '(') {
      const args = readArguments();
      
      if (name === 'open_website' && args.length >= 1) {
        actions.push({ type: 'open_website', url: args[0] });
      } else if (name === 'type_text' && args.length >= 2) {
        actions.push({ type: 'type_text', selector: args[0], text: args[1] });
      } else if (name === 'click_element' && args.length >= 1) {
        actions.push({ type: 'click_element', selector: args[0] });
      } else if (name === 'press_key' && args.length >= 1) {
        actions.push({ type: 'press_key', key: args[0] });
      } else if (name === 'scroll_down') {
        actions.push({ type: 'scroll_down' });
      } else if (name === 'go_back') {
        actions.push({ type: 'go_back' });
      } else if (name === 'finish' && args.length >= 1) {
        actions.push({ type: 'finish', message: args[0] });
      }
    }
  }

  return actions;
}

// Wait for tab load status to be complete (with a 10-second safety timeout)
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }, 10000); // 10s safety timeout

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        resolved = true;
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 300); // Allow extra time for AJAX/DOM settle
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Main autonomous loop execution
async function runAgentLoop() {
  logToUI("Starting autonomous loop...");
  
  while (agentState.running && agentState.currentStep < agentState.maxSteps) {
    agentState.currentStep++;
    logToUI(`--- Step ${agentState.currentStep} of ${agentState.maxSteps} ---`);

    // 1. Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      logToUI("Error: No active tab found. Pausing loop.");
      agentState.running = false;
      break;
    }

    // 2. Query page DOM from content script
    let pageState = null;
    try {
      pageState = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_DOM' });
    } catch (e) {
      // If content script is not loaded, we might need to navigate or wait
      logToUI(`Warning: Could not connect to tab content script. Retrying navigation...`);
    }

    const currentUrl = pageState?.url || tab.url || 'Unknown';
    const pageTitle = pageState?.title || tab.title || 'Unknown';
    const elements = pageState?.elements || [];

    logToUI(`Current Page: ${pageTitle} (${currentUrl})`);
    logToUI(`Scraped ${elements.length} interactive elements.`);

    // 3. AI Thought Step
    logToUI("AI is thinking...");
    let plannedCode = "";
    let screenshotUrl = null;
    try {
      screenshotUrl = await captureActiveTab();
      agentState.lastScreenshot = screenshotUrl;
    } catch (e) {
      console.warn("Screenshot failed during step:", e);
    }

    try {
      plannedCode = await getLLMPlan({
        apiKey: agentState.apiKey,
        model: agentState.model,
        userGoal: agentState.goal,
        history: agentState.history,
        currentUrl,
        pageTitle,
        elements,
        onLog: logToUI
      });
      logToUI(`AI Plan:\n${plannedCode}`);
    } catch (err) {
      if (err.message.includes('429') || err.message.toLowerCase().includes('rate limit')) {
        logToUI(`⏳ Rate limit hit — sab retries exhaust ho gaye. Thodi der baad dubara try karo ya model badlo.`);
      } else {
        logToUI(`AI Think Error: ${err.message}`);
      }
      agentState.running = false;
      break;
    }

    if (!plannedCode.trim()) {
      logToUI("AI returned empty plan. Retrying...");
      continue;
    }

    // 4. Parse & Execute actions
    const actions = parseActions(plannedCode);
    if (actions.length === 0) {
      logToUI("Warning: AI plan could not be parsed into valid actions. Retrying...");
      continue;
    }

    let stepFailed = false;
    for (const act of actions) {
      if (!agentState.running) break;

      logToUI(`Executing action: ${JSON.stringify(act)}`);

      try {
        if (act.type === 'open_website') {
          await chrome.tabs.update(tab.id, { url: act.url });
          logToUI(`Navigating to: ${act.url}`);
          await waitForTabLoad(tab.id);
        } else if (act.type === 'finish') {
          logToUI(`Goal Finished: ${act.message}`);
          agentState.running = false;
          chrome.runtime.sendMessage({ type: 'AGENT_FINISHED', message: act.message }).catch(() => {});
          break;
        } else {
          // Page actions
          const actionResponse = await chrome.tabs.sendMessage(tab.id, {
            type: 'EXECUTE_ACTION',
            action: act
          });
          
          if (!actionResponse.success) {
            throw new Error(actionResponse.error);
          }
          logToUI(`Success: ${actionResponse.result}`);
        }
        
        // Add to history
        agentState.history.push(JSON.stringify(act));
        await new Promise(r => setTimeout(r, 100)); // Delay between action steps
      } catch (err) {
        logToUI(`Execution Error: ${err.message}`);
        agentState.errorMsg = err.message;
        stepFailed = true;
        break; // Stop executing rest of the chunk on error, let AI re-plan
      }
    }

    if (stepFailed) {
      continue;
    }

    // Settle delay between steps
    await new Promise(r => setTimeout(r, 100));
  }

  if (agentState.currentStep >= agentState.maxSteps && agentState.running) {
    logToUI(`Reached max steps limit (${agentState.maxSteps}). Agent paused.`);
    agentState.running = false;
  }
  
  logToUI("Execution loop stopped.");
  chrome.runtime.sendMessage({ type: 'AGENT_STOPPED', state: agentState }).catch(() => {});
}

// Message Dispatcher
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_AGENT') {
    if (!agentState.running) {
      agentState.running = true;
      agentState.goal = message.goal;
      agentState.apiKey = message.apiKey;
      agentState.model = message.model;
      agentState.maxSteps = message.maxSteps || 10;
      agentState.currentStep = 0;
      agentState.history = [];
      agentState.logs = [];
      agentState.errorMsg = null;
      agentState.lastScreenshot = null;
      
      runAgentLoop();
    }
    sendResponse({ success: true, state: agentState });
  }

  if (message.type === 'STOP_AGENT') {
    agentState.running = false;
    logToUI("Stop requested by user.");
    stopLiveStream();
    sendResponse({ success: true, state: agentState });
  }

  if (message.type === 'GET_AGENT_STATUS') {
    sendResponse({ state: agentState });
  }

  if (message.type === 'START_LIVE_STREAM') {
    startLiveStream();
    sendResponse({ success: true });
  }

  if (message.type === 'STOP_LIVE_STREAM') {
    stopLiveStream();
    sendResponse({ success: true });
  }
});
