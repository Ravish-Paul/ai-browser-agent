import React, { useState, useEffect, useRef } from 'react';
import { getStorageData, setStorageData } from '../utils/storage';

export default function SidePanelApp() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [goal, setGoal] = useState('');
  const [maxSteps, setMaxSteps] = useState(10);
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('run'); // 'run', 'history', 'settings'
  const [currentUrl, setCurrentUrl] = useState('chrome://newtab/');

  // Settings states
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [screenshotOnComplete, setScreenshotOnComplete] = useState(true);
  const [stealthMode, setStealthMode] = useState(false);
  const [smartReasoning, setSmartReasoning] = useState(true);
  const [activityLog, setActivityLog] = useState(true);

  // Live viewport preview states
  const [showLiveScreen, setShowLiveScreen] = useState(false);
  const [liveScreenshot, setLiveScreenshot] = useState(null);
  const [screenSize, setScreenSize] = useState('medium'); // small, medium, large

  // History list state
  const [pastTasks, setPastTasks] = useState([]);

  const terminalRef = useRef(null);

  // Quick prompt chips
  const quickChips = [
    { label: "Headings copy karo", text: "Page scroll karke sab headings copy karo" },
    { label: "Links extract karo", text: "Sab links ek list me nikalo" },
    { label: "Form fill karo", text: "Is form ko auto-fill karo" },
    { label: "Screenshot lo", text: "Screenshot le aur download karo" },
    { label: "Page summarize karo", text: "Page ka summary banao" }
  ];

  // Query active tab URL
  const updateActiveTabUrl = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab && tab.url) {
          setCurrentUrl(tab.url);
        }
      });
    }
  };

  useEffect(() => {
    updateActiveTabUrl();
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const handleActivated = () => updateActiveTabUrl();
      const handleUpdated = (tabId, changeInfo) => {
        if (changeInfo.url) updateActiveTabUrl();
      };
      
      chrome.tabs.onActivated.addListener(handleActivated);
      chrome.tabs.onUpdated.addListener(handleUpdated);
      return () => {
        chrome.tabs.onActivated.removeListener(handleActivated);
        chrome.tabs.onUpdated.removeListener(handleUpdated);
      };
    }
  }, []);

  // 1. Load initial configs from chrome storage
  useEffect(() => {
    getStorageData(['apiKey', 'model', 'maxSteps', 'goal', 'pastTasks', 'autoConfirm', 'stealthMode', 'screenshotOnComplete', 'smartReasoning', 'activityLog', 'showLiveScreen']).then((data) => {
      if (data.apiKey) setApiKey(data.apiKey);
      if (data.model) setModel(data.model);
      if (data.maxSteps) setMaxSteps(Number(data.maxSteps) || 10);
      if (data.goal) setGoal(data.goal);

      // Load settings toggles
      if (data.autoConfirm !== undefined) setAutoConfirm(!!data.autoConfirm);
      if (data.stealthMode !== undefined) setStealthMode(!!data.stealthMode);
      if (data.screenshotOnComplete !== undefined) setScreenshotOnComplete(data.screenshotOnComplete !== false);
      if (data.smartReasoning !== undefined) setSmartReasoning(data.smartReasoning !== false);
      if (data.activityLog !== undefined) setActivityLog(data.activityLog !== false);
      if (data.showLiveScreen !== undefined) setShowLiveScreen(!!data.showLiveScreen);

      // Load past tasks history
      if (data.pastTasks) {
        setPastTasks(JSON.parse(data.pastTasks));
      } else {
        const dummyTasks = [
          { goal: "Sab product prices scrape karo aur CSV me save karo", timestamp: "amazon.in · 2 min ago", status: "done" },
          { goal: "Login form fill karke submit karo", timestamp: "example.com · 18 min ago", status: "done" },
          { goal: "Sab images download karo", timestamp: "unsplash.com · 1 hr ago", status: "failed" },
          { goal: "Table data JSON me convert karo", timestamp: "docs.google.com · 2 hr ago", status: "done" }
        ];
        setPastTasks(dummyTasks);
        setStorageData({ pastTasks: JSON.stringify(dummyTasks) });
      }
    });

    // Check status of background agent on startup
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'GET_AGENT_STATUS' }, (response) => {
        if (response && response.state) {
          const { state } = response;
          setRunning(state.running);
          setCurrentStep(state.currentStep);
          setHistory(state.history);
          setLogs(state.logs);
          if (state.lastScreenshot) {
            setLiveScreenshot(state.lastScreenshot);
          }
        }
      });
    }

    // 2. Listen to real-time logs and live screens from background script
    const messageListener = (message) => {
      if (message.type === 'LOG_UPDATE') {
        const { state, log } = message;
        setLogs(prev => [...prev, log]);
        setCurrentStep(state.currentStep);
        setHistory(state.history);
        setRunning(state.running);
        if (state.lastScreenshot) {
          setLiveScreenshot(state.lastScreenshot);
        }
      }
      
      if (message.type === 'LIVE_SCREEN_UPDATE') {
        setLiveScreenshot(message.dataUrl);
      }
      
      if (message.type === 'AGENT_FINISHED') {
        setRunning(false);
        saveTaskToHistory(message.message || 'Done', true);
      }

      if (message.type === 'AGENT_STOPPED') {
        setRunning(false);
        saveTaskToHistory('Stopped by user', false);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener(messageListener);
    }

    return () => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
    };
  }, [goal, currentUrl]);

  // Sync live screen stream state with background script
  useEffect(() => {
    if (showLiveScreen && typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'START_LIVE_STREAM' });
    } else if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'STOP_LIVE_STREAM' });
    }
  }, [showLiveScreen]);

  // Auto scroll terminal to bottom on logs update
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Start agent loop
  const handleStart = async () => {
    if (!goal.trim()) {
      alert('Please specify a goal!');
      return;
    }
    if (!apiKey.trim()) {
      alert('Please specify your API Key!');
      return;
    }

    // Save configurations
    await setStorageData({ apiKey, model, maxSteps, goal });

    setLogs(['[SYSTEM] Initializing Agent...', `[SYSTEM] Target Goal: "${goal}"`]);
    setCurrentStep(0);
    setHistory([]);
    setRunning(true);

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'START_AGENT',
        goal,
        apiKey,
        model,
        maxSteps
      });
    }
  };

  // Stop agent loop
  const handleStop = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'STOP_AGENT' }, () => {
        setRunning(false);
      });
    } else {
      setRunning(false);
    }
  };

  const handleToggle = (key, val, setter) => {
    setter(val);
    setStorageData({ [key]: val });
  };

  const saveTaskToHistory = (detailsText, isSuccess) => {
    let domain = 'unknown';
    try {
      domain = currentUrl ? new URL(currentUrl).hostname : 'page';
    } catch (e) {}

    const newEntry = {
      goal: goal || 'Task execution',
      timestamp: `${domain} · Just now`,
      status: isSuccess ? 'done' : 'failed'
    };

    getStorageData(['pastTasks']).then((data) => {
      let list = [];
      try {
        list = data.pastTasks ? JSON.parse(data.pastTasks) : [];
      } catch (e) {}
      
      list.unshift(newEntry);
      if (list.length > 15) list.pop();
      
      setStorageData({ pastTasks: JSON.stringify(list) });
      setPastTasks(list);
    });
  };

  const renderColoredLog = (log, index) => {
    let color = 'var(--text-primary)';
    let fontWeight = 'normal';
    
    if (log.includes('[SYSTEM]')) {
      color = '#00c9a7'; // Mint/Green
      fontWeight = '500';
    } else if (log.includes('--- Step')) {
      color = '#6c63ff'; // Accent Indigo
      fontWeight = '600';
    } else if (log.includes('AI Plan:') || log.includes('AI is thinking...')) {
      color = '#9ca3af'; // Text secondary
    } else if (log.includes('Success:')) {
      color = '#00c9a7'; // Teal
    } else if (log.includes('Execution Error:') || log.includes('Error:')) {
      color = '#e24b4a'; // Red
      fontWeight = '500';
    } else if (log.includes('Goal Finished:') || log.includes('Goal Completed!')) {
      color = '#f59e0b'; // Gold
      fontWeight = '600';
    }
    
    return (
      <div key={index} style={{ color, fontWeight, marginBottom: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {log}
      </div>
    );
  };

  const getViewportHeight = () => {
    switch (screenSize) {
      case 'small': return '120px';
      case 'large': return '280px';
      case 'medium':
      default:
        return '180px';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', gap: '0', background: 'var(--bg-primary)' }}>
      
      {/* Extension Header */}
      <div style={{ background: '#0a0b0e', padding: '14px 16px 12px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-glass)' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'linear-gradient(135deg, #6c63ff, #00c9a7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>A</span>
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600', fontFamily: 'Outfit, sans-serif' }}>AutoPilot AI</div>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: '#121318', color: running ? 'var(--accent-secondary)' : '#888', border: running ? '0.5px solid var(--accent-secondary)' : '0.5px solid var(--border-glass)', fontWeight: '500', letterSpacing: '0.5px' }}>
          {running ? 'RUNNING' : 'ACTIVE'}
        </span>
      </div>

      {/* Tab bar navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-secondary)' }}>
        <div 
          onClick={() => setActiveTab('run')}
          style={{ flex: 1, fontSize: '12px', padding: '10px 0', textAlign: 'center', color: activeTab === 'run' ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer', borderBottom: activeTab === 'run' ? '2px solid var(--accent-primary)' : '2px solid transparent', background: activeTab === 'run' ? 'var(--bg-primary)' : 'transparent', fontWeight: activeTab === 'run' ? '600' : 'normal', transition: 'all 0.15s' }}
        >
          Run
        </div>
        <div 
          onClick={() => setActiveTab('history')}
          style={{ flex: 1, fontSize: '12px', padding: '10px 0', textAlign: 'center', color: activeTab === 'history' ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer', borderBottom: activeTab === 'history' ? '2px solid var(--accent-primary)' : '2px solid transparent', background: activeTab === 'history' ? 'var(--bg-primary)' : 'transparent', fontWeight: activeTab === 'history' ? '600' : 'normal', transition: 'all 0.15s' }}
        >
          History
        </div>
        <div 
          onClick={() => setActiveTab('settings')}
          style={{ flex: 1, fontSize: '12px', padding: '10px 0', textAlign: 'center', color: activeTab === 'settings' ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer', borderBottom: activeTab === 'settings' ? '2px solid var(--accent-primary)' : '2px solid transparent', background: activeTab === 'settings' ? 'var(--bg-primary)' : 'transparent', fontWeight: activeTab === 'settings' ? '600' : 'normal', transition: 'all 0.15s' }}
        >
          Settings
        </div>
      </div>

      {/* Main panel container */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* PANEL: RUN */}
        {activeTab === 'run' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`status-indicator ${running ? 'active' : 'idle'}`}></span>
              <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                {running ? 'Running — task in progress...' : 'Ready — page loaded'}
              </span>
            </div>

            <div style={{ fontSize: '11px', padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🌐</span>
              <span>{currentUrl}</span>
            </div>

            <textarea
              className="input-field"
              rows="3"
              placeholder="Kya karna hai? e.g., Search for 'best laptops' and open top 3 results..."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={running}
              style={{ resize: 'none', lineHeight: '1.5', fontSize: '13px' }}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {quickChips.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => setGoal(chip.text)}
                  disabled={running}
                  className="chip"
                  style={{ fontSize: '11px', padding: '5px 11px', borderRadius: '999px', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', cursor: 'pointer', background: 'var(--bg-secondary)', transition: 'all 0.12s' }}
                  onMouseOver={(e) => { e.currentTarget.style.color = 'var(--accent-primary)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.background = 'rgba(108, 99, 255, 0.08)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-glass)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {!running ? (
              <button className="btn-primary" onClick={handleStart} style={{ width: '100%' }}>
                🚀 Run Task
              </button>
            ) : (
              <button className="btn-primary" onClick={handleStop} style={{ width: '100%', background: 'var(--error)', boxShadow: '0 4px 12px rgba(226, 75, 74, 0.25)' }}>
                🛑 Stop Task
              </button>
            )}

            {/* Live Viewport Screen (Optional visual feedback) */}
            {showLiveScreen && (
              <div className="glass-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: '500', color: 'var(--text-secondary)' }}>📺 Live Screen Viewport</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['small', 'medium', 'large'].map((sz) => (
                      <button
                        key={sz}
                        onClick={() => setScreenSize(sz)}
                        className="btn-secondary"
                        style={{ padding: '2px 5px', fontSize: '9px', height: '18px', borderRadius: '3px', background: screenSize === sz ? 'var(--accent-primary)' : 'rgba(255,255,255,0.03)', borderColor: 'var(--border-glass)', color: '#fff' }}
                      >
                        {sz[0].toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ width: '100%', height: getViewportHeight(), backgroundColor: '#040508', borderRadius: '6px', border: '1px solid var(--border-glass)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {liveScreenshot ? (
                    <img src={liveScreenshot} alt="Viewport" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Awaiting screen frames...</span>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minHeight: '130px' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>📜 Activity Log</span>
              <div 
                ref={terminalRef} 
                className="terminal-box" 
                style={{ flex: 1, minHeight: '120px' }}
              >
                {logs.length === 0 ? (
                  <div className="log-line"><span className="log-ts">00:00</span><span className="log-ok" style={{ color: 'var(--accent-secondary)', marginRight: '6px' }}>✓</span><span>Extension ready hai</span></div>
                ) : (
                  logs.map((log, i) => renderColoredLog(log, i))
                )}
              </div>
            </div>
          </>
        )}

        {/* PANEL: HISTORY */}
        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recent Tasks</span>
            {pastTasks.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 0', borderBottom: '1px solid var(--border-glass)' }}>
                <span style={{ color: 'var(--accent-primary)', fontSize: '14px', marginTop: '1px' }}>⚡</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', lineHeight: '1.4' }}>{item.goal}</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '3px' }}>{item.timestamp}</div>
                </div>
                <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: '500', background: item.status === 'done' ? 'rgba(0,201,167,0.1)' : 'rgba(226,75,74,0.1)', color: item.status === 'done' ? 'var(--accent-secondary)' : 'var(--error)', border: item.status === 'done' ? '0.5px solid rgba(0,201,167,0.3)' : '0.5px solid rgba(226,75,74,0.3)' }}>
                  {item.status}
                </span>
              </div>
            ))}
            {pastTasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                No task history found.
              </div>
            )}
          </div>
        )}

        {/* PANEL: SETTINGS */}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* Automation Toggles */}
            <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Automation</span>
            
            <div className="toggle-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Auto-confirm actions</div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Bina pooche kaam kare</div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={autoConfirm} onChange={(e) => handleToggle('autoConfirm', e.target.checked, setAutoConfirm)} />
                <span className="slider-sw"></span>
              </label>
            </div>

            <div className="toggle-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Screenshot on complete</div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Har task ke baad screenshot</div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={screenshotOnComplete} onChange={(e) => handleToggle('screenshotOnComplete', e.target.checked, setScreenshotOnComplete)} />
                <span className="slider-sw"></span>
              </label>
            </div>

            <div className="toggle-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Stealth mode</div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Bot detection bypass kare</div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={stealthMode} onChange={(e) => handleToggle('stealthMode', e.target.checked, setStealthMode)} />
                <span className="slider-sw"></span>
              </label>
            </div>

            <div className="toggle-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Live viewport screen</div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Browser tab ko live preview kare (12 FPS)</div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={showLiveScreen} onChange={(e) => handleToggle('showLiveScreen', e.target.checked, setShowLiveScreen)} />
                <span className="slider-sw"></span>
              </label>
            </div>

            {/* AI Model Settings */}
            <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '8px' }}>AI Model Configurations</span>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  API Key (OpenRouter, Groq, or Gemini)
                </label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="sk-or-... / gsk_... / AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                  Endpoint auto-routed based on key prefix.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  LLM Model Name
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="gemini-2.5-flash / groq/compound / openrouter/free"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  Max Step Limit: <strong style={{ color: 'var(--accent-secondary)' }}>{maxSteps} steps</strong>
                </span>
                <input
                  type="range"
                  min="1"
                  max="25"
                  value={maxSteps}
                  onChange={(e) => setMaxSteps(Number(e.target.value))}
                  style={{ width: '100px', accentColor: 'var(--accent-primary)' }}
                />
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Footer */}
      <div style={{ padding: '10px 16px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-glass)', display: 'flex', alignHover: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>AutoPilot AI v1.0.0</span>
        <span 
          onClick={() => setActiveTab('settings')}
          style={{ fontSize: '10px', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: '500' }}
        >
          API Settings
        </span>
      </div>

    </div>
  );
}
