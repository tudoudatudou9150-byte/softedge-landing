const readJsonBody = (req) => new Promise((resolve, reject) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    try {
      resolve(body ? JSON.parse(body) : {});
    } catch (error) {
      reject(error);
    }
  });
  req.on("error", reject);
});

const supabaseRequest = async (path, options = {}) => {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${message}`);
  }

  return response;
};

const cleanText = (value, maxLength) => String(value || "").trim().slice(0, maxLength);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const visitorId = cleanText(body.visitorId, 80);
    const path = cleanText(body.path, 240);

    if (!visitorId || !path) {
      res.status(204).end();
      return;
    }

    await supabaseRequest("page_views", {
      method: "POST",
      body: JSON.stringify({
        visitor_id: visitorId,
        path,
        referrer: cleanText(body.referrer, 500),
        user_agent: cleanText(req.headers["user-agent"], 500)
      })
    });

    res.status(204).end();
  } catch (error) {
    console.error("Page view tracking failed:", error.message);
    res.status(204).end();
  }
};
