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
  
  // UI Tabs and Settings Toggles
  const [activeTab, setActiveTab] = useState('run');
  const [currentUrl, setCurrentUrl] = useState('chrome://newtab/');
  const [showLiveScreen, setShowLiveScreen] = useState(false);
  const [liveScreenshot, setLiveScreenshot] = useState(null);
  const [screenSize, setScreenSize] = useState('medium');
  const [pastTasks, setPastTasks] = useState([]);

  // Mock setting toggles matching mockup
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [screenshotOnComplete, setScreenshotOnComplete] = useState(true);
  const [stealthMode, setStealthMode] = useState(false);

  const terminalRef = useRef(null);

  // 1. Initial configuration load
  useEffect(() => {
    getStorageData(['apiKey', 'model', 'maxSteps', 'goal', 'pastTasks', 'autoConfirm', 'screenshotOnComplete', 'stealthMode']).then((data) => {
      if (data.apiKey) setApiKey(data.apiKey);
      if (data.model) setModel(data.model);
      if (data.maxSteps) setMaxSteps(Number(data.maxSteps) || 10);
      if (data.goal) setGoal(data.goal);
      if (data.pastTasks) {
        setPastTasks(Array.isArray(data.pastTasks) ? data.pastTasks : JSON.parse(data.pastTasks));
      }
      if (data.autoConfirm !== undefined) setAutoConfirm(!!data.autoConfirm);
      if (data.screenshotOnComplete !== undefined) setScreenshotOnComplete(!!data.screenshotOnComplete);
      if (data.stealthMode !== undefined) setStealthMode(!!data.stealthMode);
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

    // 2. Real-time active tab URL listener
    const updateActiveTabUrl = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab && tab.url) {
          setCurrentUrl(tab.url);
        }
      });
    };

    const tabUpdateListener = (activeInfo) => {
      chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab && tab.url) {
          setCurrentUrl(tab.url);
        }
      });
    };
    
    const tabNavigationListener = (tabId, changeInfo, tab) => {
      if (changeInfo.url && tab.active) {
        setCurrentUrl(changeInfo.url);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      updateActiveTabUrl();
      chrome.tabs.onActivated.addListener(tabUpdateListener);
      chrome.tabs.onUpdated.addListener(tabNavigationListener);
    }

    // 3. Listen to real-time logs and live screens from background script
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
        alert(`Goal Completed! \n\n${message.message}`);
        
        // Log to persistent history
        addPastTask({
          prompt: goal,
          url: currentUrl,
          status: 'done',
          time: 'Just now',
          steps: currentStep || 1
        });
      }

      if (message.type === 'AGENT_STOPPED') {
        setRunning(false);
        // Log to persistent history if stopped/failed
        addPastTask({
          prompt: goal,
          url: currentUrl,
          status: 'failed',
          time: 'Just now',
          steps: currentStep || 1
        });
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener(messageListener);
    }

    return () => {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.onActivated.removeListener(tabUpdateListener);
        chrome.tabs.onUpdated.removeListener(tabNavigationListener);
      }
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
    };
  }, [goal, currentUrl, currentStep]);

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

  // Persist a new run in the history list
  const addPastTask = (newTask) => {
    setPastTasks(prev => {
      const updated = [newTask, ...prev].slice(0, 15);
      setStorageData({ pastTasks: updated });
      return updated;
    });
  };

  // Start agent loop
  const handleStart = async () => {
    if (!goal.trim()) {
      alert('Please specify a goal!');
      return;
    }
    if (!apiKey.trim()) {
      alert('Please specify your API Key in the Settings tab!');
      setActiveTab('settings');
      return;
    }

    // Save configurations
    await setStorageData({ apiKey, model, maxSteps, goal, autoConfirm, screenshotOnComplete, stealthMode });

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

  // Helper to colorize terminal logs
  const renderColoredLog = (log, index) => {
    let typeClass = 'log-ts';
    let icon = '›';
    
    if (log.includes('[SYSTEM]')) {
      typeClass = 'log-run';
      icon = '⚙';
    } else if (log.includes('--- Step')) {
      typeClass = 'log-run';
      icon = '⚡';
    } else if (log.includes('Success:')) {
      typeClass = 'log-ok';
      icon = '✓';
    } else if (log.includes('Execution Error:') || log.includes('Error:')) {
      typeClass = 'log-err';
      icon = '✗';
    } else if (log.includes('Goal Finished:') || log.includes('Goal Completed!')) {
      typeClass = 'log-ok';
      icon = '★';
    }
    
    return (
      <div key={index} className="log-line">
        <span className="log-ts">[{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}]</span>
        <span className={typeClass}>{icon}</span>
        <span style={{ flex: 1 }}>{log.replace(/\[SYSTEM\]|Success:|Execution Error:|Error:|Goal Finished:/g, '').trim()}</span>
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      
      {/* Header Panel */}
      <div className="ext-header">
        <div className="ext-logo">
          <i className="ti ti-robot" style={{ color: '#fff', fontSize: '15px' }}></i>
        </div>
        <div>
          <div className="ext-title">AutoPilot AI</div>
        </div>
        <span className={`ext-badge ${running ? '' : 'idle'}`}>
          {running ? 'ACTIVE' : 'IDLE'}
        </span>
      </div>

      {/* Tabs Navigation */}
      <div className="tab-bar">
        <div className={`tab ${activeTab === 'run' ? 'active' : ''}`} onClick={() => setActiveTab('run')}>
          <i className="ti ti-player-play"></i>Run
        </div>
        <div className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <i className="ti ti-history"></i>History
        </div>
        <div className={`tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          <i className="ti ti-settings"></i>Settings
        </div>
      </div>

      {/* RUN Tab Panel */}
      <div className={`panel ${activeTab === 'run' ? 'active' : ''}`} style={{ flex: 1, overflowY: 'auto' }}>
        <div className="status-row">
          <div className={`dot ${running ? '' : 'idle'}`}></div>
          <span className="status-text">
            {running ? 'Agent executing actions...' : 'Ready — tab page loaded'}
          </span>
        </div>

        <div className="current-page">
          <i className="ti ti-world"></i>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {currentUrl}
          </span>
        </div>

        <textarea 
          className="prompt-box" 
          placeholder="Kya karna hai? e.g. Open youtube.com and play a old songs..."
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          disabled={running}
        />

        <div className="quick-chips">
          <div className="chip" onClick={() => setGoal('Open youtube.com, search for a Hindi old song and play it')}>Hindi old song bajao</div>
          <div className="chip" onClick={() => setGoal('Open wikipedia.org, search for Python programming language and summarize it')}>Python summarize karo</div>
          <div className="chip" onClick={() => setGoal('Open google.com and search for latest AI news')}>Latest AI news search karo</div>
        </div>

        {!running ? (
          <button className="run-btn" onClick={handleStart}>
            <i className="ti ti-bolt"></i>Run Autopilot
          </button>
        ) : (
          <button className="run-btn" onClick={handleStop} style={{ background: 'var(--error)' }}>
            <i className="ti ti-hand-stop"></i>Stop Autopilot
          </button>
        )}

        {/* Live Preview Viewport inside Run Panel */}
        <div className="glass-card" style={{ padding: '10px 12px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>
              📺 Live Browser Viewport
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {showLiveScreen && (
                <div style={{ display: 'flex', gap: '3px' }}>
                  {['small', 'medium', 'large'].map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setScreenSize(sz)}
                      className="btn-secondary"
                      style={{
                        padding: '1px 5px',
                        fontSize: '9px',
                        height: '18px',
                        borderRadius: '3px',
                        background: screenSize === sz ? 'var(--accent-primary)' : 'rgba(255,255,255,0.03)',
                        borderColor: screenSize === sz ? 'var(--accent-primary)' : 'var(--border-glass)',
                        color: '#fff'
                      }}
                    >
                      {sz[0].toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
              <button
                className={`btn-secondary ${showLiveScreen ? 'active' : ''}`}
                onClick={() => setShowLiveScreen(!showLiveScreen)}
                style={{
                  padding: '2px 8px',
                  fontSize: '10px',
                  height: '20px',
                  borderRadius: '4px',
                  backgroundColor: showLiveScreen ? 'rgba(108, 99, 255, 0.2)' : 'rgba(255,255,255,0.04)',
                  borderColor: showLiveScreen ? 'var(--accent-primary)' : 'var(--border-glass)'
                }}
              >
                {showLiveScreen ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {showLiveScreen && (
            <div style={{ 
              width: '100%', 
              height: getViewportHeight(), 
              backgroundColor: '#040508', 
              borderRadius: '6px', 
              border: '1px solid var(--border-glass)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              {liveScreenshot ? (
                <img src={liveScreenshot} alt="Live Viewport" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Awaiting stream...</span>
              )}
            </div>
          )}
        </div>

        <div className="section-label">Execution Console Logs</div>
        <div ref={terminalRef} className="activity-log">
          {logs.length === 0 ? (
            <div className="log-line">
              <span className="log-ts">[00:00]</span>
              <span className="log-ok">✓</span>
              <span>Autopilot waiting for goal prompt...</span>
            </div>
          ) : (
            logs.map((log, i) => renderColoredLog(log, i))
          )}
        </div>
      </div>

      {/* HISTORY Tab Panel */}
      <div className={`panel ${activeTab === 'history' ? 'active' : ''}`} style={{ flex: 1, overflowY: 'auto' }}>
        <div className="section-label">Recent Tasks Log</div>
        {pastTasks.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '12px 0' }}>
            No past tasks executed yet.
          </p>
        ) : (
          pastTasks.map((task, idx) => (
            <div key={idx} className="hist-item">
              <i className="ti ti-bolt hist-icon"></i>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div className="hist-prompt" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {task.prompt}
                </div>
                <div className="hist-meta">
                  {task.url.replace(/https?:\/\/(www\.)?/, '').substring(0, 30)} · {task.time} · {task.steps} steps
                </div>
              </div>
              <span className={`hist-status ${task.status === 'done' ? 'hist-done' : 'hist-fail'}`}>
                {task.status}
              </span>
            </div>
          ))
        )}
      </div>

      {/* SETTINGS Tab Panel */}
      <div className={`panel ${activeTab === 'settings' ? 'active' : ''}`} style={{ flex: 1, overflowY: 'auto' }}>
        <div className="section-label">API Configuration</div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            API Key (OpenRouter, Groq, or Gemini)
          </label>
          <input
            type="password"
            className="input-field"
            placeholder="sk-or-... / gsk_... / AIzaSy..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Base endpoint is auto-detected by key prefix.
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            LLM Model Name
          </label>
          <input
            type="text"
            className="input-field"
            placeholder="gemini-2.5-flash / groq/compound"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Max Steps Limit: <strong style={{ color: 'var(--accent-primary)' }}>{maxSteps} steps</strong>
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

        <div className="section-label">Automation Controls</div>
        
        <div className="toggle-row">
          <div>
            <div className="toggle-label">Auto-confirm actions</div>
            <div className="toggle-desc">Execute plans autonomously</div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={autoConfirm} onChange={(e) => setAutoConfirm(e.target.checked)} />
            <span className="slider-sw"></span>
          </label>
        </div>

        <div className="toggle-row">
          <div>
            <div className="toggle-label">Screenshot on complete</div>
            <div className="toggle-desc">Capture active viewport after task</div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={screenshotOnComplete} onChange={(e) => setScreenshotOnComplete(e.target.checked)} />
            <span className="slider-sw"></span>
          </label>
        </div>

        <div className="toggle-row">
          <div>
            <div className="toggle-label">Stealth mode</div>
            <div className="toggle-desc">Apply user-agent automation bypasses</div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={stealthMode} onChange={(e) => setStealthMode(e.target.checked)} />
            <span className="slider-sw"></span>
          </label>
        </div>
      </div>

      {/* Footer */}
      <div className="ext-footer">
        <span className="footer-info">AutoPilot AI v1.1.0</span>
        <span className="footer-link" onClick={() => setActiveTab('settings')}>
          API Settings
        </span>
      </div>

    </div>
  );
}
