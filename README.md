# CleanAir

Monorepo for the Clean Cloud web app ([cleancloud.cleanair.com](https://cleancloud.cleanair.com)): an **Express** API with a **React** SPA, **MongoDB**, **Redis**, a small **Python** helper process, and **AWS** (S3, SES, CloudWatch). AWS Lambda utilities live under `utils/lambdas/` (each area may have its own `readme.md`).

## Prerequisites

- **Node.js** >= 12 and **npm** >= 6
- **MongoDB** (Atlas or self-hosted) — connection string required
- **Redis** running locally (default client options), or a compatible server such as [Memurai](https://www.memurai.com/get-memurai) on Windows
- **Python 3** with packages from `utils/python/requirements.txt` (started automatically with the main server)

## Install

From the repository root:

```bash
npm install
npm run clientinstall
npm run pythoninstall
```

## Environment

Create a `.env` file in the **repository root** (same level as `server.js`). The app loads it via `dotenv`.

| Variable | Required for main app | Purpose |
|----------|------------------------|---------|
| `DBURI` | Yes | MongoDB connection string (Mongoose + MongoDB driver) |
| `MONGO_DATABASE` | For SDK collection helpers | MongoDB database name |
| `AWS_ACCSSKEY` | If using AWS features | AWS access key ID (name matches code) |
| `AWS_SECRETKEY` | If using AWS features | AWS secret access key |
| `AWS_REGION` | If using AWS features | e.g. `us-east-1` |
| `PORT` | No | HTTP API port (default **5000**) |
| `PYPORT` | No | Python sidecar port argument (default **5001**) |

Lambda and utility scripts under `utils/lambdas/` and `utils/python/` may require additional variables (queues, buckets, etc.); see those folders’ docs or entry scripts.

## Run locally

| Command | What it runs |
|---------|----------------|
| `npm run dev` | API (`nodemon`) + **Redis** |
| `npm run devfull` | API + Redis + **React dev server** (port 3000, proxies API to port 5000) |
| `npm start` | Production-style: `node server.js` (expects `client/build` for static files) |
| `npm run client` | React app only (`react-scripts start`) |

For a production-like static front end:

```bash
cd client && npm run build && cd .. && npm start
```

The API listens on `PORT` (default 5000). Socket.IO is configured for `http://localhost:3000` in development; adjust `server.js` if your dev origin differs.

## Repository layout

- `server.js` — HTTP server, routes, static SPA, Socket.IO
- `routes/` — REST API modules (`/api/users`, `/api/auth`, `/api/widgets`, etc.)
- `client/` — Create React App front end
- `utils/database/` — Mongoose models and MongoDB client
- `utils/redis/`, `utils/aws/`, `utils/python/` — integrations
- `utils/lambdas/` — AWS Lambda and batch-style jobs (see nested `readme.md` files where present)

## Client

The React app’s proxy targets `http://localhost:5000` (see `client/package.json`). For more detail, see `client/README.md`.
