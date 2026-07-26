# 🚀 TalentSync AI - Enterprise Deployment Guide

This guide details the steps to build, configure, verify, and deploy the **TalentSync AI Resume Screening Platform** to production environments. It covers containerization, database setup, environment variables, full-stack monolith deployment, and decoupled split deployments.

---

## 📋 Architectural Overview

The application is structured to support **two highly flexible production deployment strategies**:

1. **Unified Monolithic Node.js Container (Recommended)**:
   - A single, self-contained Docker container that serves both the **React frontend** (compiled statically) and the **Express API backend** on port `3000`.
   - **Perfect for**: Render Web Services, Cloud Run, AWS App Runner, or VPS hosting.
2. **Decoupled Split Deployment (Vercel + Render)**:
   - **Frontend**: Statically built and served via **Vercel** CDN for ultra-fast load times.
   - **Backend**: Hosted on **Render.com** (as either the Node.js Express server or the Python FastAPI server) serving API endpoints on port `3000`.
   - **Bridge**: Vercel utilizes `vercel.json` rewrites to proxy `/api/*` traffic directly to Render, eliminating CORS issues.

---

## 1. 🐘 Database Setup: Neon PostgreSQL

Both backend runtimes (Node.js and Python) are built on connection-resilient database adapters. When a `DATABASE_URL` is set, they automatically bootstrap database tables and run migrations. If absent, they fall back safely to a localized JSON flat-file storage directory to prevent container startup crashes.

