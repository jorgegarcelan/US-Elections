# County by County — U.S. Elections

An interactive data story about the 2016, 2020 and 2024 U.S. presidential elections. The project connects county-level election returns with demographic and socioeconomic data, then uses several machine-learning models and Monte Carlo simulation to explore possible outcomes.

## What is included

- A multi-page Next.js website with an editorial home, interactive atlas, prediction lab, methodology and data downloads.
- Harmonised county datasets for the 2016, 2020 and 2024 cycles.
- Census ACS variables covering population, education, race, income, employment and other local characteristics.
- Ridge, Random Forest and XGBoost delta models.
- A FastAPI service that aggregates county predictions into state results and Electoral College simulations.
- Jupyter notebooks documenting collection, processing, analysis, modelling and simulation.

## Project structure

```text
api/             FastAPI prediction service
data/            Raw and prepared tabular datasets
geo/             Census county boundaries
imgs/            Analysis exports and figures
models/          Trained model artifacts
web/             Next.js website
*.ipynb          Reproducible analysis pipeline
```

## Run locally

### 1. Prediction API

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
```

The API exposes `GET /health` and `GET /predict?n_sim=200&model=ridge`.

### 2. Website

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The website calls its own `/api/predict` route, which proxies to `PREDICTION_API_URL`.

## Interpretation and limitations

- County deltas are stored and displayed in percentage points.
- Popular-vote figures in the atlas show the two-party vote share.
- Alaska is not included in county modelling because its election reporting geography is not directly comparable; its three electoral votes remain unallocated in model outputs.
- The model is exploratory. It does not ingest live polling, candidates, campaign events or causal effects.
- ACS values are survey estimates and neighbouring counties are not statistically independent.

## Authors

[Lucía Cordero](https://github.com/lucia-corsan) and [Jorge Garcelán](https://github.com/jorgegarcelan).

MIT License.
