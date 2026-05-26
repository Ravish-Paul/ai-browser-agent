import React from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/global.css';

function PopupApp() {
  const handleOpenSidePanel = () => {
    // Chrome extension API to open the side panel
    if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.open) {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab) {
          chrome.sidePanel.open({ windowId: tab.windowId });
          window.close(); // Close popup
        }
      });
    } else {
      alert("Please open the side panel by clicking the Side Panel icon in your Chrome toolbar!");
    }
  };

  return (
    <div className="glass-card" style={{ width: '280px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', textAlign: 'center' }}>
      <h2 style={{ fontSize: '18px', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        🤖 AI Browser Agent
      </h2>
      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
        This extension runs inside the Chrome Side Panel to allow parallel browsing while the agent works.
      </p>
      <button className="btn-primary" onClick={handleOpenSidePanel} style={{ width: '100%' }}>
        📺 Open Agent Dashboard
      </button>
      <p style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
        Or click the side panel icon in your toolbar.
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>
);
