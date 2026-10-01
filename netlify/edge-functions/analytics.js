const SUPABASE_URL = "https://uwfyfuoiksjgyxoovxfn.supabase.co";
const SUPABASE_KEY = "sb_publishable_f4RpmT2AsQToBtiBiI6hBg_kqSZbwCj";

function parseClient(request, payload) {
  const ua = request.headers.get("user-agent") || "";
  const platformHint = (request.headers.get("sec-ch-ua-platform") || "").replaceAll('"', "");
  const mobileHint = request.headers.get("sec-ch-ua-mobile");
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
    device_type: payload.device_type || (tablet ? "Tablette" : mobile ? "Mobile" : "Ordinateur"),
  };
}

export default async (request, context) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405, headers: { "content-type": "application/json" }
    });
  }

  try {
    const payload = await request.json();
    const allowed = new Set(["page_view", "download", "product_click", "tool_open"]);
    if (!allowed.has(payload.event_type) || typeof payload.session_id !== "string" || payload.session_id.length < 8) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid analytics payload" }), {
        status: 400, headers: { "content-type": "application/json" }
      });
    }

    const geo = context?.geo || {};
    const client = parseClient(request, payload);
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
      country_code: geo?.country?.code || geo?.country?.countryCode || null,
      country_name: geo?.country?.name || null,
      region: geo?.subdivision?.name || geo?.subdivision?.code || null,
      city: geo?.city || null,
      metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {}
    };

    const res = await fetch(SUPABASE_URL + "/rest/v1/analytics_events", {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(row)
    });

    if (!res.ok) {
      const detail = await res.text();
      console.log("analytics insert failed", res.status, detail);
      return new Response(JSON.stringify({ ok: false }), { status: 202, headers: { "content-type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e) {
    console.log("analytics edge error", e?.message || e);
    return new Response(JSON.stringify({ ok: false }), { status: 202, headers: { "content-type": "application/json" } });
  }
};