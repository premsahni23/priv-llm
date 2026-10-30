// PrivLLM In-Browser Content Engine v3.2 (Universal Contextual NER & ID Matcher)
(function() {
  console.log("[PrivLLM] Engine v3.2 Universal Contextual active.");

  let vault = new Map();
  let useAI = false;
  let openRouterKey = "";
  let openRouterModel = "google/gemini-2.0-flash-001";
  let lastInteractedEditor = null;

  window.addEventListener('input', (e) => {
    if (e.target && (e.target.isContentEditable || e.target.tagName === 'TEXTAREA')) {
      if (!e.target.closest('#privllm-floating-bar') && !e.target.closest('#privllm-preview-card')) {
        lastInteractedEditor = e.target;
      }
    }
  }, true);

  window.addEventListener('focusin', (e) => {
    if (e.target && (e.target.isContentEditable || e.target.tagName === 'TEXTAREA')) {
      if (!e.target.closest('#privllm-floating-bar') && !e.target.closest('#privllm-preview-card')) {
        lastInteractedEditor = e.target;
      }
    }
  }, true);

  function syncSettings() {
    if (typeof chrome === "undefined" || !chrome.runtime?.id) return;
    try {
      chrome.storage.local.get(["privllm_vault", "openrouter_key", "use_ai", "openrouter_model"], (res) => {
        if (res && res.privllm_vault && Array.isArray(res.privllm_vault)) {
          vault.clear();
          res.privllm_vault.forEach(e => vault.set(e.original.toLowerCase(), e));
          deAnonymizeAllTextOnPage();
        }
        openRouterKey = res?.openrouter_key || "";
        useAI = !!res?.use_ai && !!openRouterKey;
        openRouterModel = res?.openrouter_model || "google/gemini-2.0-flash-001";
      });
    } catch (e) {}
  }

  syncSettings();

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") syncSettings();
    });
  } catch (e) {}

  const LOCAL_SURROGATES = {
    PERSON: ["David Miller", "Elena Vance", "Marcus Brody", "Sarah Jenkins", "Arthur Pendelton"],
    ORGANIZATION: ["NovaCorp Logistics", "Apex Dynamics", "Vanguard Global", "Pinnacle University", "Meridian Labs"],
    MONEY: ["₹18,00,000", "₹12,50,000", "$65,000", "$94,500"],
    LOCATION: ["Bristol", "Seattle", "Denver", "Melbourne"],
    EMAIL: ["contact@synthetic-domain.test"],
    PHONE: ["+1-555-019-2834"],
    ID: ["REG-9081234", "ID-4491028", "STU-8821943", "XYZ9876543"]
  };
  let counters = { PERSON: 0, ORGANIZATION: 0, MONEY: 0, LOCATION: 0, EMAIL: 0, PHONE: 0, ID: 0 };

  // DYNAMIC CONTEXTUAL ANONYMIZER (No hardcoded names required!)
  function localAnonymize(text) {
    let out = text;

    function getSurr(orig, type) {
      const trimmed = orig.trim();
      const key = trimmed.toLowerCase();
      if (vault.has(key)) return vault.get(key).surrogate;
      const pool = LOCAL_SURROGATES[type] || LOCAL_SURROGATES.PERSON;
      const surrogate = pool[counters[type] % pool.length];
      counters[type]++;
      const entry = { original: trimmed, surrogate, type };
      vault.set(key, entry);
      return surrogate;
    }

    // 1. Structured Emails
    out = out.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, m => getSurr(m, 'EMAIL'));

    // 2. Structured Phone Numbers
    out = out.replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, m => getSurr(m, 'PHONE'));

    // 3. Structured Monetary values
    out = out.replace(/(\$|₹|USD|INR)\s?\d{1,3}(?:[,\.]\d{2,3})*(?:\.\d+)?/g, m => getSurr(m, 'MONEY'));

    // 4. Registration IDs, Roll Numbers, Student IDs (e.g., "registration id 23215042" or "roll no: 98124")
    out = out.replace(/\b(?:registration\s+id|reg(?:\.|\s+no|istration)?|roll\s+no|student\s+id|employee\s+id|emp\s+id|id|uid)\s*[:#-]?\s*([0-9a-zA-Z]{5,15})\b/gi, (fullMatch, idNum) => {
      const fakeId = getSurr(idNum, 'ID');
      return fullMatch.replace(idNum, fakeId);
    });

    // 5. Standalone 6 to 12 digit numbers (General Student/Govt/Serial IDs)
    out = out.replace(/\b\d{6,12}\b/g, m => getSurr(m, 'ID'));

    // 6. Educational Institutions & Universities (e.g., "christ university", "oxford college", "stanford institute")
    out = out.replace(/\b([a-zA-Z\s]{2,25}\s+(?:university|college|institute|academy|school))\b/gi, m => {
      // Ignore common English phrases
      if (/^(the\s+entire|any|a|in\s+the)\s+/i.test(m)) return m;
      return getSurr(m, 'ORGANIZATION');
    });

    // 7. Contextual Self-Introductions: "i am [name]", "my name is [name]" (Works even if lowercase!)
    out = out.replace(/\b(?:i\s+am|my\s+name\s+is|this\s+is)\s+([a-zA-Z]{2,15}(?:\s+[a-zA-Z]{2,15}){1,2})\b/gi, (fullMatch, personName) => {
      // Exclude common non-name words (e.g., "i am writing to", "i am looking for")
      const lower = personName.toLowerCase().trim();
      if (/^(writing|looking|currently|working|trying|interested|reaching|negotiating|requesting)/.test(lower)) {
        return fullMatch;
      }
      const fakeName = getSurr(personName, 'PERSON');
      return fullMatch.replace(personName, fakeName);
    });

    // 8. Capitalized 2-Word Proper Names (Standard Title Case: "John Doe", "Prem Sahni")
    out = out.replace(/\b([A-Z][a-z]{1,15}\s+[A-Z][a-z]{1,15})\b/g, m => {
      if (/^(Dear|Hello|Thank You|Good Morning|Where Should|Subject Line)/i.test(m)) return m;
      return getSurr(m, 'PERSON');
    });

    // 9. Common Tech & Delivery Organizations
    ["Microsoft", "Amazon", "Google", "Apollo Hospital", "Apple", "Zomato", "Swiggy"].forEach(org => {
      out = out.replace(new RegExp(`\\b${org}\\b`, 'gi'), m => getSurr(m, 'ORGANIZATION'));
    });

    // 10. Major Cities
    ["Bangalore", "Delhi", "Mumbai", "Hyderabad", "Seattle", "Denver", "Bristol", "London", "Pune", "Gurgaon"].forEach(city => {
      out = out.replace(new RegExp(`\\b${city}\\b`, 'gi'), m => getSurr(m, 'LOCATION'));
    });

    try {
      chrome.storage.local.set({ privllm_vault: Array.from(vault.values()) });
    } catch (e) {}

    return out;
  }

  // ACCURATE GUARD: ONLY protect the prompt input at the bottom
  function isPromptComposer(node) {
    if (!node || !node.parentElement) return false;
    const parent = node.parentElement;

    if (parent.closest('#privllm-floating-bar') || parent.closest('#privllm-preview-card')) {
      return true;
    }
    if (parent.closest('#prompt-textarea') || parent.closest('form')) {
      return true;
    }
    return false;
  }

  // UNIVERSAL DE-ANONYMIZER
  function deAnonymizeAllTextOnPage() {
    if (vault.size === 0) return;

    const replacements = [];
    for (const [_, entry] of vault) {
      replacements.push({ find: entry.surrogate, replaceWith: entry.original });

      // First-name decomposition: "David Miller" -> "David"
      const surrParts = entry.surrogate.trim().split(/\s+/);
      const origParts = entry.original.trim().split(/\s+/);
      if (surrParts.length > 1 && surrParts[0].length >= 3) {
        replacements.push({ find: surrParts[0], replaceWith: origParts[0] || entry.original });
      }

      // Org decomposition: "NovaCorp Logistics" -> "NovaCorp"
      if (entry.type === "ORGANIZATION" && surrParts.length > 1 && surrParts[0].length >= 4) {
        replacements.push({ find: surrParts[0], replaceWith: origParts[0] || entry.original });
      }
    }

    replacements.sort((a, b) => b.find.length - a.find.length);

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (isPromptComposer(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }, false);

    const nodes = [];
    let n;
    while (n = walker.nextNode()) nodes.push(n);

    for (const node of nodes) {
      let text = node.nodeValue;
      if (!text || !text.trim()) continue;
      let modified = false;

      for (const item of replacements) {
        const escaped = item.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pfx = /^\w/.test(item.find) ? '\\b' : '';
        const sfx = /\w$/.test(item.find) ? '\\b' : '';
        const rx = new RegExp(`${pfx}${escaped}${sfx}`, 'gi');

        if (rx.test(text)) {
          text = text.replace(new RegExp(`${pfx}${escaped}${sfx}`, 'gi'), item.replaceWith);
          modified = true;
        }
      }

      if (modified) {
        node.nodeValue = text;
        if (node.parentElement && !node.parentElement.classList.contains("privllm-restored")) {
          node.parentElement.classList.add("privllm-restored");
          node.parentElement.style.borderLeft = "3px solid #3b82f6";
          node.parentElement.style.paddingLeft = "4px";
        }
      }
    }
  }

  setInterval(deAnonymizeAllTextOnPage, 300);

  function findActiveEditor() {
    if (lastInteractedEditor && document.body.contains(lastInteractedEditor)) {
      const raw = (lastInteractedEditor.tagName === 'TEXTAREA' ? lastInteractedEditor.value : (lastInteractedEditor.innerText || lastInteractedEditor.textContent)) || '';
      const clean = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      if (clean && !/^(ask|message|where should|what's on|hello)/i.test(clean)) {
        const root = lastInteractedEditor.closest('[contenteditable]') || lastInteractedEditor;
        return { element: root, text: clean };
      }
    }

    const all = Array.from(document.querySelectorAll('*')).filter(el => {
      if (el.closest('#privllm-floating-bar') || el.closest('#privllm-preview-card')) return false;
      return (el.isContentEditable || el.tagName === 'TEXTAREA');
    });

    for (const el of all) {
      const raw = (el.tagName === 'TEXTAREA' ? el.value : (el.innerText || el.textContent)) || '';
      const clean = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      if (clean && !/^(ask|message|where should|what's on|hello)/i.test(clean)) {
        const root = el.closest('[contenteditable]') || el;
        return { element: root, text: clean };
      }
    }
    return { element: null, text: '' };
  }

  function replaceTextInEditor(editor, newText) {
    if (!editor) return false;

    if (editor.tagName === "TEXTAREA" || editor.tagName === "INPUT") {
      editor.value = newText;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    const targetP = editor.querySelector('p') || editor;
    editor.focus();
    targetP.focus();

    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(targetP);
    sel.removeAllRanges();
    sel.addRange(range);

    let replaced = false;
    try {
      replaced = document.execCommand('insertText', false, newText);
    } catch (e) {
      replaced = false;
    }

    if (!replaced || (targetP.innerText || targetP.textContent || '').trim() !== newText.trim()) {
      targetP.textContent = newText;
    }

    targetP.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: newText
    }));
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function showSanitizedPreview(sanitizedText, editor) {
    let card = document.getElementById("privllm-preview-card");
    if (!card) {
      card = document.createElement("div");
      card.id = "privllm-preview-card";
      card.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 24px;
        max-width: 480px;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15);
        border-radius: 8px;
        padding: 12px 14px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
      document.body.appendChild(card);
    }

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <span style="font-size:11px; font-weight:700; color:#0f172a;">Sanitized Wire Payload:</span>
        <button id="privllm-close-preview" style="border:none; background:transparent; cursor:pointer; color:#94a3b8; font-size:14px;">✕</button>
      </div>
      <div style="font-size:12px; color:#334155; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px; margin-bottom:8px; font-family:monospace; line-height:1.4;">
        ${sanitizedText}
      </div>
      <div style="display:flex; gap:8px;">
        <button id="privllm-apply-btn" style="flex:1; background:#0f172a; color:#ffffff; border:none; border-radius:6px; padding:6px 10px; font-size:11px; font-weight:600; cursor:pointer;">
          Force Replace in Chat
        </button>
        <button id="privllm-copy-btn" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; border-radius:6px; padding:6px 10px; font-size:11px; font-weight:600; cursor:pointer;">
          Copy Text
        </button>
      </div>
    `;

    document.getElementById("privllm-close-preview").addEventListener("click", () => card.remove());

    document.getElementById("privllm-copy-btn").addEventListener("click", () => {
      navigator.clipboard.writeText(sanitizedText);
      const b = document.getElementById("privllm-copy-btn");
      b.innerText = "Copied!";
      setTimeout(() => b.innerText = "Copy Text", 1500);
    });

    document.getElementById("privllm-apply-btn").addEventListener("click", () => {
      replaceTextInEditor(editor, sanitizedText);
      const b = document.getElementById("privllm-apply-btn");
      b.innerText = "✔ Injected!";
      setTimeout(() => card.remove(), 1000);
    });
  }

  function injectFloatingUI() {
    if (document.getElementById("privllm-floating-bar")) return;

    const bar = document.createElement("div");
    bar.id = "privllm-floating-bar";
    bar.innerHTML = `
      <div style="
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999999;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        box-shadow: 0 4px 16px rgba(0,0,0,0.14);
        border-radius: 8px;
        padding: 6px 10px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></div>
        <span style="font-size: 11px; font-weight: 600; color: #0f172a;">PrivLLM</span>
        <button id="privllm-sanitize-btn" style="
          background: #0f172a;
          color: #ffffff;
          border: none;
          font-size: 11px;
          font-weight: 500;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        ">Sanitize</button>
        <button id="privllm-restore-btn" title="Force Restore on Page" style="
          background: #2563eb;
          color: #ffffff;
          border: none;
          font-size: 11px;
          font-weight: 500;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
        ">Restore</button>
        <button id="privllm-clear-btn" title="Clear chat box" style="
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #cbd5e1;
          font-size: 11px;
          font-weight: 500;
          padding: 6px 8px;
          border-radius: 6px;
          cursor: pointer;
        ">Clear</button>
      </div>
    `;
    document.body.appendChild(bar);

    const sanitizeBtn = document.getElementById("privllm-sanitize-btn");
    const restoreBtn = document.getElementById("privllm-restore-btn");
    const clearBtn = document.getElementById("privllm-clear-btn");

    sanitizeBtn.addEventListener("mousedown", e => e.preventDefault());
    restoreBtn.addEventListener("mousedown", e => e.preventDefault());
    clearBtn.addEventListener("mousedown", e => e.preventDefault());

    restoreBtn.addEventListener("click", () => {
      deAnonymizeAllTextOnPage();
      restoreBtn.innerText = "✔ Restored!";
      setTimeout(() => restoreBtn.innerText = "Restore", 1200);
    });

    clearBtn.addEventListener("click", () => {
      const active = findActiveEditor();
      if (active.element) replaceTextInEditor(active.element, "");
      const card = document.getElementById("privllm-preview-card");
      if (card) card.remove();
    });

    sanitizeBtn.addEventListener("click", async () => {
      const active = findActiveEditor();

      if (!active.element || !active.text) {
        sanitizeBtn.innerText = "Type prompt first!";
        sanitizeBtn.style.background = "#ef4444";
        setTimeout(() => {
          sanitizeBtn.innerText = "Sanitize";
          sanitizeBtn.style.background = "#0f172a";
        }, 1500);
        return;
      }

      const rawText = active.text;
      let sanitized = rawText;

      sanitizeBtn.innerText = useAI ? "AI Scanning..." : "Sanitizing...";
      sanitizeBtn.style.background = "#2563eb";

      try {
        if (useAI && openRouterKey) {
          try {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));
            const aiCall = new Promise((resolve, reject) => {
              chrome.runtime.sendMessage({
                action: "ANONYMIZE_WITH_OPENROUTER",
                prompt: rawText,
                apiKey: openRouterKey,
                model: openRouterModel
              }, res => {
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                else resolve(res);
              });
            });

            const response = await Promise.race([aiCall, timeout]);

            if (response && response.success && Array.isArray(response.data) && response.data.length > 0) {
              const sorted = response.data.sort((a, b) => b.original.length - a.original.length);
              sorted.forEach(item => {
                const key = item.original.trim().toLowerCase();
                vault.set(key, { original: item.original.trim(), surrogate: item.surrogate.trim(), type: item.type });
                const escaped = item.original.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pfx = /^\w/.test(item.original.trim()) ? '\\b' : '';
                const sfx = /\w$/.test(item.original.trim()) ? '\\b' : '';
                const reg = new RegExp(`${pfx}${escaped}${sfx}`, 'gi');
                sanitized = sanitized.replace(reg, item.surrogate.trim());
              });
              chrome.storage.local.set({ privllm_vault: Array.from(vault.values()) });
            } else {
              sanitized = localAnonymize(rawText);
            }
          } catch (e) {
            console.warn("[PrivLLM] AI Fallback to local contextual:", e.message);
            sanitized = localAnonymize(rawText);
          }
        } else {
          sanitized = localAnonymize(rawText);
        }

        replaceTextInEditor(active.element, sanitized);
        showSanitizedPreview(sanitized, active.element);

        sanitizeBtn.innerText = `✔ Done (${vault.size})`;
        sanitizeBtn.style.background = "#10b981";
      } catch (err) {
        console.error("[PrivLLM] Error during sanitize:", err);
        sanitizeBtn.innerText = "Error (Used Local)";
        sanitizeBtn.style.background = "#f59e0b";
      } finally {
        setTimeout(() => {
          sanitizeBtn.innerText = "Sanitize";
          sanitizeBtn.style.background = "#0f172a";
        }, 1800);
        deAnonymizeAllTextOnPage();
      }
    });
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    injectFloatingUI();
  } else {
    window.addEventListener("DOMContentLoaded", injectFloatingUI);
  }
})();