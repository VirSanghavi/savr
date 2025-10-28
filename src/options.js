document.addEventListener("DOMContentLoaded", async () => {
  const domainInput = document.getElementById("domainInput");
  const addBtn = document.getElementById("addDomain");
  const allowlistEl = document.getElementById("allowlist");
  const telemetryCheckbox = document.getElementById("telemetry");
  const clearBtn = document.getElementById("clear");

  async function refresh() {
    const res = await new Promise(r => chrome.storage.local.get(["allowlist", "telemetry"], r));
    const list = res.allowlist || [];
    allowlistEl.innerHTML = "";
    for (const d of list) {
      const li = document.createElement("li");
      li.innerText = d + " ";
      const rem = document.createElement("button");
      rem.innerText = "Remove";
      rem.addEventListener("click", async () => {
        const newList = list.filter(x => x !== d);
        await chrome.storage.local.set({ allowlist: newList });
        refresh();
      });
      li.appendChild(rem);
      allowlistEl.appendChild(li);
    }
    telemetryCheckbox.checked = !!res.telemetry;
  }

  addBtn.addEventListener("click", async () => {
    const v = domainInput.value.trim().toLowerCase();
    if (!v) return alert("Enter a domain like example.com");
    const res = await new Promise(r => chrome.storage.local.get(["allowlist"], r));
    const list = res.allowlist || [];
    if (!list.includes(v)) list.push(v);
    await chrome.storage.local.set({ allowlist: list });
    domainInput.value = "";
    refresh();
  });

  telemetryCheckbox.addEventListener("change", async () => {
    await chrome.storage.local.set({ telemetry: telemetryCheckbox.checked });
  });

  clearBtn.addEventListener("click", async () => {
    if (!confirm("Clear all Savr settings?")) return;
    await chrome.storage.local.clear();
    refresh();
  });

  refresh();
});
