# County by County website

The public-facing Next.js application for the U.S. Elections project.

## Routes

- `/` — editorial overview and project narrative
- `/explore` — historical county atlas for 2016, 2020 and 2024
- `/prediction` — model selection and Monte Carlo simulation
- `/methodology` — data and modelling pipeline
- `/data` — sources, variable groups and downloadable datasets
- `/api/predict` — same-origin proxy to the FastAPI service

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
