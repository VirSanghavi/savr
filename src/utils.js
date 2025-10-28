// small helpers used across the extension

const Utils = {
  // safe text extraction
  textFromNode(node) {
    if (!node) return "";
    try {
      return node.innerText || node.textContent || "";
    } catch (e) {
      return "";
    }
  },

  // normalize whitespace
  normalize(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  },

  // basic URL parse
  parseUrl(href) {
    try {
      return new URL(href);
    } catch (e) {
      return null;
    }
  },

  // shorthand for storage get/set
  async storageGet(key, fallback = null) {
    return new Promise(resolve => {
      chrome.storage.local.get([key], res => {
        resolve(res[key] === undefined ? fallback : res[key]);
      });
    });
  },

  async storageSet(obj) {
    return new Promise(resolve => {
      chrome.storage.local.set(obj, () => resolve());
    });
  },

  // whisper to background for badge updates
  notifyBackground(payload) {
    chrome.runtime.sendMessage({ type: "PAGE_EVAL", payload });
  },

  // simple debounce
  debounce(fn, ms = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }
};
