export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { source, query } = req.body;

  const SOURCES = {
    frictions: "collection://f1013161-eb83-46ee-ad68-d0b57004dd5c",
    habits:    "collection://453b9146-7b38-4739-8125-3b25a0d71147",
    aiTasks:   "collection://b9d30e8e-1100-47dd-83ea-8be5a3cc22d1",
    values:    "collection://efe09cad-7173-4c53-84f5-314513e4173f",
  };

  const src = SOURCES[source];
  if (!src) return res.status(400).json({ error: "Unknown source" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: "You are a Notion data fetcher. Fetch all entries from the given Notion data source and return ONLY a valid JSON array. No markdown, no explanation, no code fences.",
        messages: [{ role: "user", content: `Fetch all entries from Notion data source: ${src}. Search query: "${query}". Return ONLY a JSON array.` }],
        mcp_servers: [{
          type: "url",
          url: "https://mcp.notion.com/mcp",
          name: "notion-mcp",
          authorization_token: process.env.NOTION_TOKEN,
        }],
      }),
    });

    const data = await response.json();
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("") || "[]";

    const clean = text.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    const parsed = start !== -1 ? JSON.parse(clean.slice(start, end + 1)) : [];

    res.status(200).json({ data: parsed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
