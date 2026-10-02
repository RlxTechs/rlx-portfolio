const SUPABASE_URL = "https://uwfyfuoiksjgyxoovxfn.supabase.co";
const SUPABASE_KEY = "sb_publishable_f4RpmT2AsQToBtiBiI6hBg_kqSZbwCj";

function header(req, name) {
  const v = req.headers?.[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : (v || "");
}

function parseClient(req, payload) {
  const ua = header(req, "user-agent");
  const platformHint = header(req, "sec-ch-ua-platform").replaceAll('"', "");
  const mobileHint = header(req, "sec-ch-ua-mobile");

  let browser = "Autre";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";

  let os = platformHint || "Autre";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS / iPadOS";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  const mobile = mobileHint === "?1" || /Android|iPhone|iPod|Mobile/i.test(ua);
  const tablet = /iPad|Tablet/i.test(ua);

  return {
    user_agent: ua.slice(0, 800),
    platform: payload.platform || platformHint || null,
    browser: payload.browser || browser,
    os: payload.os || os,
    device_type: payload.device_type || (tablet ? "Tablette" : mobile ? "Mobile" : "Ordinateur")
  };
}

function safeDecode(v) {
  if (!v) return null;
  try { return decodeURIComponent(v); } catch { return v; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const allowed = new Set(["page_view", "download", "product_click", "tool_open"]);

    if (!allowed.has(payload.event_type) || typeof payload.session_id !== "string" || payload.session_id.length < 8) {
      return res.status(400).json({ ok: false, error: "Invalid analytics payload" });
    }

    const client = parseClient(req, payload);
    const countryCode = header(req, "x-vercel-ip-country") || null;
    const region = header(req, "x-vercel-ip-country-region") || null;
    const city = safeDecode(header(req, "x-vercel-ip-city"));

    const row = {
      event_type: payload.event_type,
      session_id: payload.session_id.slice(0, 120),
      path: String(payload.path || "/").slice(0, 500),
      page_title: payload.page_title ? String(payload.page_title).slice(0, 300) : null,
      asset_slug: payload.asset_slug ? String(payload.asset_slug).slice(0, 300) : null,
      referrer: payload.referrer ? String(payload.referrer).slice(0, 1000) : null,
      locale: payload.locale ? String(payload.locale).slice(0, 80) : null,
      timezone: payload.timezone ? String(payload.timezone).slice(0, 120) : null,
      screen_width: Number.isFinite(payload.screen_width) ? payload.screen_width : null,
      screen_height: Number.isFinite(payload.screen_height) ? payload.screen_height : null,
      viewport_width: Number.isFinite(payload.viewport_width) ? payload.viewport_width : null,
      viewport_height: Number.isFinite(payload.viewport_height) ? payload.viewport_height : null,
      device_type: client.device_type,
      browser: client.browser,
      os: client.os,
      platform: client.platform,
      user_agent: client.user_agent,
      country_code: countryCode,
      country_name: null,
      region,
      city,
      metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {}
    };

    const response = await fetch(SUPABASE_URL + "/rest/v1/analytics_events", {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(row)
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("analytics insert failed", response.status, detail);
      return res.status(202).json({ ok: false });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("analytics function error", error);
    return res.status(202).json({ ok: false });
  }
}
