document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("vault-rows");
  const countEl = document.getElementById("stat-count");
  const clearBtn = document.getElementById("clear-btn");
  const saveBtn = document.getElementById("save-btn");
  const apiKeyInput = document.getElementById("api-key");
  const modelInput = document.getElementById("model-input");
  const useAiToggle = document.getElementById("use-ai-toggle");
  const chips = document.querySelectorAll(".chip");

  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      modelInput.value = chip.getAttribute("data-model");
      autoSave();
    });
  });

  function refresh() {
    chrome.storage.local.get(["privllm_vault", "openrouter_key", "use_ai", "openrouter_model"], (res) => {
      const list = res.privllm_vault || [];
      countEl.innerText = list.length;

      if (list.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #94a3b8; padding: 12px;">No active replacements yet</td></tr>';
      } else {
        tableBody.innerHTML = "";
        list.forEach(item => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td style="color: #ef4444; font-weight: 500;">${item.original}</td>
            <td style="color: #10b981; font-weight: 500;">${item.surrogate}</td>
          `;
          tableBody.appendChild(tr);
        });
      }

      if (res.openrouter_key) apiKeyInput.value = res.openrouter_key;
      modelInput.value = res.openrouter_model || "google/gemini-2.0-flash-001";
      useAiToggle.checked = !!res.use_ai;
    });
  }

  function autoSave() {
    const key = apiKeyInput.value.trim();
    const model = modelInput.value.trim() || "google/gemini-2.0-flash-001";
    const useAi = useAiToggle.checked;

    chrome.storage.local.set({
      openrouter_key: key,
      openrouter_model: model,
      use_ai: useAi
    });
  }

  apiKeyInput.addEventListener("input", autoSave);
  modelInput.addEventListener("input", autoSave);
  useAiToggle.addEventListener("change", autoSave);

  saveBtn.addEventListener("click", () => {
    autoSave();
    saveBtn.innerText = "Saved!";
    setTimeout(() => { saveBtn.innerText = "Save Settings"; }, 1000);
  });

  clearBtn.addEventListener("click", () => {
    chrome.storage.local.set({ privllm_vault: [] }, refresh);
  });

  refresh();
});