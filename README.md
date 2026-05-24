# Autonomous Browser Agent

An advanced, self-correcting autonomous browser automation agent powered by Playwright and the Groq API (using Llama-3.1-8B-Instant). The agent observes the current browser viewport, reads the interactive elements (links, inputs, buttons), decides on the best next action, executes it, captures a screenshot, and repeats until the user-specified goal is accomplished.

## Features

- **Multi-Step Execution Loop**: Runs up to 15 autonomous steps to achieve the goal.
- **Dynamic DOM Inspection**: Extracts visible interactive element selectors and descriptions, feeding them to the AI to prevent "guessed" selectors.
- **Self-Correction & Recovery**: Catches execution errors (timeouts, incorrect clicks) and feeds them back to the AI for self-correction on subsequent steps.
- **Prevent Redundant Tabs**: Reuses the default persistent browser page rather than opening multiple blank tabs.
- **Fast Response Time**: Action and page timeouts are optimized to 5 seconds to prevent hanging.
- **Rich Logging**: Uses `colorama` for detailed, color-coded console logs.

---

## Prerequisites

- **Python 3.8+** installed on your system.
- **Google Chrome** installed (configured via Playwright's Chrome channel).
- **Groq API Key** (Get it from [console.groq.com](https://console.groq.com/)).

---

## Installation & Setup

If you clone or download this project from GitHub, follow these steps to run it:

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd <repository-directory>
```

### 2. Create and Activate a Virtual Environment
- **Windows (PowerShell)**:
  ```powershell
  python -m venv .venv
  .\.venv\Scripts\Activate.ps1
  ```
- **macOS/Linux**:
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  ```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Install Playwright Browsers
```bash
playwright install chromium
```
*(Note: Since the script uses `channel="chrome"`, it will attempt to launch your installed Google Chrome. You can also run `playwright install` to install default browsers).*

### 5. Setup Environment Variables
1. Copy the `.env.example` file to a new file named `.env`:
   - On Windows: `copy .env.example .env`
   - On macOS/Linux: `cp .env.example .env`
2. Open the `.env` file and enter your Groq API Key:
   ```env
   GROQ_API_KEY=gsk_your_actual_groq_api_key_here
   ```

---

## Running the Application

You can run this project either via the console command-line interface or using the web UI.

### Option A: Command-Line Interface (CLI)

Run the agent script:
```bash
python agent_loop.py
```
1. The console will prompt: **What do you want me to do?**
2. Enter your goal (e.g. *Go to wikipedia.org, search for Python programming language, and finish by telling me the first sentence.*)
3. The agent will launch Google Chrome and execute actions step-by-step, saving screenshots (`step_1.png`, etc.) at each iteration.
4. Once completed, it will call `finish(message)` and print the result.

### Option B: Web User Interface (Streamlit UI)

Launch the interactive web UI:
```bash
streamlit run app.py
```
This will automatically start a local server at `http://localhost:8501` and open the web dashboard in your browser. 
- You can specify your Groq API Key and task steps in the sidebar.
- Enter your goal in the main input and click **Start Agent**.
- The dashboard will show **Live Execution Logs** on the left and the **Live Browser Viewport Screenshots** on the right as the agent executes actions step-by-step in real-time!
