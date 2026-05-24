import sys
import time
import colorama
from colorama import Fore, Style
from tools import BrowserTools
from brain import AIBrain

# Initialize colorama
colorama.init(autoreset=True)

# -----------------------------------
# INITIALIZE
# -----------------------------------
print(f"{Fore.CYAN}{Style.BRIGHT}=========================================")
print(f"{Fore.CYAN}{Style.BRIGHT}   Initializing Autonomous Browser Agent   ")
print(f"{Fore.CYAN}{Style.BRIGHT}=========================================")

try:
    agent = BrowserTools()
    brain = AIBrain()
    print(f"{Fore.GREEN}Browser and AI Brain initialized successfully.\n")
except Exception as e:
    print(f"{Fore.RED}Initialization Error: {e}")
    sys.exit(1)

# -----------------------------------
# USER INPUT
# -----------------------------------
print(f"{Fore.YELLOW}What do you want me to do?")
user_goal = input(f"{Fore.WHITE}> ")
if not user_goal.strip():
    print(f"{Fore.RED}No goal specified. Exiting.")
    agent.close()
    sys.exit(0)

# -----------------------------------
# AGENT LOOP
# -----------------------------------
history = []
error_msg = None
max_steps = 15
finished = False
finish_message = ""

def finish_callback(message):
    global finished, finish_message
    finished = True
    finish_message = message
    print(f"\n{Fore.GREEN}{Style.BRIGHT}[FINISH] {message}")

safe_globals = {
    "open_website": agent.open_website,
    "type_text": agent.type_text,
    "press_key": agent.press_key,
    "click_element": agent.click_element,
    "scroll_down": agent.scroll_down,
    "go_back": agent.go_back,
    "finish": finish_callback,
}

print(f"\n{Fore.CYAN}Starting autonomous execution loop (Max {max_steps} steps)...\n")

for step in range(1, max_steps + 1):
    print(f"{Fore.BLUE}{Style.BRIGHT}--- STEP {step} of {max_steps} ---")
    
    # 1. Capture current browser state
    try:
        current_state = {
            "url": agent.page.url,
            "title": agent.get_title(),
            "text": agent.get_page_text(),
            "elements": agent.get_interactive_elements()
        }
        print(f"{Fore.WHITE}Current Page: {Fore.YELLOW}{current_state['title']} {Fore.WHITE}({current_state['url']})")
    except Exception as e:
        err_str = str(e).lower()
        if "closed" in err_str or "context" in err_str:
            print(f"{Fore.RED}Browser or page context was closed. Exiting agent loop.")
            break
        current_state = {
            "url": "Unknown",
            "title": "Unknown",
            "text": ""
        }
        print(f"{Fore.RED}Failed to capture page state: {e}")

    # 2. Get AI Plan/Action
    print(f"{Fore.MAGENTA}AI is thinking...")
    ai_response = brain.think(
        user_goal=user_goal,
        history=history,
        current_state=current_state,
        error_msg=error_msg
    )
    
    # Clear previous error
    error_msg = None
    
    if not ai_response.strip():
        print(f"{Fore.YELLOW}AI returned an empty action. Retrying step...")
        continue

    print(f"\n{Fore.GREEN}AI Code to Execute:")
    print(f"{Fore.BLACK}{colorama.Back.LIGHTWHITE_EX}{ai_response}\n")

    # 3. Execute actions
    try:
        # Run the AI response code block
        exec(ai_response, safe_globals)
        
        # Save to history if execution succeeded
        history.append(ai_response)
        print(f"{Fore.GREEN}Step {step} executed successfully.")
        
    except Exception as e:
        error_msg = str(e)
        print(f"{Fore.RED}Step {step} Execution Error: {e}")
        err_str = error_msg.lower()
        if "closed" in err_str or "context" in err_str:
            print(f"{Fore.RED}Browser context was closed during execution. Exiting agent loop.")
            break
        # We do not save failed attempts to history to prevent Llama-8B from repeating failures
        pass

    # 4. Check if finished
    if finished:
        break

    # 5. Take screenshot for step verification
    try:
        screenshot_name = f"step_{step}.png"
        agent.take_screenshot(screenshot_name)
    except Exception as e:
        print(f"{Fore.YELLOW}Could not save screenshot: {e}")
        
    print() # Add spacing between steps
    time.sleep(1)

# -----------------------------------
# POST-EXECUTION
# -----------------------------------
print(f"\n{Fore.CYAN}{Style.BRIGHT}=========================================")
print(f"{Fore.CYAN}{Style.BRIGHT}            Execution finished            ")
print(f"{Fore.CYAN}{Style.BRIGHT}=========================================")

if finished:
    print(f"\n{Fore.GREEN}{Style.BRIGHT}Goal Achieved!")
    print(f"{Fore.WHITE}{finish_message}\n")
else:
    print(f"\n{Fore.RED}{Style.BRIGHT}Failed to achieve goal within {max_steps} steps.\n")

# Keep browser open for inspection
input(f"{Fore.YELLOW}Press Enter to close browser...")

print("Closing browser context...")
agent.close()
print("Exiting.")