/**
 * Chrome Storage utility functions
 */

export const getStorageData = (keys) => {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(keys, (result) => {
        resolve(result);
      });
    } else {
      // Fallback for development/testing outside Chrome context
      const result = {};
      const keyList = Array.isArray(keys) ? keys : [keys];
      keyList.forEach(k => {
        result[k] = localStorage.getItem(k) || '';
      });
      resolve(result);
    }
  });
};

export const setStorageData = (data) => {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(data, () => {
        resolve();
      });
    } else {
      // Fallback for development/testing outside Chrome context
      Object.entries(data).forEach(([k, v]) => {
        localStorage.setItem(k, typeof v === 'object' ? JSON.stringify(v) : v);
      });
      resolve();
    }
  });
};
