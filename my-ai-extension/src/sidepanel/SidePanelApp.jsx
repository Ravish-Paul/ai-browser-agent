import React, { useState, useEffect, useRef } from 'react';
import { getStorageData, setStorageData } from '../utils/storage';

export default function SidePanelApp() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free');
  const [goal, setGoal] = useState('');
  const [maxSteps, setMaxSteps] = useState(10);
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState([]);
  const [history, setHistory] = useState([]);
  const [showSettings, setShowSettings] = useState(true);

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
          if (state.running) {
            setShowSettings(false); // Hide settings during active run
          }
        }
      });
    }

    // 2. Listen to real-time logs from background script
    const messageListener = (message) => {
      if (message.type === 'LOG_UPDATE') {
        const { state, log } = message;
        setLogs(prev => [...prev, log]);
        setCurrentStep(state.currentStep);
        setHistory(state.history);
        setRunning(state.running);
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

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100vh', gap: '16px' }}>
      
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
                OpenRouter API Key
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="sk-or-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                LLM Model
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="nvidia/nemotron-..."
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
                max="15"
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

      {/* Execution Tracker */}
      {running && (
        <div className="glass-card" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
          <span>Current Step: <strong>{currentStep} / {maxSteps}</strong></span>
          <span>Actions Taken: <strong>{history.length}</strong></span>
        </div>
      )}

      {/* Terminal logs */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '150px' }}>
        <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '8px' }}>
          📜 Execution Console Logs
        </h3>
        <div 
          ref={terminalRef} 
          className="terminal-box" 
          style={{ flex: 1, minHeight: '100px' }}
        >
          {logs.length === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>Console idle. Awaiting agent run...</span>
          ) : (
            logs.map((log, i) => (
              <div key={i} style={{ marginBottom: '4px', wordBreak: 'break-all' }}>{log}</div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
