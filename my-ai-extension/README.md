# AI Browser Agent Chrome Extension (Manifest V3)

This Chrome Extension runs an autonomous AI browser agent directly inside your browser. It uses React/Vite for a premium sidepanel UI, scrapes webpage DOM using content scripts, orchestrates agent steps in a background service worker, and directly interacts with the DOM.

## Folder Structure

- `dist/`: The bundled Chrome extension output folder (load this folder in `chrome://extensions/` as unpacked).
- `public/`: Assets copied directly to `dist/` (includes `manifest.json`).
- `src/`: Extension source files.
  - `background/`: Coordinates agent loops and OpenRouter API calls.
  - `content/`: Scrapes DOM and performs tab clicks/typing.
  - `popup/`: Popup instruction dashboard launch button.
  - `sidepanel/`: Side panel UI React components.
  - `ai/`: DOM Analysis, action execution, and API client.
  - `utils/`: Storage helpers.
  - `styles/`: Stylesheet theme.

## Setup & Running

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Build the Extension**:
   ```bash
   npm run build
   ```
3. **Load in Chrome**:
   - Go to `chrome://extensions/` in Chrome.
   - Enable **Developer mode** (toggle in the top-right corner).
   - Click **Load unpacked** (button in the top-left corner).
   - Select the `dist/` folder inside the `my-ai-extension` directory.
4. **Use the Agent**:
   - Click the Side Panel icon in Chrome or click the extension action popup to launch the Side Panel.
   - Enter your OpenRouter API Key and set your goal!
