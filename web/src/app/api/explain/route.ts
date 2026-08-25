const allowedModels = new Set(["xgboost", "random_forest", "ridge"]);

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const model = incoming.searchParams.get("model") ?? "xgboost";
  if (!allowedModels.has(model)) {
    return Response.json({ detail: "Unsupported model" }, { status: 400 });
  }

  const apiBase = process.env.PREDICTION_API_URL ?? "http://127.0.0.1:8000";
  try {
    const response = await fetch(`${apiBase}/explain?model=${model}`, { cache: "no-store" });
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    const fallback = await fetch(new URL(`/data/explain-${model}.json`, incoming.origin), { cache: "force-cache" });
    return new Response(await fallback.text(), {
      status: fallback.status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" },
    });
  }
}
