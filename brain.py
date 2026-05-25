import os
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables from .env file
load_dotenv()

class AIBrain:

    def __init__(self):

        api_key = os.getenv("OPENROUTER_API_KEY", "")
        if not api_key:
            api_key = os.getenv("GROQ_API_KEY", "")

        self.client = OpenAI(

            api_key=api_key,

            base_url="https://openrouter.ai/api/v1"
        )
        self.model = os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free")

    # -----------------------------------
    # CLEAN RESPONSE
    # -----------------------------------

    def _clean_response(self, response_text):

        import re

        # Extract code from markdown block if present
        pattern = r"```(?:python)?\s*(.*?)\s*```"

        matches = re.findall(pattern, response_text, re.DOTALL)

        if matches:

            return "\n".join(matches).strip()

        return response_text.strip()

    # -----------------------------------
    # THINK
    # -----------------------------------

    def think(self, user_goal, history, current_state, error_msg=None):

        history_str = "\n".join(f"- {action}" for action in history) if history else "None"

        elements = current_state.get('elements', [])
        if elements:
            elements_str = "\nInteractive Elements on Current Page:\n" + "\n".join(
                f"- Selector: {item['selector']}  --> Description: {item['description']}"
                for item in elements
            )
        else:
            elements_str = "\nInteractive Elements on Current Page: None found."

        prompt = f"""You are an AI browser agent working step-by-step to achieve a user's goal.

Ultimate Goal: {user_goal}

Available Tools:
1. open_website(url)
2. type_text(selector, text)
3. press_key(key)
4. click_element(selector)
5. scroll_down()
6. go_back()
7. finish(message) - Call this when you have successfully achieved the goal or cannot proceed. Explain what you found in the message.

Current Browser State:
- URL: {current_state.get('url', 'None')}
- Page Title: {current_state.get('title', 'None')}{elements_str}

- Page Content (truncated):
{current_state.get('text', '')[:1500]}

Execution History (Actions taken so far):
{history_str}
"""

        if error_msg:
            prompt += f"\nWarning: The previous action failed with error:\n{error_msg}\nPlease correct your selector or approach based on this error."

        prompt += """

Rules:
1. Return ONLY Python function calls to interact with the browser.
2. If you are finished or cannot make progress, you must call finish(message).
3. Do not include markdown code block syntax (like ```python) in your response. The executor will run it directly, so return plain Python.
4. Do not include any explanations, introduction, or commentary outside the code.
5. You MUST ONLY use selectors listed in the 'Interactive Elements on Current Page' section. Do NOT invent or guess selectors.
6. If the goal involves searching, playing a song, or watching a video:
   a. Locate the search input field and use type_text on it directly, then press_key("Enter"). Do NOT click random buttons first.
   b. Once the search results page loads, locate the video title or thumbnail (often using a selector like a:has-text("Song Name") or #thumbnail) and click_element on it to play/open it.
7. If your previous action failed, do NOT repeat the exact same action or selector. Try a different selector, scroll, or change your approach.
8. Do NOT click "Sign in", "Log in", or "Create account" buttons unless the goal explicitly specifies that you must log in. Public content (like search, Wikipedia, YouTube) does NOT require signing in.
9. DO NOT BLINDLY COPY EXAMPLE VALUES. You MUST substitute search terms (like "Song Name" or "Topic Name") with the actual search keywords and matching link text corresponding to the user's specific "Ultimate Goal".

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

Examples of finishing:
finish("The first sentence is: Python is a high-level, general-purpose programming language.")

Next Action(s):"""

        response = self.client.chat.completions.create(

            model=self.model,

            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.1,
            extra_body={"reasoning": {"enabled": True}}
        )

        raw_content = response.choices[0].message.content

        # Log prompt and response to a debug file
        try:
            with open("brain_debug.log", "a", encoding="utf-8") as f:
                f.write(f"\n=========================================\n")
                f.write(f"STEP PROMPT:\n")
                f.write(prompt)
                f.write(f"\n-----------------------------------------\n")
                f.write(f"RAW LLM RESPONSE:\n")
                f.write(raw_content)
                f.write(f"\n=========================================\n")
        except:
            pass

        return self._clean_response(raw_content)