### Provisioning Steps
1. Navigate to [Neon Console](https://neon.tech/) and sign in.
2. Create a new project and select your preferred cloud provider and region.
3. Choose the **PostgreSQL 15** or **16** engine.
4. Copy your **Connection String** from the dashboard.
5. **Critical Security Config**: Append `?sslmode=require` to the connection string to enforce secure, encrypted SSL transit.
   - Example: `postgresql://username:password@ep-cool-cloud.neon.tech/neondb?sslmode=require`

---

## 2. 🐋 Local Deployment: Docker & Docker-Compose

To build and verify the application locally with a persistent database identical to production:

### Verify Local Configuration
1. Open `.env.example` and copy its structure to a new `.env` file:
   ```bash
   cp .env.example .env
   ```
2. Insert your Google Gemini API key inside `GEMINI_API_KEY`.
3. In `docker-compose.yml`, the application uses the multi-stage Dockerfile. By default, it targets the **`runner-node`** (monolithic Node.js app). To test the Python FastAPI service, modify the build target in `docker-compose.yml`:
   ```yaml
   build:
     context: .
     target: runner-python
   ```

### Launch Container Cluster
1. Run the following command to compile, build, and start the services:
   ```bash
   docker-compose up --build
   ```
2. The Postgres container (`talentsync-db`) will spin up first, verify its health state via `pg_isready`, and only then allow the main app container (`talentsync-app`) to boot.
3. Access the SaaS application interface at `http://localhost:3000`.

---

## 3. 🚀 Render.com Deployment (Backend API or Monolith)

Render reads the `render.yaml` blueprint file in your repository root to configure and provision your cloud server instantly.

### Deployment Process
1. Push your repository to **GitHub** or **GitLab**.
2. Log into the [Render Dashboard](https://render.com/).
3. Click **New +** and select **Blueprint Route**.
4. Connect your repository. Render will automatically parse your `render.yaml` and configure a web service named `talentsync-platform`.
5. Enter your environment variables when prompted:
   - `DATABASE_URL`: Your secure Neon connection string (`?sslmode=require`).
   - `GEMINI_API_KEY`: Your real Google Gemini AI API Key.
   - **JWT Keys**: Render will automatically pre-generate secure 32-character hex hashes for `JWT_SECRET`, `JWT_SECRET_KEY`, and `JWT_REFRESH_SECRET_KEY`.
6. Click **Deploy**. Render will build the multi-stage Docker container (using the monolithic Node target), bind to `0.0.0.0:3000`, and provide a production HTTPS URL (e.g., `https://talentsync-platform.onrender.com`).

---

## 4. ⚡ Vercel Deployment (Decoupled Frontend)

Vercel is the premier option for serving the compiled static React/Vite SPA.

### Deployment Process
1. Log into the [Vercel Dashboard](https://vercel.com/).
2. Click **Add New** > **Project** and select your connected GitHub repository.
3. **Framework Preset**: Vercel automatically detects **Vite**.
4. **Build and Output Settings**: Keep default values (`npm run build` and `/dist` directory).
5. **No Environment Variables Needed**: Since the frontend uses clean, relative API routing (`/api/*`), you do not need to hardcode API URLs or secrets!
6. Click **Deploy**. Vercel will host your static assets.

### Route Rewrites Config (`vercel.json`)
Our configured `vercel.json` ensures:
- **Relative Proxying**: All requests on `/api/*` are cleanly proxied to your Render backend domain, preventing cross-origin blockages.
- **SPA Router Fallback**: All client route URLs (e.g., `/jobs`, `/candidates`) are directed to `index.html` to avoid 404 errors on browser reload.
- **Security Headers**: Mounts standard security constraints (`X-Frame-Options`, `X-Content-Type-Options`, and browser XSS filters).

---

## 🛠️ GitHub Actions CI/CD Pipeline

The project includes an enterprise-grade automation workflow located at `.github/workflows/ci-cd.yml` that executes on every push to major branches (`main`, `master`, `production`) and all pull requests.

### Pipeline Stages
1. **Quality Gate & Testing (`verify-and-test`)**:
   - Sets up a Node.js 20 environment with automated NPM package caching.
   - Installs clean dependencies via `npm ci`.
   - Runs TypeScript compilation type-checks (`npm run lint`).
   - Executes the backend integration test suite (`npm run test`) to verify server endpoint vitality.
2. **Dockerization Integrity Check (`container-verification`)**:
   - Spins up Docker Buildx engine in the runner.
   - Builds the production multi-stage monolithic Node runner Docker image (`runner-node`) to ensure container builds remain compile-safe and free of dependency discrepancies.
3. **Continuous Deployment (`deploy-production`)**:
   - Triggers only on merging/pushing to deployment branches.
   - Sends a secure POST request to the **Render Deploy Hook URL** to initiate immediate zero-downtime rolling upgrades.
   - Connects to Vercel's Edge API via secure tokens to deploy static asset layers.

### Required Secrets Configuration
To enable the continuous deployment stage, define the following variables in **GitHub Repository Settings > Secrets and Variables > Actions**:
- `RENDER_DEPLOY_HOOK_URL`: Get this URL from your Render service dashboard under *Deploy Hook*.
- `VERCEL_TOKEN`: Your Vercel API access token.
- `VERCEL_ORG_ID`: Your Vercel organizational scope ID.
- `VERCEL_PROJECT_ID`: Your Vercel target project ID.

---

## 🧪 Automated Testing Suite

The application includes an integration testing suite located at `/src/tests/server.test.ts`. This utilizes Node.js's built-in high-performance, native test-runner to eliminate heavy package footprints and guarantee quick, clean run times.

### Test Coverage
- **Server Startup & Binding**: Validates that the Express application initiates, configures core middleware (Helmet, CSRF Protection, and sanitizers), and binds successfully to custom ports.
- **Trial Sandbox Auto-Fallback**: Ensures that when no `DATABASE_URL` is set, the application starts immediately, mapping routes securely using file-based storage.
- **Active Health Diagnostics (`/api/health`)**: Validates that the JSON payload returns online states, current db engines, and active AI models.
- **Route Authorization Safeguards**: Assures that administrative or member-only endpoints (such as `/api/jobs`) correctly throw `415` or `401 Unauthorized` responses when requests lack proper session JWT vectors.

### Running Tests Locally
To execute the tests in your local sandbox environment:
```bash
npm run test
```

---

## 📊 Enterprise Logging, Observability & Auditing

The application implements a multi-layer telemetry framework ensuring complete audit trails and performance traceability for high-compliance enterprise environments.

### 1. HTTP Traffic Logs
Every request arriving at the server is processed through a high-fidelity logging middleware, writing structured details directly to the stdout/stderr stream (standard for container orchestrators like GCP Stackdriver, Datadog Agent, or AWS CloudWatch):
- Logs follow the structure: `[HTTP] <METHOD> <URL> - Status: <STATUS> - <DURATION>ms`
- Facilitates quick extraction of slow API calls or abnormal rate-limiting trigger frequencies.

### 2. Forensic Security Audit Logs
Critical actions (e.g., failed login attempts, recruiter creation, job postings, resume scans, and data exports) are captured and logged to a structured, persistent system audit table (`audit_logs` in PostgreSQL or localized in JSON databases):
- **Fields Capture**: Traces User ID, Actor Email, Action Type, Detailed String Payload, IP Address, and timestamp.
- **Admin Visibility**: Accessible inside the application by administrator accounts through `/api/admin/audit-logs`, enabling direct tracing of credential use, anomalous queries, or rate anomalies.

---

## 📈 Monitoring & APM Strategy

For high-availability production architectures, the following telemetry targets are recommended:

### 1. System Metrics (Host & Container)
- **CPU & Memory Thresholds**: Configure alerts on your host orchestrator (Render starter plans or Cloud Run) to trigger when CPU exceeds **85%** or memory climbs beyond **90%** of limits.
- **Uptime Pings**: Attach health monitors (e.g., Better Stack, UptimeRobot, or AWS Route53) to ping `https://your-domain.com/api/health` every 60 seconds, verifying status `online`.

### 2. Error Budgets & Tracking
- Integrate **Sentry** or **LogRocket** in the server entry point (`server.ts`) to capture unhandled exceptions or 500 error spikes in real-time, sending instant PagerDuty or Slack alerts.

---

## 🩺 Production Diagnostics & Health Checks

### 1. Active Health Probe
The application exposes an active health endpoint on `/api/health`. This route returns system status, database engine, and AI engine status:
- **Endpoint**: `https://your-domain.com/api/health`
- **Output (Node)**:
  ```json
  {
    "status": "online",
    "database": "PostgreSQL (Neon)",
    "ai_engine": "Gemini Live"
  }
  ```

### 2. High Payload Capacity
Express and FastAPI are configured to support up to **20MB payloads** for uploading highly detailed documents, raw resume copies, and PDFs:
- **Node**: `express.json({ limit: "20mb" })`
- **Python**: Structured JSON payloads with exception interceptors.

### 3. Graceful Error Fallbacks
If the Google Gemini service fails, or your monthly tier has been exhausted:
- The APIs intercept `502 Bad Gateway` exceptions gracefully.
- Clear, sanitized user-facing alerts are displayed in the UI, while full, detailed stack-traces are safely output to internal container streams (`console.error`).
