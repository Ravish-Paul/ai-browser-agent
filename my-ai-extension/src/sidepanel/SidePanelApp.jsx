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
  const [showSettings, setShowSettings] = useState(true);

  // Live screenshot states
  const [showLiveScreen, setShowLiveScreen] = useState(false);
  const [liveScreenshot, setLiveScreenshot] = useState(null);
  const [screenSize, setScreenSize] = useState('medium'); // small, medium, large

  const terminalRef = useRef(null);

  // 1. Load initial configs from chrome storage
  useEffect(() => {
    getStorageData(['apiKey', 'model', 'maxSteps', 'goal']).then((data) => {
      if (data.apiKey) setApiKey(data.apiKey);
      if (data.model) setModel(data.model);
      if (data.maxSteps) setMaxSteps(Number(data.maxSteps) || 10);
      if (data.goal) setGoal(data.goal);
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
          if (state.running) {
            setShowSettings(false); // Hide settings during active run
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
        alert(`Goal Completed! \n\n${message.message}`);
      }

      if (message.type === 'AGENT_STOPPED') {
        setRunning(false);
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
  }, []);

  // Sync live screen stream state with background script
  useEffect(() => {
    if (showLiveScreen && typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'START_LIVE_STREAM' });
    } else if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'STOP_LIVE_STREAM' });
    }
  }, [showLiveScreen]);

  // 3. Auto scroll terminal to bottom on logs update
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  // 4. Start agent loop
  const handleStart = async () => {
    if (!goal.trim()) {
      alert('Please specify a goal!');
      return;
    }
    if (!apiKey.trim()) {
      alert('Please specify your OpenRouter API Key!');
      return;
    }

    // Save configurations
    await setStorageData({ apiKey, model, maxSteps, goal });

    setLogs(['[SYSTEM] Initializing Agent...', `[SYSTEM] Target Goal: "${goal}"`]);
    setCurrentStep(0);
    setHistory([]);
    setRunning(true);
    setShowSettings(false);

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

  // 5. Stop agent loop
  const handleStop = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'STOP_AGENT' }, () => {
        setRunning(false);
      });
    } else {
      setRunning(false);
    }
  };

  const renderColoredLog = (log, index) => {
    let color = 'var(--text-primary)';
    let fontWeight = 'normal';
    
    if (log.includes('[SYSTEM]')) {
      color = '#61afef'; // Cyan/Blue
      fontWeight = '500';
    } else if (log.includes('--- Step')) {
      color = '#ec4899'; // Hot pink accent
      fontWeight = '600';
    } else if (log.includes('AI Plan:') || log.includes('AI is thinking...')) {
      color = '#c678dd'; // Purple
    } else if (log.includes('Success:')) {
      color = '#4ec9b0'; // Teal/Green
    } else if (log.includes('Execution Error:') || log.includes('Error:')) {
      color = '#f44747'; // Red
      fontWeight = '500';
    } else if (log.includes('Goal Finished:') || log.includes('Goal Completed!')) {
      color = '#e5c07b'; // Gold
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
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100vh', gap: '16px', overflowY: 'auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '20px', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🤖 AI Browser Agent
          </h1>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>In-browser automation agent</p>
        </div>
        
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--border-glass)', fontSize: '12px' }}>
          <span className={`status-indicator ${running ? 'active' : 'idle'}`}></span>
          <span style={{ fontWeight: '500', color: running ? 'var(--success)' : 'var(--text-secondary)' }}>
            {running ? 'Running' : 'Idle'}
          </span>
        </div>
      </div>

      {/* Settings Panel */}
      <div className="glass-card" style={{ padding: '14px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showSettings ? '12px' : '0' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
            Configuration
          </h3>
          <button 
            className="btn-secondary" 
            onClick={() => setShowSettings(!showSettings)} 
            style={{ padding: '3px 8px', fontSize: '11px', height: '24px', borderRadius: '4px' }}
          >
            {showSettings ? 'Hide' : 'Show'}
          </button>
        </div>

        {showSettings && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                Endpoint auto-detected by key prefix.
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
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
        )}
      </div>

      {/* Goal Input & Controls */}
      <div className="glass-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '8px' }}>
            🎯 Set Your Goal
          </h3>
          <textarea
            className="input-field"
            rows="3"
            placeholder="What should the agent do? e.g. Open youtube.com, search for a lofi hip hop stream and play it."
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={running}
            style={{ resize: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {!running ? (
            <button className="btn-primary" onClick={handleStart} style={{ flex: 1 }}>
              🚀 Start Agent
            </button>
          ) : (
            <button className="btn-primary" onClick={handleStop} style={{ flex: 1, background: 'var(--error)', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}>
              🛑 Stop Agent
            </button>
          )}
        </div>
      </div>

      {/* Live Viewport Preview Panel */}
      <div className="glass-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            📺 Live Browser Viewport
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {showLiveScreen && (
              <div style={{ display: 'flex', gap: '4px' }}>
                {['small', 'medium', 'large'].map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setScreenSize(sz)}
                    className="btn-secondary"
                    style={{
                      padding: '2px 6px',
                      fontSize: '9px',
                      height: '20px',
                      borderRadius: '3px',
                      background: screenSize === sz ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                      borderColor: screenSize === sz ? 'var(--accent-primary)' : 'var(--border-glass)',
                      color: screenSize === sz ? '#fff' : 'var(--text-secondary)'
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
                padding: '3px 10px',
                fontSize: '11px',
                height: '24px',
                borderRadius: '4px',
                backgroundColor: showLiveScreen ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                borderColor: showLiveScreen ? 'var(--accent-primary)' : 'var(--border-glass)'
              }}
            >
              {showLiveScreen ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>

        {showLiveScreen ? (
          <div 
            style={{ 
              width: '100%', 
              height: getViewportHeight(), 
              backgroundColor: '#040508', 
              borderRadius: '8px', 
              border: '1px solid var(--border-glass)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
          >
            {liveScreenshot ? (
              <img 
                src={liveScreenshot} 
                alt="Live Viewport" 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'contain',
                  transition: 'opacity 0.15s ease'
                }} 
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                <span className="status-indicator active"></span>
                <span>Awaiting live screen stream...</span>
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '2px 0' }}>
            Live preview is disabled. Enable it to mirror the current browser tab at 12 FPS.
          </p>
        )}
      </div>

      {/* Execution Tracker */}
      {running && (
        <div className="glass-card" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
          <span>Current Step: <strong>{currentStep} / {maxSteps}</strong></span>
          <span>Actions Taken: <strong>{history.length}</strong></span>
        </div>
      )}

      {/* Terminal logs */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '150px', paddingBottom: '16px' }}>
        <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '8px' }}>
          📜 Execution Console Logs
        </h3>
        <div 
          ref={terminalRef} 
          className="terminal-box" 
          style={{ flex: 1, minHeight: '120px' }}
        >
          {logs.length === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>Console idle. Awaiting agent run...</span>
          ) : (
            logs.map((log, i) => renderColoredLog(log, i))
          )}
        </div>
      </div>

    </div>
  );
}
