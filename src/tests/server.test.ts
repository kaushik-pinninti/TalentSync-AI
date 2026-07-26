import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { spawn } from "child_process";

describe("Integration Test - Express Server Health Check", () => {
  // Use port 3123 for tests to prevent port collision
  const testPort = "3123";
  let serverProcess: any;

  console.log(`[TEST] Spawning full-stack server on test port ${testPort}...`);

  beforeAll(async () => {
    // Spawn the server process using tsx so it executes server.ts directly
    const { DATABASE_URL, ...cleanEnv } = process.env;
    serverProcess = spawn("npx", ["tsx", "server.ts"], {
      env: {
        ...cleanEnv,
        PORT: testPort,
        NODE_ENV: "production", // to bypass Vite middleware HMR setup overhead
      },
      detached: true,
    });

    serverProcess.stdout.on("data", (data: any) => {
      console.log(`[SERVER-OUT] ${data.toString().trim()}`);
    });

    serverProcess.stderr.on("data", (data: any) => {
      console.error(`[SERVER-ERR] ${data.toString().trim()}`);
    });

    // Wait for the server to successfully bind to port 3123
    await new Promise((resolve) => setTimeout(resolve, 4500));
  }, 10000);

  afterAll(() => {
    console.log("[TEST] Tearing down test server process...");
    try {
      if (serverProcess && serverProcess.pid) {
        // Kill process group if detached
        process.kill(-serverProcess.pid, "SIGTERM");
      } else if (serverProcess) {
        serverProcess.kill("SIGTERM");
      }
    } catch (e) {
      try {
        if (serverProcess) serverProcess.kill("SIGKILL");
      } catch (err) {
        // ignore if already dead
      }
    }
  });

  it("GET /api/health should return 200 and have status online", async () => {
    const res = await fetch(`http://localhost:${testPort}/api/health`, {
      headers: { "X-Requested-With": "XMLHttpRequest" }
    });
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data.status).toBe("online");
    expect(data.database).toBeDefined();
    expect(data.ai_engine).toBeDefined();
  }, 10000);

  it("GET /api/jobs should block unauthorized requests with 401", async () => {
    const res = await fetch(`http://localhost:${testPort}/api/jobs`, {
      headers: { "X-Requested-With": "XMLHttpRequest" }
    });
    expect(res.status).toBe(401);
  }, 10000);
});

