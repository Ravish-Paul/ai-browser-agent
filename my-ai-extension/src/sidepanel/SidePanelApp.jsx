import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getStorageData, setStorageData } from '../utils/storage';

/* ── helpers ─────────────────────────────────────────────────────── */
function timestamp() {
  const d = new Date();
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${mm}:${ss}`;
}

const CHIPS = [
  'Sab headings copy karo',
  'Links extract karo',
  'Form auto-fill karo',
  'Page summarize karo',
  'Screenshot lo',
];

/* ── Main Component ──────────────────────────────────────────────── */
export default function SidePanelApp() {
  /* state */
  const [activeTab, setActiveTab]       = useState('run');
  const [apiKey,    setApiKey]          = useState('');
  const [model,     setModel]           = useState('gemini-2.5-flash');
  const [maxSteps,  setMaxSteps]        = useState(10);
  const [goal,      setGoal]            = useState('');
  const [running,   setRunning]         = useState(false);
  const [currentStep, setCurrentStep]   = useState(0);
  const [logs,      setLogs]            = useState([
    { ts: '00:00', cls: 'log-ok',  sym: '✓', msg: 'Extension ready hai' },
    { ts: '00:01', cls: 'log-ok',  sym: '✓', msg: 'Page context load hua' },
  ]);
  const [historyItems, setHistoryItems] = useState([]);
  const [pageUrl,   setPageUrl]         = useState('chrome://newtab/');
  const [statusText, setStatusText]     = useState('Ready — page loaded');

  /* settings toggles */
  const [autoConfirm,    setAutoConfirm]    = useState(false);
  const [screenshotDone, setScreenshotDone] = useState(true);
  const [stealthMode,    setStealthMode]    = useState(false);
  const [smartReasoning, setSmartReasoning] = useState(true);
  const [activityLogOn,  setActivityLogOn]  = useState(true);

  const logRef = useRef(null);

  /* ── Push a log entry ──────────────────────────────────────────── */
  const pushLog = useCallback((cls, sym, msg) => {
    setLogs(prev => [...prev, { ts: timestamp(), cls, sym, msg }]);
  }, []);

  /* ── Auto-scroll log ───────────────────────────────────────────── */
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  /* ── Load stored settings ─────────────────────────────────────── */
  useEffect(() => {
    getStorageData(['apiKey', 'model', 'maxSteps', 'goal']).then(data => {
      if (data.apiKey)    setApiKey(data.apiKey);
      if (data.model)     setModel(data.model);
      if (data.maxSteps)  setMaxSteps(Number(data.maxSteps) || 10);
      if (data.goal)      setGoal(data.goal);
    });

    /* get current active tab URL */
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]?.url) setPageUrl(tabs[0].url);
      });
    }

    /* restore agent state if already running */
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'GET_AGENT_STATUS' }, response => {
        if (response?.state) {
          const s = response.state;
          setRunning(s.running);
          setCurrentStep(s.currentStep);
          setHistoryItems(s.history || []);
          if (s.logs?.length) {
            setLogs(s.logs.map((l, i) => ({ ts: timestamp(), cls: 'log-run', sym: '›', msg: l })));
          }
          if (s.running) setStatusText('Task chal raha hai…');
        }
      });
    }

    /* real-time message listener */
    const listener = (message) => {
      if (message.type === 'LOG_UPDATE') {
        const { state, log } = message;
        setCurrentStep(state.currentStep);
        setHistoryItems(state.history || []);
        setRunning(state.running);
        if (log) {
          let cls = 'log-run', sym = '›';
          if (log.includes('Success:') || log.includes('✓')) { cls = 'log-ok';  sym = '✓'; }
          if (log.includes('Error:')   || log.includes('✗')) { cls = 'log-err'; sym = '✗'; }
          pushLog(cls, sym, log.replace(/^\[\w+\]\s*/, ''));
        }
      }
      if (message.type === 'AGENT_FINISHED') {
        setRunning(false);
        setStatusText('Task complete ✓');
        pushLog('log-ok', '✓', 'Goal successfully complete hua!');
      }
      if (message.type === 'AGENT_STOPPED') {
        setRunning(false);
        setStatusText('Agent roka gaya');
        pushLog('log-err', '✗', 'Agent stopped by user');
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener(listener);
    }
    return () => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.removeListener(listener);
      }
    };
  }, [pushLog]);

  /* ── Start agent ──────────────────────────────────────────────── */
  const handleStart = async () => {
    if (!goal.trim()) {
      pushLog('log-err', '✗', 'Goal likhna zaroori hai!');
      return;
    }
    if (!apiKey.trim()) {
      setActiveTab('settings');
      pushLog('log-err', '✗', 'API Key daalni hai — Settings tab kholo');
      return;
    }
    await setStorageData({ apiKey, model, maxSteps, goal });
    setLogs([
      { ts: timestamp(), cls: 'log-run', sym: '›', msg: `Goal set: "${goal.slice(0, 50)}${goal.length > 50 ? '…' : ''}"` },
      { ts: timestamp(), cls: 'log-run', sym: '›', msg: 'Agent initialize ho raha hai…' },
    ]);
    setCurrentStep(0);
    setRunning(true);
    setStatusText('Task chal raha hai…');
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'START_AGENT', goal, apiKey, model, maxSteps });
    }
  };

  /* ── Stop agent ───────────────────────────────────────────────── */
  const handleStop = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'STOP_AGENT' }, () => setRunning(false));
    } else {
      setRunning(false);
    }
  };

  /* ── Chip click ───────────────────────────────────────────────── */
  const setChip = (txt) => {
    setGoal(txt);
    document.getElementById('prompt-input')?.focus();
  };

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="ext-shell">

      {/* ── Header ── */}
      <div className="ext-header">
        <div className="ext-logo">🤖</div>
        <div>
          <div className="ext-title">AutoPilot AI</div>
          <div className="ext-subtitle">In-browser automation agent</div>
        </div>
        <span className="ext-badge">{running ? 'RUNNING' : 'ACTIVE'}</span>
      </div>

      {/* ── Tab Bar ── */}
      <div className="tab-bar">
        {[
          { id: 'run',      icon: '▶', label: 'Run'      },
          { id: 'history',  icon: '⏱', label: 'History'  },
          { id: 'settings', icon: '⚙', label: 'Settings' },
        ].map(t => (
          <div
            key={t.id}
            className={`tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span style={{ fontSize: '11px' }}>{t.icon}</span>{t.label}
          </div>
        ))}
      </div>

      {/* ══════════ RUN PANEL ══════════ */}
      <div className={`panel ${activeTab === 'run' ? 'active' : ''}`} id="panel-run">

        {/* Status */}
        <div className="status-row">
          <div className={`status-dot ${running ? 'running' : ''}`} />
          <span className="status-text">{statusText}</span>
          {running && (
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
              Step {currentStep} / {maxSteps}
            </span>
          )}
        </div>

        {/* Current page */}
        <div className="current-page">
          <span>🌐</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pageUrl}
          </span>
        </div>

        {/* Prompt textarea */}
        <textarea
          id="prompt-input"
          className="prompt-box"
          placeholder="Kya karna hai? e.g., Search for 'best laptops' and open top 3 results…"
          value={goal}
          onChange={e => setGoal(e.target.value)}
          disabled={running}
        />

        {/* Quick chips */}
        <div className="quick-chips">
          {CHIPS.map(c => (
            <div key={c} className="chip" onClick={() => !running && setChip(c)}>{c}</div>
          ))}
        </div>

        {/* Run / Stop button */}
        <button
          className={`run-btn ${running ? 'stop' : ''}`}
          onClick={running ? handleStop : handleStart}
        >
          {running ? (
            <><span className="spin">⟳</span> Stop Agent</>
          ) : (
            <><span>⚡</span> Run Task</>
          )}
        </button>

        {/* Activity Log */}
        <div className="activity-log" ref={logRef}>
          {logs.map((l, i) => (
            <div key={i} className="log-line">
              <span className="log-ts">{l.ts}</span>
              <span className={l.cls}>{l.sym}</span>
              <span className="log-msg">{l.msg}</span>
            </div>
          ))}
        </div>

      </div>

      {/* ══════════ HISTORY PANEL ══════════ */}
      <div className={`panel ${activeTab === 'history' ? 'active' : ''}`} id="panel-history">
        <div className="section-label">Recent Tasks</div>

        {historyItems.length === 0 ? (
          <div style={{ color: 'var(--color-text-tertiary)', fontSize: '12px', marginTop: '8px' }}>
            Abhi koi task complete nahi hua.
          </div>
        ) : (
          historyItems.slice(-10).reverse().map((item, i) => (
            <div key={i} className="hist-item">
              <span className="hist-icon">⚡</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="hist-prompt">{typeof item === 'string' ? item : item.action || JSON.stringify(item)}</div>
                <div className="hist-meta">Step {historyItems.length - i}</div>
              </div>
              <span className="hist-status hist-done">done</span>
            </div>
          ))
        )}

        {/* Demo history items when no real ones */}
        {historyItems.length === 0 && (
          <>
            <div className="hist-item">
              <span className="hist-icon">⚡</span>
              <div style={{ flex: 1 }}>
                <div className="hist-prompt">Sab product prices scrape karo</div>
                <div className="hist-meta">amazon.in · 2 min ago</div>
              </div>
              <span className="hist-status hist-done">done</span>
            </div>
            <div className="hist-item">
              <span className="hist-icon">⚡</span>
              <div style={{ flex: 1 }}>
                <div className="hist-prompt">Login form fill karke submit karo</div>
                <div className="hist-meta">example.com · 18 min ago</div>
              </div>
              <span className="hist-status hist-done">done</span>
            </div>
            <div className="hist-item">
              <span className="hist-icon">⚡</span>
              <div style={{ flex: 1 }}>
                <div className="hist-prompt">Table data JSON me convert karo</div>
                <div className="hist-meta">docs.google.com · 2 hr ago</div>
              </div>
              <span className="hist-status hist-fail">failed</span>
            </div>
          </>
        )}
      </div>

      {/* ══════════ SETTINGS PANEL ══════════ */}
      <div className={`panel ${activeTab === 'settings' ? 'active' : ''}`} id="panel-settings">

        {/* API Config */}
        <div className="section-label">API Configuration</div>

        <div style={{ marginBottom: '10px' }}>
          <label className="field-label">API Key (Gemini / OpenRouter / Groq)</label>
          <input
            type="password"
            className="input-field"
            placeholder="AIzaSy… / sk-or-… / gsk_…"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onBlur={() => setStorageData({ apiKey })}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label className="field-label">LLM Model</label>
          <input
            type="text"
            className="input-field"
            placeholder="gemini-2.5-flash / openrouter/free"
            value={model}
            onChange={e => setModel(e.target.value)}
            onBlur={() => setStorageData({ model })}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            Max Steps: <strong style={{ color: 'var(--color-accent)' }}>{maxSteps}</strong>
          </span>
          <input
            type="range" min="1" max="30" value={maxSteps}
            onChange={e => { setMaxSteps(Number(e.target.value)); setStorageData({ maxSteps: Number(e.target.value) }); }}
            style={{ width: '110px' }}
          />
        </div>

        {/* Automation toggles */}
        <div className="section-label">Automation</div>

        {[
          { label: 'Auto-confirm actions',   desc: 'Bina pooche kaam kare',           val: autoConfirm,    set: setAutoConfirm    },
          { label: 'Screenshot on complete', desc: 'Har task ke baad screenshot',      val: screenshotDone, set: setScreenshotDone },
          { label: 'Stealth mode',           desc: 'Bot detection bypass kare',        val: stealthMode,    set: setStealthMode    },
        ].map(t => (
          <div key={t.label} className="toggle-row">
            <div>
              <div className="toggle-label">{t.label}</div>
              <div className="toggle-desc">{t.desc}</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={t.val} onChange={e => t.set(e.target.checked)} />
              <span className="slider-sw" />
            </label>
          </div>
        ))}

        <div className="section-label">AI Model</div>

        {[
          { label: 'Smart reasoning', desc: 'Complex tasks ke liye extended thinking', val: smartReasoning, set: setSmartReasoning },
          { label: 'Activity log',    desc: 'Har step ko log karo',                    val: activityLogOn,  set: setActivityLogOn  },
        ].map(t => (
          <div key={t.label} className="toggle-row">
            <div>
              <div className="toggle-label">{t.label}</div>
              <div className="toggle-desc">{t.desc}</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={t.val} onChange={e => t.set(e.target.checked)} />
              <span className="slider-sw" />
            </label>
          </div>
        ))}

      </div>

      {/* ── Footer ── */}
      <div className="ext-footer">
        <span className="footer-info">AutoPilot AI v1.0.0</span>
        <span className="footer-link" onClick={() => setActiveTab('settings')}>API Settings</span>
      </div>

    </div>
  );
}
