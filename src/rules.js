// Heuristic rule engine for local scoring.
// Each rule returns { id, score, message, meta } when triggered.

const RULES = [];

// utility to register a rule
function registerRule(fn) {
  RULES.push(fn);
}

// common suspicious phrases
const URGENCY_WORDS = [
  "immediately", "urgent", "asap", "right now", "donotreply", "act now",
  "transfer", "wire", "payment", "authorize", "login to", "verify your account",
  "update your payment", "password reset", "verify your identity"
];

registerRule(({ subject, fromName, fromEmail, body, links, attachments }) => {
  // display name vs envelope mismatch
  if (!fromEmail) return null;
  const domain = (fromEmail.split("@")[1] || "").toLowerCase();
  const nameContainsDomain = fromName && domain && fromName.toLowerCase().includes(domain.split(".")[0]);
  if (fromName && fromEmail && !nameContainsDomain) {
    return {
      id: "sender_mismatch",
      score: 0.25,
      message: "Sender display name does not match sending email domain",
      meta: { fromName, fromEmail }
    };
  }
  return null;
});

registerRule(({ body, links }) => {
  // link text vs href mismatch
  for (const l of links) {
    if (!l.text) continue;
    const text = l.text.trim();
    const href = (l.href || "").trim();
    // if visible text looks like a domain or url but href is different
    if (/https?:\/\//i.test(text) || /www\./i.test(text) || /\.[a-z]{2,}$/i.test(text)) {
      try {
        const textHost = new URL(text.startsWith("http") ? text : `https://${text}`).host;
        const hrefHost = new URL(href).host;
        if (textHost !== hrefHost) {
          return {
            id: "link_mismatch",
            score: 0.3,
            message: `Visible link destination differs from actual link (${textHost} vs ${hrefHost})`,
            meta: { text, href }
          };
        }
      } catch (e) {
        // ignore parse errors
      }
    }
    // shortened URL suspicious
    if (/bit\.ly|tinyurl|goo\.gl|t\.co|lnkd\.in|rb\.gy/i.test(href)) {
      return {
        id: "shortener",
        score: 0.15,
        message: "Shortened URL detected, could hide final destination",
        meta: { href }
      };
    }
  }
  return null;
});

registerRule(({ body }) => {
  // urgency / coercion phrases
  const s = (body || "").toLowerCase();
  for (const w of URGENCY_WORDS) {
    if (s.includes(w)) {
      return {
        id: "urgency",
        score: 0.15,
        message: `Urgency language detected: "${w}"`,
        meta: { found: w }
      };
    }
  }
  return null;
});

registerRule(({ attachments }) => {
  // suspicious attachment extensions
  for (const a of attachments) {
    const ext = (a.name || "").split(".").pop().toLowerCase();
    if (["exe", "scr", "bat", "ps1", "jar"].includes(ext)) {
      return {
        id: "dangerous_attachment",
        score: 0.3,
        message: `Dangerous attachment type detected: .${ext}`,
        meta: { name: a.name }
      };
    }
  }
  return null;
});

registerRule(({ body }) => {
  // credentials prompt
  const s = (body || "").toLowerCase();
  if (s.includes("enter your password") || s.includes("provide your password") || s.includes("send your otp") || s.includes("one-time passcode") || s.includes("verify your account by entering")) {
    return {
      id: "credential_request",
      score: 0.4,
      message: "Message asks for credentials or one-time codes",
      meta: {}
    };
  }
  return null;
});

// aggregator
function runRules(context) {
  const matches = [];
  let score = 0;
  for (const r of RULES) {
    try {
      const res = r(context);
      if (res) {
        matches.push(res);
        score += res.score;
      }
    } catch (e) {
      // ignore rule errors
      console.error("rule error", e);
    }
  }
  // clamp score
  if (score > 1) score = 1;
  return { score, matches };
}
