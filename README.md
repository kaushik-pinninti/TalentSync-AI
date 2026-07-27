# TalentSync AI - Enterprise SaaS Resume Screening & Hiring Copilot Platform

TalentSync AI is a production-grade commercial HR SaaS platform designed to streamline talent sourcing, candidate screening, and interviewing processes using advanced AI engines. Recruiters can post job listings, upload applicant resumes (PDF, DOCX, TXT), compute exact candidate-to-job fit matching, generate custom-tailored interview panels, and converse with a context-aware recruiting copilot.
---

## 🌐 Live Demo

🚀 Try the application here:

**Live Application:** https://talent-sync-ai-tau.vercel.app/

Experience AI-powered resume screening, candidate matching, interview generation, and recruiter copilot features directly in the deployed platform.

---

## 🌟 Primary Features

1. **Recruiter Onboarding & Auth**: Secure JWT-based password authentication, credential hashing via bcrypt, and auto-persistent active user sessions.
2. **Interactive Telemetry Dashboard**: Complete data analytics covering total open job positions, applicant pool velocity, AI coverage ratios, average pipeline fit scores, and visual chart distributions (Application intake trends, hiring stage funnels, and core skills frequencies) using **Recharts**.
3. **Structured Job Creation**: Fully customizable job boards with location, salary range, employment type filters, and required skills tag lists.
4. **AI-Powered Resume Parsing**: Uses **Gemini 3.5 Flash** on the backend to dynamically parse raw uploaded resumes and extract structured profiles (Name, Email, Phone, Skills list, Education snapshot, and Work History summaries).
5. **AI Fit Matching & Scores**: Assigns weighted scores (Overall fit, Skills alignment, Experience fit, and Educational suitability) and returns custom justifications explaining **WHY** each candidate received their rating.
6. **Tailored Interview Suite Planner**: Generates unique technical, behavioral, coding, system design, and candidate-project based questions with concrete expected evaluation points and customizable difficulty filters.
7. **Recruiter Copilot Chat**: Context-grounded chat companion allowing hiring managers to ask "Who is my best candidate?", "Find React profiles", or "Compare Alice and Bob" in natural language.
8. **Double-Engine Resilience**: Operates on a connection-resilient database layer. Automatically bootstraps tables and syncs data to **Neon PostgreSQL** if configured. Fallback engines dynamically redirect data to file-backed stores (Local JSON DB) if offline, preventing startup errors.

---

## 📁 Repository Structure

```
├── /data/                  # Fallback local file database storage
├── /src/
│   ├── /components/        # Modular client component views
│   │   ├── AuthScreen.tsx          # Credentials and fast-track trials
│   │   ├── DashboardStats.tsx      # Metrics and Recharts telemetry
│   │   ├── JobsSection.tsx         # Job creation and boards
│   │   ├── CandidateSection.tsx    # Drag-drop resume zone & search filters
│   │   ├── MatchDrawer.tsx         # Fit scoring and text/CSV report exporters
│   │   ├── InterviewSuite.tsx      # Interview panel generators
│   │   ├── CopilotChat.tsx         # Context-grounded chat drawer
│   │   └── SettingsSection.tsx     # Infrastructure diagnostics
│   ├── App.tsx             # State manager & views router
│   ├── types.ts            # Core TypeScript interfaces
│   ├── db.ts               # Resilient database connection pool
│   ├── gemini.ts           # Gemini AI SDK core integrations
│   ├── index.css           # Tailwind configurations & fonts
│   └── main.tsx            # App entry point
├── server.ts               # Full-stack backend Express server
├── package.json            # Scripts and dependencies
├── Dockerfile              # Docker image config
├── docker-compose.yml      # Local multi-service container compose
├── render.yaml             # Render deployment blueprints
└── vercel.json             # Vercel routing fallbacks
```

---

## ⚙️ Environment Configurations

Create a `.env` file or enter keys in your host provider settings using the following template:

```env
# Google Gemini API key used for resume parsing and matching
GEMINI_API_KEY="AI_STUDIO_INJECTED_KEY"

# Neon PostgreSQL connection string (supports auto-initialization)
# Leave blank to test instantly in sandboxed local file database mode!
DATABASE_URL="postgresql://user:pass@ep-cool-cloud.neon.tech/main?sslmode=require"

# JWT token signature secret
JWT_SECRET="enterprise-secure-jwt-secret-key-1337"

# Host variables
NODE_ENV="production"
PORT="3000"
```

---

## 🛠️ Local Development & Execution

Ensure you have **Node.js 20+** installed. Follow these instructions:

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Full-Stack Hot-Reload Dev Server
Runs the Express backend server on port `3000` while mounting Vite middleware in parallel to hot-serve client resources:
```bash
npm run dev
```

### 3. Build and Start Standalone Production Bundle
Compiles Vite static clients to `/dist` and bundles TypeScript backend files to optimized CJS common bundles using `esbuild`:
```bash
npm run build
npm start
```

---

## 🐋 Docker Containerization

To spin up a local instance including a dedicated PostgreSQL database container:

```bash
docker-compose up --build
```
Once initialized, access the SaaS cockpit at `http://localhost:3000`.

---

## 🚀 Cloud Deployment Guides

The platform supports both high-performance **Unified Monolithic Node.js** container deployment and **Decoupled Frontend-Backend** split configurations.

For detailed, step-by-step instructions on database setup, environment variable configs, SSL constraints, and cloud console walk-throughs, refer to the comprehensive:

👉 **[TalentSync AI - Deployment Guide (DEPLOYMENT_GUIDE.md)](./DEPLOYMENT_GUIDE.md)**

---

## 🩺 System Troubleshooting

- **Server stuck on startup**: Ensure port `3000` is free. The AI Studio sandboxed proxy requires binding exclusively to `0.0.0.0:3000`.
- **Database authentication failures**: If using Neon PostgreSQL, append `?sslmode=require` to the end of your `DATABASE_URL` string.
- **AI elements display blank**: Check your console logs. If `GEMINI_API_KEY` is not present, the system defaults to Sandbox Trial outputs. Make sure to paste your Gemini API key in **Settings > Secrets**.
