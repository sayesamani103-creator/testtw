export const config = { runtime: "edge" };

const UPSTREAM_URL = (process.env.UPSTREAM_HOST || "").replace(/\/$/, "");

const EXCLUDED_KEYS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

export default async function handleRequest(req) {
  if (!UPSTREAM_URL) {
    return new Response("Service Configuration Error", { status: 503 });
  }

  try {
    const pIdx = req.url.indexOf("/", 8);
    const dest =
      pIdx === -1 ? UPSTREAM_URL + "/" : UPSTREAM_URL + req.url.slice(pIdx);

    const fwdHeaders = new Headers();
    let originIp = null;
    
    for (const [key, val] of req.headers) {
      if (EXCLUDED_KEYS.has(key)) continue;
      if (key.startsWith("x-vercel-")) continue;
      if (key === "x-real-ip") {
        originIp = val;
        continue;
      }
      if (key === "x-forwarded-for") {
        if (!originIp) originIp = val;
        continue;
      }
      fwdHeaders.set(key, val);
    }
    
    if (originIp) fwdHeaders.set("x-forwarded-for", originIp);

    const reqMethod = req.method;
    const payloadExists = reqMethod !== "GET" && reqMethod !== "HEAD";

    return await fetch(dest, {
      method: reqMethod,
      headers: fwdHeaders,
      body: payloadExists ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch (err) {
    // حذف لاگ ارور برای جلوگیری از ثبت در سیستم مانیتورینگ ورسل
    return new Response("Gateway Timeout", { status: 504 });
  }
}
