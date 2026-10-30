// Background Service Worker for OpenRouter AI Calls
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ANONYMIZE_WITH_OPENROUTER") {
    handleOpenRouterCall(request.prompt, request.apiKey, request.model)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }
});

async function handleOpenRouterCall(promptText, apiKey, model) {
  const selectedModel = model && model.trim() ? model.trim() : "google/gemini-2.0-flash-001";

  const systemPrompt = `You are a strict PII anonymizer. 
Extract every sensitive/confidential entity from the user prompt:
- Person names
- Organizations & Companies
- Locations & Cities
- Monetary amounts & Salaries (keep currency symbols)
- Phone numbers, Emails, Identification codes

For each entity, generate a realistic, type-consistent synthetic surrogate that preserves casing and grammar.
Output MUST be a valid JSON object matching this schema:
{
  "entities": [
    {
      "original": "exact word in text",
      "surrogate": "synthetic replacement",
      "type": "PERSON | ORGANIZATION | MONEY | LOCATION | EMAIL | PHONE | ID"
    }
  ]
}
If no sensitive entities exist, return {"entities": []}. Return ONLY the JSON object.`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://privllm.extension",
      "X-Title": "PrivLLM Shield"
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: promptText }
      ],
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter Error (${response.status}): ${errorBody}`);
  }

  const json = await response.json();
  const rawText = json.choices?.[0]?.message?.content || json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  // Robust JSON extractor: extracts outermost {...} block even if the model wraps it in markdown
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Invalid response format from AI model.");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.entities || [];
}