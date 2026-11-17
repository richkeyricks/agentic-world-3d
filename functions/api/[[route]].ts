// Pages Function: proxy /api/* ke server Mission Control ISA di VM
// (melalui tunnel Serveo) + fallback snapshot terakhir dari KV.
//
// - Menambahkan header `serveo-skip-browser-warning: true` (bypass
//   interstitial Serveo yang didokumentasikan resmi) pada setiap fetch
//   ke origin, sehingga panggilan API tidak pernah kena halaman warning.
// - Meneruskan Cookie / Set-Cookie apa adanya: verifikasi kode akses
//   (scrypt) dan sesi tetap di Express VM, bukan di sini.
// - GET /api/office: bila origin gagal, sajikan snapshot terakhir dari
//   KV dengan flag `degraded: true`. Snapshot ditulis ke KV hanya bila
//   `fetchedAt` berubah (hemat kuota tulis KV 1.000/hari).

const UPSTREAM = "https://isa-office.serveousercontent.com";

const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
]);

interface Env {
  SNAPSHOT_KV?: KVNamespace;
}

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
}): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const route = context.params.route;
  const segments = Array.isArray(route) ? route : route ? [route] : [];
  const upstreamPath = "/api/" + segments.map(encodeURIComponent).join("/");

  const upstream = new URL(UPSTREAM + upstreamPath + url.search);

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set("serveo-skip-browser-warning", "true");

  const isOfficeGet =
    request.method === "GET" && segments.join("/") === "office";

  let upstreamResponse: Response | null = null;
  try {
    upstreamResponse = await fetch(upstream.toString(), {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : request.body,
      // @ts-ignore duplex dibutuhkan bila body berupa stream
      duplex: "half",
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    upstreamResponse = null;
  }

  if (upstreamResponse && upstreamResponse.ok) {
    const outHeaders = new Headers();
    upstreamResponse.headers.forEach((value, key) => {
      if (!HOP_BY_HOP.has(key.toLowerCase())) outHeaders.set(key, value);
    });
    // Teruskan semua Set-Cookie (bisa lebih dari satu)
    const setCookies =
      typeof upstreamResponse.headers.getSetCookie === "function"
        ? upstreamResponse.headers.getSetCookie()
        : [];
    outHeaders.delete("set-cookie");
    for (const cookie of setCookies) outHeaders.append("set-cookie", cookie);

    const body = await upstreamResponse.arrayBuffer();

    // Cache snapshot /api/office ke KV bila isinya berubah.
    if (isOfficeGet && env.SNAPSHOT_KV) {
      try {
        const text = new TextDecoder().decode(body);
        const snap = JSON.parse(text) as { fetchedAt?: string };
        const cached = await env.SNAPSHOT_KV.get("office:snapshot", "json") as
          | { fetchedAt?: string }
          | null;
        if (!cached || cached.fetchedAt !== snap.fetchedAt) {
          await env.SNAPSHOT_KV.put(
            "office:snapshot",
            JSON.stringify({ fetchedAt: snap.fetchedAt, body: text }),
          );
        }
      } catch {
        // Gagal cache tidak boleh menggagalkan respons.
      }
    }

    return new Response(body, {
      status: upstreamResponse.status,
      headers: outHeaders,
    });
  }

  // Origin gagal / status error.
  if (isOfficeGet && env.SNAPSHOT_KV) {
    try {
      const cached = await env.SNAPSHOT_KV.get("office:snapshot", "json") as
        | { body?: string; fetchedAt?: string }
        | null;
      if (cached && cached.body) {
        const snap = JSON.parse(cached.body) as Record<string, unknown>;
        snap.degraded = true;
        return new Response(JSON.stringify(snap), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
    } catch {
      // Lanjut ke error di bawah.
    }
  }

  const status = upstreamResponse ? upstreamResponse.status : 502;
  return new Response(
    JSON.stringify({
      error: "upstream_unavailable",
      status,
      degraded: true,
    }),
    { status, headers: { "content-type": "application/json" } },
  );
}
