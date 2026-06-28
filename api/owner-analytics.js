const DAY_MS = 24 * 60 * 60 * 1000;

const supabaseRequest = async (path, options = {}) => {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "count=exact",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    const error = new Error(`Supabase request failed: ${response.status} ${message}`);
    error.status = response.status;
    error.details = message;
    throw error;
  }

  const data = await response.json().catch(() => []);
  return { data, count: Number(response.headers.get("content-range")?.split("/")?.[1] || data.length || 0) };
};

const getUserFromToken = async (token) => {
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) return null;
  return response.json();
};

const countPageViews = async (query = "") => {
  const { count } = await supabaseRequest(`page_views?select=id${query}`, {
    method: "GET",
    headers: { Range: "0-0" }
  });
  return count;
};

const topBy = (rows, key, limit = 5) => Object.entries(rows.reduce((acc, row) => {
  const value = row[key] || "Direct / unknown";
  acc[value] = (acc[value] || 0) + 1;
  return acc;
}, {}))
  .sort((left, right) => right[1] - left[1])
  .slice(0, limit)
  .map(([label, count]) => ({ label, count }));

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const user = token ? await getUserFromToken(token) : null;
    if (!user?.id) {
      res.status(401).json({ error: "Please sign in with the owner account." });
      return;
    }

    const { data: profiles } = await supabaseRequest(`profiles?id=eq.${encodeURIComponent(user.id)}&select=role`);
    if (profiles[0]?.role !== "admin") {
      res.status(403).json({ error: "Owner access only." });
      return;
    }

    const now = new Date();
    const last24 = new Date(now.getTime() - DAY_MS).toISOString();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const [totalViews, last24Views, todayViews, recentResult] = await Promise.all([
      countPageViews(),
      countPageViews(`&created_at=gte.${encodeURIComponent(last24)}`),
      countPageViews(`&created_at=gte.${encodeURIComponent(todayStart.toISOString())}`),
      supabaseRequest("page_views?select=visitor_id,path,referrer,created_at&order=created_at.desc&limit=5000")
    ]);

    const recentRows = recentResult.data;
    const uniqueVisitors = new Set(recentRows.map((row) => row.visitor_id).filter(Boolean)).size;

    res.status(200).json({
      totalViews,
      last24Views,
      todayViews,
      uniqueVisitors,
      topPages: topBy(recentRows, "path"),
      referrers: topBy(recentRows.filter((row) => row.referrer), "referrer", 3),
      generatedAt: now.toISOString()
    });
  } catch (error) {
    const missingTable = error.status === 404 || String(error.details || error.message).includes("page_views");
    if (missingTable) {
      res.status(200).json({
        setupRequired: true,
        totalViews: 0,
        last24Views: 0,
        todayViews: 0,
        uniqueVisitors: 0,
        topPages: [],
        referrers: [],
        generatedAt: new Date().toISOString()
      });
      return;
    }

    res.status(500).json({ error: error.message });
  }
};
