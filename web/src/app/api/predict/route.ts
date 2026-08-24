const allowedModels = new Set(["xgboost", "random_forest", "ridge"]);

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const model = incoming.searchParams.get("model") ?? "ridge";
  const requestedSimulations = Number(incoming.searchParams.get("n_sim") ?? 200);
  const nSim = Math.min(1000, Math.max(10, Number.isFinite(requestedSimulations) ? requestedSimulations : 200));
  const requestedSeed = incoming.searchParams.get("seed");
  const parsedSeed = requestedSeed === null ? null : Number(requestedSeed);
  const seed = parsedSeed !== null && Number.isInteger(parsedSeed) && parsedSeed >= 0 ? Math.min(parsedSeed, 2_147_483_647) : null;

  if (!allowedModels.has(model)) return Response.json({ detail: "Unsupported model" }, { status: 400 });

  const apiBase = process.env.PREDICTION_API_URL ?? "http://127.0.0.1:8000";
  try {
    const query = new URLSearchParams({ n_sim: String(nSim), model });
    if (seed !== null) query.set("seed", String(seed));
    const response = await fetch(`${apiBase}/predict?${query}`, { cache: "no-store" });
    const body = await response.text();
    return new Response(body, { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
  } catch {
    return Response.json({ detail: "Prediction service unavailable" }, { status: 503 });
  }
}
