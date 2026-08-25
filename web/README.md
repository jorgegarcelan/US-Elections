# County by County website

The public-facing Next.js application for the U.S. Elections project.

## Routes

- `/` — editorial overview and project narrative
- `/explore` — historical-only election atlas plus searchable state/county result tables
- `/variables` — demographic maps with variable, 2024 winner and combined comparison layers
- `/results` — reproducible 1,000-run model result, final map, EV distribution and explainability
- `/simulations` — laboratory for configuring and launching new stochastic runs
- `/prediction` — model selection and Monte Carlo simulation
- `/methodology` — data and modelling pipeline
- `/data` — sources, variable groups and downloadable datasets
- `/api/predict` — same-origin proxy to the FastAPI service
- `/api/explain` — same-origin proxy for model-native global feature importance

## Configuration

Copy `.env.example` to `.env.local` and set:

```text
PREDICTION_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`PREDICTION_API_URL` remains server-side. The browser never needs to know the backend address.

## Development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm run build
```
