import streamlit as st
import os
import time
from dotenv import load_dotenv
from tools import BrowserTools
from brain import AIBrain

# Page configuration
st.set_page_config(
    page_title="Autonomous Browser Agent",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for modern styling
st.markdown("""
<style>
    .main {
        background-color: #0f111a;
        color: #e6e6e6;
    }
    .stTextInput>div>div>input {
        background-color: #1a1c24;
        color: #ffffff;
        border-color: #3b3f4c;
    }
    .stButton>button {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 10px 24px;
        font-weight: bold;
        transition: all 0.3s ease;
    }
    .stButton>button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }
    .card {
        background-color: #1a1c24;
        padding: 20px;
        border-radius: 12px;
        border: 1px solid #2d313f;
        margin-bottom: 20px;
    }
    .log-box {
        background-color: #000000;
        font-family: monospace;
        padding: 15px;
        border-radius: 8px;
        border: 1px solid #1f222d;
        height: 450px;
        overflow-y: auto;
        white-space: pre-wrap;
        color: #a9b7c6;
    }
</style>
""", unsafe_allow_html=True)

load_dotenv()

# App Title
st.title("🤖 Autonomous Browser Agent")
st.markdown("Let AI explore and perform tasks in Chrome for you.")

# Sidebar Configuration
st.sidebar.title("Configuration ⚙️")
groq_key = st.sidebar.text_input(
    "OpenRouter API Key",
    value=os.getenv("OPENROUTER_API_KEY", os.getenv("GROQ_API_KEY", "")),
    type="password"
)
model_name = st.sidebar.text_input(
    "OpenRouter Model",
    value=os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3-super-120b-a12b:free")
)
max_steps = st.sidebar.slider("Max Steps", min_value=1, max_value=15, value=10)

# Input Form
st.markdown("### 🎯 Set Your Goal")
goal = st.text_input(
    "What do you want me to do?",
    placeholder="e.g. Open wikipedia.org, search for python programming language, and finish by telling me the first sentence."
)

start_button = st.button("🚀 Start Agent")

if start_button:
    if not goal:
        st.warning("Please specify a goal!")
    elif not groq_key:
        st.warning("Please specify an OpenRouter API Key!")
    else:
        # Override the API key environment variable for this run
        os.environ["OPENROUTER_API_KEY"] = groq_key
        os.environ["OPENROUTER_MODEL"] = model_name
        
        # UI Columns
        col_logs, col_view = st.columns([1, 1.2])
        
        with col_logs:
            st.markdown("### 📜 Execution Logs")
            status_text = st.empty()
            log_container = st.empty()
            logs = []
            
        with col_view:
            st.markdown("### 🖥️ Browser Viewport")
            image_placeholder = st.empty()
            
        # Log updater helper
        def append_log(text):
            logs.append(text)
            log_container.markdown(f'<div class="log-box">{"".join(logs)}</div>', unsafe_allow_html=True)
            try:
                with open("streamlit_run.log", "a", encoding="utf-8") as f:
                    f.write(text)
            except:
                pass

        append_log("Initializing browser and AI brain...\n")
        status_text.info("Starting browser...")
        
        # Main execution loop
        try:
            agent = BrowserTools()
            brain = AIBrain()
            
            # Update API key in brain client if overridden
            brain.client.api_key = groq_key
            brain.model = model_name
            
            append_log("Browser and AI Brain initialized successfully!\n")
            
            history = []
            error_msg = None
            state = {
                "finished": False,
                "finish_message": ""
            }

            def finish_callback(message):
                state["finished"] = True
                state["finish_message"] = message
                append_log(f"\n[FINISH] {message}\n")

            # Expose functions to agent
            safe_globals = {
                "open_website": agent.open_website,
                "type_text": agent.type_text,
                "press_key": agent.press_key,
                "click_element": agent.click_element,
                "scroll_down": agent.scroll_down,
                "go_back": agent.go_back,
                "finish": finish_callback,
            }

            for step in range(1, max_steps + 1):
                status_text.warning(f"Step {step} of {max_steps}: AI is thinking...")
                append_log(f"\n--- STEP {step} of {max_steps} ---\n")
                
                # 1. Capture state
                try:
                    current_state = {
                        "url": agent.page.url,
                        "title": agent.get_title(),
                        "text": agent.get_page_text(),
                        "elements": agent.get_interactive_elements()
                    }
                    append_log(f"Page Title: {current_state['title']}\n")
                    append_log(f"URL: {current_state['url']}\n")
                except Exception as e:
                    err_str = str(e).lower()
                    if "closed" in err_str or "context" in err_str:
                        append_log("Browser or page context was closed.\n")
                        break
                    current_state = {"url": "Unknown", "title": "Unknown", "text": "", "elements": []}
                    append_log(f"Failed to capture state: {e}\n")

                # 2. Think
                ai_response = brain.think(
                    user_goal=goal,
                    history=history,
                    current_state=current_state,
                    error_msg=error_msg
                )
                
                error_msg = None
                
                if not ai_response.strip():
                    append_log("AI returned an empty action. Retrying step...\n")
                    continue
                    
                append_log(f"AI planned code:\n```python\n{ai_response}\n```\n")

                # 3. Execute
                status_text.warning(f"Step {step}: Executing browser action...")
                try:
                    exec(ai_response, safe_globals)
                    history.append(ai_response)
                    append_log("Action executed successfully.\n")
                except Exception as e:
                    error_msg = str(e)
                    append_log(f"Execution Error: {e}\n")
                    # We do not save failed attempts to history to prevent Llama-8B from repeating failures
                    pass
                    
                    err_str = error_msg.lower()
                    if "closed" in err_str or "context" in err_str:
                        append_log("Browser was closed. Exiting.\n")
                        break
                
                # 4. Check if finished
                if state["finished"]:
                    status_text.success("Goal achieved!")
                    st.balloons()
                    st.success(f"**Goal Achieved:** {state['finish_message']}")
                    break
                    
                # 5. Take screenshot and update UI
                try:
                    screenshot_name = f"streamlit_step_{step}.png"
                    agent.take_screenshot(screenshot_name)
                    image_placeholder.image(screenshot_name, caption=f"Screenshot at Step {step}", width='stretch')
                except Exception as e:
                    append_log(f"Could not update screenshot: {e}\n")
                    
                time.sleep(1)
                
            if not state["finished"]:
                status_text.error(f"Failed to achieve goal within {max_steps} steps.")
                st.error("Could not achieve goal within step limits.")

        except Exception as e:
            st.error(f"An unexpected error occurred: {e}")
            
        finally:
            # Clean up
            try:
                append_log("\nClosing browser connection...\n")
                agent.close()
                append_log("Browser closed.\n")
            except:
                pass
