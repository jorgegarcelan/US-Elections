export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const requestedLimit = Number(incoming.searchParams.get("limit") ?? 280);
  const limit = Math.min(500, Math.max(80, Number.isFinite(requestedLimit) ? requestedLimit : 280));
  const apiBase = process.env.PREDICTION_API_URL ?? "http://127.0.0.1:8000";

  try {
    const response = await fetch(`${apiBase}/explain-local?limit=${limit}`, { cache: "no-store" });
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    const fallback = await fetch(new URL("/data/explain-local-xgboost-280.json", incoming.origin), { cache: "force-cache" });
    return new Response(await fallback.text(), {
      status: fallback.status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" },
    });
  }
}
