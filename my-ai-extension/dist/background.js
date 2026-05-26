async function O({apiKey:e,model:o,userGoal:l,history:s,currentUrl:t,pageTitle:p,elements:g,onLog:h}){var A,x,v;let i=g&&g.length>0?`
Interactive Elements on Current Page:
`+g.map(m=>`- Selector: ${m.selector}  --> Description: ${m.description}`).join(`
`):`
Interactive Elements on Current Page: None found.`,n=s&&s.length>0?s.map(m=>`- ${m}`).join(`
`):"None";const a=`You are an AI browser agent working step-by-step to achieve a user's goal.

Ultimate Goal: ${l}

Available Tools:
1. open_website(url)
2. type_text(selector, text)
3. press_key(key)
4. click_element(selector)
5. scroll_down()
6. go_back()
7. finish(message) - Call this when you have successfully achieved the goal or cannot proceed. Explain what you found in the message.

Current Browser State:
- URL: ${t}
- Page Title: ${p}${i}

Execution History (Actions taken so far):
${n}

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
click_element("a:has-text("Song Name")")

Next Action(s):`,L={"Content-Type":"application/json",Authorization:`Bearer ${e}`};let T="https://openrouter.ai/api/v1/chat/completions";e&&e.startsWith("gsk_")?T="https://api.groq.com/openai/v1/chat/completions":e&&e.startsWith("AIzaSy")&&(T="https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");let u=o||"";e&&e.startsWith("gsk_")?(!u||u.includes("openrouter")||u==="openrouter/free"||u.includes("gemini"))&&(u="groq/compound"):e&&e.startsWith("AIzaSy")?(!u||u.includes("openrouter")||u.includes("groq")||u==="openrouter/free"||u==="groq/compound")&&(u="gemini-2.5-flash"):(!u||u==="groq/compound"||u.includes("gemini"))&&(u="openrouter/free");const f={model:u,messages:[{role:"user",content:a}],temperature:.1};e&&e.startsWith("gsk_")&&f.model==="groq/compound"&&(f.compound_custom={tools:{enabled_tools:["web_search","code_interpreter","visit_website"]}}),!(e&&(e.startsWith("gsk_")||e.startsWith("AIzaSy")))&&(f.model.includes("reasoning")||f.model.includes("nemotron"))&&(f.extra_body={reasoning:{enabled:!0}});const _=4;let S;for(let m=0;m<_;m++){h&&typeof h=="function"&&h(`Calling LLM API (Attempt ${m+1}/${_})...`);const $=new AbortController,N=setTimeout(()=>$.abort(),2e4);let y;try{y=await fetch(T,{method:"POST",headers:L,body:JSON.stringify(f),signal:$.signal}),clearTimeout(N)}catch(d){clearTimeout(N);const k=d.name==="AbortError"?"Request timed out after 20s":d.message;console.warn(`[LLMClient] Fetch error: ${k}`),h&&typeof h=="function"&&h(`⚠️ Connection error: ${k}. Retrying...`),S=new Error(k),await new Promise(M=>setTimeout(M,2e3));continue}if(y.status===429){const d=Math.pow(2,m)*3e3;console.warn(`[LLMClient] Rate limited (429). Retrying in ${d/1e3}s… (attempt ${m+1}/${_})`),h&&typeof h=="function"&&h(`⏳ Rate limited (429). Retrying in ${d/1e3}s...`),await new Promise(I=>setTimeout(I,d)),S=new Error(`Rate limit exceeded (429). Retried ${m+1} times.`);continue}if(!y.ok){const d=await y.json().catch(()=>({}));throw new Error(((A=d==null?void 0:d.error)==null?void 0:A.message)||`HTTP error ${y.status}`)}let E=((v=(x=(await y.json()).choices[0])==null?void 0:x.message)==null?void 0:v.content)||"";return E=E.replace(/```(?:python)?/g,"").replace(/```/g,"").trim(),E}throw S||new Error("LLM request failed after all retries.")}let r={running:!1,goal:"",apiKey:"",model:"",maxSteps:10,currentStep:0,history:[],logs:[],errorMsg:null,lastScreenshot:null};function P(){return new Promise(e=>{chrome.tabs.query({active:!0,currentWindow:!0},o=>{const l=o[0];if(!l){e(null);return}chrome.tabs.captureVisibleTab(l.windowId,{format:"jpeg",quality:40},s=>{chrome.runtime.lastError?e(null):e(s)})})})}let w=null;function C(){w||(w=setInterval(async()=>{try{const e=await P();e&&chrome.runtime.sendMessage({type:"LIVE_SCREEN_UPDATE",dataUrl:e}).catch(()=>{b()})}catch{b()}},90))}function b(){w&&(clearInterval(w),w=null)}function c(e){const l=`[${new Date().toLocaleTimeString()}] ${e}`;r.logs.push(l),chrome.runtime.sendMessage({type:"LOG_UPDATE",log:l,state:r}).catch(()=>{})}function R(e){const o=[],s=e.split(`
`).map(i=>{const n=i.indexOf("#");return n>=0?i.substring(0,n):i}).join(" ").trim();if(!s)return o;let t=0;function p(){for(;t<s.length&&/\s/.test(s[t]);)t++}function g(i){let n="";for(t++;t<s.length;){const a=s[t];if(a==="\\")t+1<s.length?(n+=s[t+1],t+=2):(n+=a,t++);else{if(a===i)return t++,n;n+=a,t++}}return n}function h(){const i=[];if(s[t]!=="(")return i;if(t++,p(),s[t]===")")return t++,i;for(;t<s.length;){p();const n=s[t];if(n==='"'||n==="'")i.push(g(n));else{let a="";for(;t<s.length&&s[t]!==","&&s[t]!==")"&&s[t]!==" ";)a+=s[t],t++;a=a.trim(),!isNaN(a)&&a!==""?i.push(Number(a)):i.push(a)}if(p(),s[t]===",")t++;else if(s[t]===")"){t++;break}else t++}return i}for(;t<s.length&&(p(),!(t>=s.length));){let i="";for(;t<s.length&&/[a-zA-Z0-9_]/.test(s[t]);)i+=s[t],t++;if(!i){t++;continue}if(p(),s[t]==="("){const n=h();i==="open_website"&&n.length>=1?o.push({type:"open_website",url:n[0]}):i==="type_text"&&n.length>=2?o.push({type:"type_text",selector:n[0],text:n[1]}):i==="click_element"&&n.length>=1?o.push({type:"click_element",selector:n[0]}):i==="press_key"&&n.length>=1?o.push({type:"press_key",key:n[0]}):i==="scroll_down"?o.push({type:"scroll_down"}):i==="go_back"?o.push({type:"go_back"}):i==="finish"&&n.length>=1&&o.push({type:"finish",message:n[0]})}}return o}function U(e){return new Promise(o=>{let l=!1;const s=setTimeout(()=>{l||(l=!0,chrome.tabs.onUpdated.removeListener(t),o())},1e4),t=(p,g)=>{p===e&&g.status==="complete"&&(l=!0,clearTimeout(s),chrome.tabs.onUpdated.removeListener(t),setTimeout(o,300))};chrome.tabs.onUpdated.addListener(t)})}async function D(){for(c("Starting autonomous loop...");r.running&&r.currentStep<r.maxSteps;){r.currentStep++,c(`--- Step ${r.currentStep} of ${r.maxSteps} ---`);const[e]=await chrome.tabs.query({active:!0,currentWindow:!0});if(!e){c("Error: No active tab found. Pausing loop."),r.running=!1;break}let o=null;try{o=await chrome.tabs.sendMessage(e.id,{type:"EXTRACT_DOM"})}catch{c("Warning: Could not connect to tab content script. Retrying navigation...")}const l=(o==null?void 0:o.url)||e.url||"Unknown",s=(o==null?void 0:o.title)||e.title||"Unknown",t=(o==null?void 0:o.elements)||[];c(`Current Page: ${s} (${l})`),c(`Scraped ${t.length} interactive elements.`),c("AI is thinking...");let p="",g=null;try{g=await P(),r.lastScreenshot=g}catch(n){console.warn("Screenshot failed during step:",n)}try{p=await O({apiKey:r.apiKey,model:r.model,userGoal:r.goal,history:r.history,currentUrl:l,pageTitle:s,elements:t,onLog:c}),c(`AI Plan:
${p}`)}catch(n){n.message.includes("429")||n.message.toLowerCase().includes("rate limit")?c("⏳ Rate limit hit — sab retries exhaust ho gaye. Thodi der baad dubara try karo ya model badlo."):c(`AI Think Error: ${n.message}`),r.running=!1;break}if(!p.trim()){c("AI returned empty plan. Retrying...");continue}const h=R(p);if(h.length===0){c("Warning: AI plan could not be parsed into valid actions. Retrying...");continue}let i=!1;for(const n of h){if(!r.running)break;c(`Executing action: ${JSON.stringify(n)}`);try{if(n.type==="open_website")await chrome.tabs.update(e.id,{url:n.url}),c(`Navigating to: ${n.url}`),await U(e.id);else if(n.type==="finish"){c(`Goal Finished: ${n.message}`),r.running=!1,chrome.runtime.sendMessage({type:"AGENT_FINISHED",message:n.message}).catch(()=>{});break}else{const a=await chrome.tabs.sendMessage(e.id,{type:"EXECUTE_ACTION",action:n});if(!a.success)throw new Error(a.error);c(`Success: ${a.result}`)}r.history.push(JSON.stringify(n)),await new Promise(a=>setTimeout(a,100))}catch(a){c(`Execution Error: ${a.message}`),r.errorMsg=a.message,i=!0;break}}i||await new Promise(n=>setTimeout(n,100))}r.currentStep>=r.maxSteps&&r.running&&(c(`Reached max steps limit (${r.maxSteps}). Agent paused.`),r.running=!1),c("Execution loop stopped."),chrome.runtime.sendMessage({type:"AGENT_STOPPED",state:r}).catch(()=>{})}chrome.runtime.onMessage.addListener((e,o,l)=>{e.type==="START_AGENT"&&(r.running||(r.running=!0,r.goal=e.goal,r.apiKey=e.apiKey,r.model=e.model,r.maxSteps=e.maxSteps||10,r.currentStep=0,r.history=[],r.logs=[],r.errorMsg=null,r.lastScreenshot=null,D()),l({success:!0,state:r})),e.type==="STOP_AGENT"&&(r.running=!1,c("Stop requested by user."),b(),l({success:!0,state:r})),e.type==="GET_AGENT_STATUS"&&l({state:r}),e.type==="START_LIVE_STREAM"&&(C(),l({success:!0})),e.type==="STOP_LIVE_STREAM"&&(b(),l({success:!0}))});
