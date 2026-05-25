/**
 * OpenRouter LLM Client
 */

export async function getLLMPlan({ apiKey, model, userGoal, history, currentUrl, pageTitle, elements }) {
  // Format elements list
  let elementsStr = elements && elements.length > 0 
    ? "\nInteractive Elements on Current Page:\n" + elements.map(el => `- Selector: ${el.selector}  --> Description: ${el.description}`).join('\n')
    : "\nInteractive Elements on Current Page: None found.";

  // Compile history
  let historyStr = history && history.length > 0 
    ? history.map(act => `- ${act}`).join('\n')
    : "None";

  // Build prompt
  const systemPrompt = `You are an AI browser agent working step-by-step to achieve a user's goal.

Ultimate Goal: ${userGoal}

Available Tools:
1. open_website(url)
2. type_text(selector, text)
3. press_key(key)
4. click_element(selector)
5. scroll_down()
6. go_back()
7. finish(message) - Call this when you have successfully achieved the goal or cannot proceed. Explain what you found in the message.

Current Browser State:
- URL: ${currentUrl}
- Page Title: ${pageTitle}${elementsStr}

Execution History (Actions taken so far):
${historyStr}

Rules:
1. Return ONLY Python-like function calls to interact with the browser.
2. If you are finished or cannot make progress, you must call finish(message).
3. Do not include markdown code block syntax (like \`\`\`python) in your response. The executor will run it directly, so return plain text.
4. Do not include any explanations, introduction, or commentary outside the code.
5. You MUST ONLY use selectors listed in the 'Interactive Elements on Current Page' section. Do NOT invent or guess selectors.
6. If the goal involves searching, playing a song, or watching a video:
   a. Locate the search input field and use type_text on it directly, then press_key("Enter"). Do NOT click random buttons first.
   b. Once the search results page loads, locate the video title or thumbnail (often using a selector like a:has-text("Song Name") or #thumbnail) and click_element on it to play/open it.
7. If your previous action failed, do NOT repeat the exact same action or selector. Try a different selector, scroll, or change your approach.
8. Do NOT click "Sign in", "Log in", or "Create account" buttons unless the goal explicitly specifies that you must log in. Public content does NOT require signing in.
9. DO NOT BLINDLY COPY EXAMPLE VALUES. You MUST substitute search terms (like "Song Name") with the actual search keywords corresponding to the user's specific "Ultimate Goal".

Examples of searching:
open_website("https://www.wikipedia.org")
type_text("input[name='search']", "Topic Name")
press_key("Enter")

Examples of playing a video:
open_website("https://www.youtube.com")
type_text("input[name='search_query']", "Song Name")
press_key("Enter")
# On results page (select actual matching link from current page selectors list):
click_element("a:has-text(\"Song Name\")")

Next Action(s):`;

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`
  };

  // Auto-detect API Key types and route directly to the correct endpoint
  let apiEndpoint = "https://openrouter.ai/api/v1/chat/completions";
  if (apiKey && apiKey.startsWith("gsk_")) {
    apiEndpoint = "https://api.groq.com/openai/v1/chat/completions";
  } else if (apiKey && apiKey.startsWith("AIzaSy")) {
    apiEndpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  }

  // Smart model fallback based on API key type
  let selectedModel = model || "";
  if (apiKey && apiKey.startsWith("gsk_")) {
    if (!selectedModel || selectedModel.includes("openrouter") || selectedModel === "openrouter/free" || selectedModel.includes("gemini")) {
      selectedModel = "groq/compound";
    }
  } else if (apiKey && apiKey.startsWith("AIzaSy")) {
    if (!selectedModel || selectedModel.includes("openrouter") || selectedModel.includes("groq") || selectedModel === "openrouter/free" || selectedModel === "groq/compound") {
      selectedModel = "gemini-1.5-flash"; // Highly compatible, fast free-tier Gemini model
    }
  } else {
    if (!selectedModel || selectedModel === "groq/compound" || selectedModel.includes("gemini")) {
      selectedModel = "openrouter/free";
    }
  }

  const body = {
    model: selectedModel,
    messages: [
      {
        role: "user",
        content: systemPrompt
      }
    ],
    temperature: 0.1
  };

  // If using groq/compound on Groq's official API, attach compound_custom tool configurations
  if (apiKey && apiKey.startsWith("gsk_") && body.model === "groq/compound") {
    body.compound_custom = {
      tools: {
        enabled_tools: [
          "web_search",
          "code_interpreter",
          "visit_website"
        ]
      }
    };
  }

  // Only pass reasoning configuration for OpenRouter models that explicitly support it
  const isDirectProvider = apiKey && (apiKey.startsWith("gsk_") || apiKey.startsWith("AIzaSy"));
  if (!isDirectProvider && (body.model.includes('reasoning') || body.model.includes('nemotron'))) {
    body.extra_body = {
      reasoning: {
        enabled: true
      }
    };
  }

  const response = await fetch(apiEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `HTTP error ${response.status}`);
  }

  const data = await response.json();
  let code = data.choices[0]?.message?.content || "";

  // Clean code wrappers
  code = code.replace(/```(?:python)?/g, '').replace(/```/g, '').trim();
  return code;
}
