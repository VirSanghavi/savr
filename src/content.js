// content script: extracts message-like content and sends for evaluation.
// It attempts provider-specific extraction for Gmail/Outlook, with a generic fallback.

(async function() {
  // simple provider detectors
  const isGmail = !!document.querySelector('div[role="main"]') && /mail.google.com/.test(location.hostname);
  const isOutlook = /outlook\.office|outlook\.live|outlook\.com/.test(location.hostname);

  function extractGmail() {
    // Gmail DOM changes often. We try to find the open message area.
    // this is a best-effort extractor for demo purposes.
    const container = document.querySelector('div[role="main"] .ii.gt');
    const header = document.querySelector('h2.hP') || document.querySelector('.hP'); // subject
    const fromName = (document.querySelector('.gD') && document.querySelector('.gD').getAttribute('name')) || (document.querySelector('.gD') && document.querySelector('.gD').innerText);
    const fromEmailEl = document.querySelector('.gD[email]') || document.querySelector('.gD');
    const fromEmail = fromEmailEl ? fromEmailEl.getAttribute('email') || fromEmailEl.getAttribute('data-hovercard-id') : null;
    const subject = header ? header.innerText : "";
    const bodyNode = container;
    // links
    const links = Array.from((bodyNode ? bodyNode.querySelectorAll('a') : [])).map(a => ({ text: a.innerText || a.textContent || "", href: a.href }));
    // attachments placeholder
    const attachments = Array.from(document.querySelectorAll('.aQH .aQy')).map(a => ({ name: a.innerText || a.getAttribute('data-tooltip') || "attachment" }));

    return {
      subject: subject,
      fromName: fromName || "",
      fromEmail: fromEmail || "",
      body: bodyNode ? bodyNode.innerText : "",
      links,
      attachments
    };
  }

  function extractGeneric() {
    // fallback: try to find obvious subject + sender nodes or take the whole page body
    const subject = document.querySelector('h1, h2, .subject') ? (document.querySelector('h1, h2, .subject').innerText || "") : "";
    const fromName = document.querySelector('.from, .sender, .email-from') ? document.querySelector('.from, .sender, .email-from').innerText : "";
    const fromEmail = "";
    const body = (document.querySelector('article') && document.querySelector('article').innerText) || document.body.innerText || "";
    const links = Array.from(document.querySelectorAll('a')).slice(0, 200).map(a => ({ text: a.innerText || "", href: a.href }));
    const attachments = [];
    return { subject, fromName, fromEmail, body, links, attachments };
  }

  function extractOutlook() {
    // basic outlook web detector
    const subject = document.querySelector('div[role="main"] h1') ? document.querySelector('div[role="main"] h1').innerText : "";
    const fromEl = document.querySelector('div[role="main"] .ms-font-weight-regular') || document.querySelector('.ms-font-weight-regular');
    const fromName = fromEl ? fromEl.innerText : "";
    const bodyNode = document.querySelector('div[role="document"]') || document.querySelector('.msg-body');
    const links = Array.from((bodyNode ? bodyNode.querySelectorAll('a') : [])).map(a => ({ text: a.innerText || "", href: a.href }));
    return { subject, fromName, fromEmail: "", body: bodyNode ? bodyNode.innerText : "", links, attachments: [] };
  }

  function extract() {
    try {
      if (isGmail) return extractGmail();
      if (isOutlook) return extractOutlook();
      return extractGeneric();
    } catch (e) {
      return extractGeneric();
    }
  }

  // run extraction periodically when the user navigates or opens messages
  const run = Utils.debounce(async () => {
    const ctx = extract();
    // quick sanity check - ignore huge pages
    if (!ctx.body || ctx.body.length < 10) {
      Utils.notifyBackground({ ready: false });
      return;
    }
    // send the content for scoring to background
    Utils.notifyBackground({ ready: true, context: ctx });
  }, 400);

  // observe DOM changes to detect navigation/opening messages
  const observer = new MutationObserver(run);
  observer.observe(document.body, { childList: true, subtree: true });

  // initial run
  run();
})();
