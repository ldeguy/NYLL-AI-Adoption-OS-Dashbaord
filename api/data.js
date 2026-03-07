export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { source } = req.body;
  const TOKEN = process.env.NOTION_TOKEN;

  const DB_IDS = {
    frictions: "5b5b113cdf9640a9929422e6dc93e704",
    habits:    "6ef14076ca6e44f5b21d1f2e8bfe6d8f",
    aiTasks:   "cf997cf7968a40ee900e3977e663f84f",
    values:    "7a0dc4296a1a42e5a0f235b3082d8cf7",
  };

  const dbId = DB_IDS[source];
  if (!dbId) return res.status(400).json({ error: "Unknown source" });

  try {
    // Fetch all pages from Notion database
    let results = [];
    let cursor = undefined;

    do {
      const body = { page_size: 100 };
      if (cursor) body.start_cursor = cursor;

      const r = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TOKEN}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await r.json();
      if (!r.ok) return res.status(500).json({ error: data.message || "Notion API error" });

      results = results.concat(data.results || []);
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);

    // Normalize Notion page properties to flat objects
    const normalized = results.map(page => {
      const props = page.properties || {};
      const flat = { _id: page.id };
      for (const [key, val] of Object.entries(props)) {
        flat[key] = extractValue(val);
      }
      return flat;
    });

    res.status(200).json({ data: normalized });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function extractValue(prop) {
  if (!prop) return null;
  switch (prop.type) {
    case "title":
      return prop.title?.map(t => t.plain_text).join("") || null;
    case "rich_text":
      return prop.rich_text?.map(t => t.plain_text).join("") || null;
    case "select":
      return prop.select?.name || null;
    case "multi_select":
      return prop.multi_select?.map(s => s.name).join(", ") || null;
    case "number":
      return prop.number ?? null;
    case "formula":
      return prop.formula?.number ?? prop.formula?.string ?? null;
    case "date":
      return prop.date?.start || null;
    case "checkbox":
      return prop.checkbox ? "Yes" : "No";
    case "relation":
      return prop.relation?.map(r => r.id).join(", ") || null;
    case "rollup":
      return prop.rollup?.number ?? null;
    default:
      return null;
  }
}
