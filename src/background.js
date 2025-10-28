// background service worker: receives extracted context, runs rules, updates badge,
// stores allowlist, and replies to popup queries.

importScripts(); // no-op placeholder so linter doesn't complain

let lastEval = { score: 0, matches: [] };

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (!msg || msg.type !== "PAGE_EVAL") return;
  const payload = msg.payload;
  if (!payload || !payload.ready) {
    // clear badge
    lastEval = { score: 0, matches: [] };
    updateBadge(0);
    return;
  }
  const ctx = payload.context;
  // load allowlist
  const allowlist = await new Promise(r => chrome.storage.local.get(["allowlist"], res => r(res.allowlist || [])));
  const fromDomain = (ctx.fromEmail || "").split("@")[1] || "";
  if (allowlist.some(d => fromDomain.endsWith(d) || (ctx.fromEmail || "").toLowerCase().includes(d.toLowerCase()))) {
    // mark safe
    lastEval = { score: 0, matches: [], suppressed: true };
    updateBadge(0, true);
    return;
  }

  // run rules (we'll evaluate using the rules.js code bundled into the content because content script can't import)
  // Instead, we replicate the runRules function here by injecting rules code. To keep service worker self-contained,
  // we simply run rules by posting to an offscreen document not supported; so we will compute locally by requesting an eval
  // For simplicity, we'll import rules by fetching them via chrome.runtime.getURL and eval. This is safe inside extension.
  const rulesUrl = chrome.runtime.getURL("src/rules.js");
  const rulesCode = await fetch(rulesUrl).then(r => r.text());
  // eval the rules code in a sandbox function
  const runRules = new Function("context", `
    ${rulesCode}
    return runRules(context);
  `);
  try {
    const res = runRules(ctx);
    lastEval = res;
    updateBadge(res.score);
  } catch (e) {
    console.error("rule eval error", e);
    lastEval = { score: 0, matches: [] };
    updateBadge(0);
  }
});

// set badge given score
function updateBadge(score, suppressed = false) {
  const color = suppressed ? [0, 180, 0, 255] : score >= 0.6 ? [200, 30, 30, 255] : score >= 0.25 ? [230, 160, 0, 255] : [0, 120, 0, 255];
  const text = suppressed ? "" : (score >= 0.6 ? "HIGH" : score >= 0.25 ? "WARN" : "");
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
}

// popup queries last evaluation
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "GET_EVAL") {
    sendResponse({ eval: lastEval });
  }
  if (msg && msg.type === "MARK_SAFE") {
    const domain = msg.domain;
    chrome.storage.local.get(["allowlist"], res => {
      const list = res.allowlist || [];
      if (!list.includes(domain)) list.push(domain);
      chrome.storage.local.set({ allowlist: list }, () => {
        // suppress badge
        updateBadge(0, true);
        sendResponse({ ok: true });
      });
    });
    // indicate we'll respond asynchronously
    return true;
  }
});
