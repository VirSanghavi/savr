// popup logic: query background for last eval and render UI.

document.addEventListener("DOMContentLoaded", async () => {
  const riskLabel = document.getElementById("riskLabel");
  const scoreBar = document.getElementById("scoreBar");
  const reasonsList = document.getElementById("reasonsList");
  const btnMarkSafe = document.getElementById("markSafe");
  const btnReport = document.getElementById("report");
  const btnOptions = document.getElementById("options");

  function render(evalRes) {
    const score = evalRes.score || 0;
    // label
    if (evalRes.suppressed) {
      riskLabel.innerText = "Sender allowlisted";
      scoreBar.className = "";
      scoreBar.style.width = "0%";
    } else if (score >= 0.6) {
      riskLabel.innerText = "HIGH RISK";
      scoreBar.className = "high";
      scoreBar.style.width = `${Math.round(score * 100)}%`;
    } else if (score >= 0.25) {
      riskLabel.innerText = "Suspicious";
      scoreBar.className = "warn";
      scoreBar.style.width = `${Math.round(score * 100)}%`;
    } else {
      riskLabel.innerText = "No obvious risk detected";
      scoreBar.className = "";
      scoreBar.style.width = `${Math.round(score * 100)}%`;
    }

    // reasons
    reasonsList.innerHTML = "";
    const matches = evalRes.matches || [];
    if (matches.length === 0) {
      const li = document.createElement("li");
      li.innerText = "No heuristic matches.";
      reasonsList.appendChild(li);
    } else {
      for (const m of matches) {
        const li = document.createElement("li");
        li.innerText = m.message;
        reasonsList.appendChild(li);
      }
    }
  }

  // request current evaluation
  chrome.runtime.sendMessage({ type: "GET_EVAL" }, res => {
    if (!res) {
      render({ score: 0, matches: [] });
      return;
    }
    render(res.eval || { score: 0, matches: [] });
  });

  // actions
  btnOptions.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  btnReport.addEventListener("click", async () => {
    // copy the current eval summary to clipboard
    chrome.runtime.sendMessage({ type: "GET_EVAL" }, res => {
      const ev = res.eval || { score: 0, matches: [] };
      const text = `Savr report\nscore: ${ev.score}\nmatches:\n${(ev.matches || []).map(m => `- ${m.message}`).join("\n")}`;
      navigator.clipboard.writeText(text).then(() => {
        btnReport.innerText = "Copied";
        setTimeout(() => (btnReport.innerText = "Copy report"), 1300);
      });
    });
  });

  btnMarkSafe.addEventListener("click", async () => {
    // try to extract current sender domain from the active tab by executing a tiny script
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs || !tabs[0]) return;
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          // try to return from email or any visible email-like string
          const gD = document.querySelector('.gD[email]');
          if (gD) return (gD.getAttribute('email') || gD.innerText || "");
          // fallback: look for "From:" label
          const text = document.body.innerText;
          const m = text.match(/From:\\s*([^\\n<]+)(?:\\s*<([^>]+)>)?/i);
          if (m) return (m[2] || m[1] || "");
          return "";
        }
      }, results => {
        const sender = results && results[0] && results[0].result ? results[0].result : "";
        const domain = (sender.split("@")[1] || "").toLowerCase();
        if (!domain) {
          alert("Could not detect sender domain. Please add it manually in options.");
          return;
        }
        chrome.runtime.sendMessage({ type: "MARK_SAFE", domain }, resp => {
          if (resp && resp.ok) {
            btnMarkSafe.innerText = "Saved";
            setTimeout(() => (btnMarkSafe.innerText = "Mark sender safe"), 1200);
          } else {
            alert("Failed to save allowlist entry.");
          }
        });
      });
    });
  });
});
