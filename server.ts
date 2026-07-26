import express from "express";
import path from "path";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import os from "os";
import fs from "fs";
import nodemailer from "nodemailer";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";
import { db, initDatabase, isPostgres, pool } from "./src/db";
import { parseResumeWithAI, matchCandidateWithAI, generateInterviewQuestionsWithAI, askCopilotWithAI, askCopilotWithAIStream, generateJobDescriptionWithAI } from "./src/gemini";

const JWT_SECRET = process.env.JWT_SECRET || "enterprise-secure-jwt-secret-key-1337";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "enterprise-secure-jwt-refresh-secret-key-9876";

async function startServer() {
  // Initialize Database connection (PostgreSQL with Local JSON Fallback)
  await initDatabase();

  const app = express();
  const PORT = 3000;

  // 1. HELMET - Secure standard HTTP headers against sniffing/hijacking
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://apis.google.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "referrerpolicy"],
        connectSrc: ["'self'", "ws:", "wss:", "https://*", "http://*"],
        frameAncestors: ["'self'", "https://*.run.app", "https://ai.studio", "https://*.google.com"],
        upgradeInsecureRequests: null, // Disable automatic upgrading of requests to prevent mixed content issues on sandbox domains
      }
    },
    frameguard: false, // Disable X-Frame-Options SAMEORIGIN to allow rendering inside the AI Studio preview iframe
    hsts: process.env.NODE_ENV === "production", // Enable HSTS only in production to prevent local/sandbox HTTP issues
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));

  // 2. COOKIE-PARSER - Handle secure HttpOnly credentials
  app.use(cookieParser());

  // 3. RATE LIMITING - Protect against brute force and DoS
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // Limit each IP to 300 requests per 15 mins
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again after 15 minutes." },
    skip: (req) => process.env.NODE_ENV !== "production"
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Limit to 30 login/signup attempts
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login or registration attempts. Please try again in 15 minutes." },
    skip: (req) => process.env.NODE_ENV !== "production"
  });

  // Apply general API rate limiter
  app.use("/api/", apiLimiter);

  // Use increased payload limits to handle PDF/DOCX resume copy-pastes/uploads
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ extended: true, limit: "20mb" }));

  // 4. SECURE CORS - Dynamic origin filtering instead of wildcards
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      const isAllowed = /localhost|127\.0\.0\.1|\.run\.app|ai\.studio/.test(origin);
      if (isAllowed) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
      }
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-CSRF-Token");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // 5. CSRF PROTECTION - Prevent cross-origin script-initiated POST/PUT/DELETE
  app.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }
    const hasHeader = req.headers["x-requested-with"] || req.headers["authorization"] || req.headers["x-csrf-token"];
    if (!hasHeader) {
      return res.status(403).json({ error: "CSRF verification failed: Secure request header missing." });
    }
    next();
  });

  // 6. XSS PROTECTION & INPUT VALIDATION - Recursively sanitize request parameters
  function sanitizePayload(obj: any): any {
    if (typeof obj === "string") {
      return obj
        .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
        .replace(/on\w+="[^"]*"/gi, "")
        .replace(/javascript:/gi, "");
    } else if (Array.isArray(obj)) {
      return obj.map(item => sanitizePayload(item));
    } else if (obj !== null && typeof obj === "object") {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitizePayload(obj[key]);
      }
      return sanitized;
    }
    return obj;
  }

  app.use((req, res, next) => {
    if (req.body) {
      req.body = sanitizePayload(req.body);
    }
    if (req.query) {
      req.query = sanitizePayload(req.query);
    }
    next();
  });

  // Helper: Enforce strict password policy rules
  function validatePasswordStrength(password: string): string | null {
    if (password.length < 8) {
      return "Password must be at least 8 characters long.";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter.";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter.";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one digit.";
    }
    if (!/[@$!%*?&_#^]/.test(password)) {
      return "Password must contain at least one special character (e.g., @$!%*?&_#^).";
    }
    return null;
  }

  // Custom request logging middleware for observability and debugging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      console.log(`[HTTP] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms`);
    });
    next();
  });

  // Middleware: Authenticate JWT Token
  function authenticateToken(req: any, res: any, next: any) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) {
        return res.status(403).json({ error: "Session expired or invalid token" });
      }
      req.user = decoded;
      next();
    });
  }

  // Middleware: Authenticate Admin Access
  async function authenticateAdmin(req: any, res: any, next: any) {
    authenticateToken(req, res, async () => {
      try {
        const user = await db.users.findById(req.user.id);
        if (!user || user.role !== "admin") {
          return res.status(403).json({ error: "Access denied: Admin privileges required" });
        }
        next();
      } catch (err) {
        res.status(500).json({ error: "Failed to verify administrator status" });
      }
    });
  }

  // Helper: Log Action to System Audit Logs
  async function logAudit(userId: number | undefined, email: string | undefined, action: string, details: string, req: express.Request) {
    try {
      const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
      await db.auditLogs.create({
        user_id: userId,
        user_email: email,
        action,
        details,
        ip_address: ip
      });
    } catch (err) {
      console.error("System Logging Error:", err);
    }
  }

  // =========================================================================
  // AUTHENTICATION ENDPOINTS
  // =========================================================================

  // =========================================================================
  // AUTHENTICATION ENDPOINTS
  // =========================================================================

  app.post("/api/auth/signup", authLimiter, async (req, res) => {
    const { email, password, name, company } = req.body;
    if (!email || !password || !name || !company) {
      return res.status(400).json({ error: "Please fill out all fields" });
    }

    // Enforce Password Policy Complexity
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    try {
      // Check if user exists
      const existing = await db.users.findByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "Email already registered" });
      }

      // Automatically promote the first user to 'admin' for flawless setup
      const allUsers = await db.users.listAll();
      const role = allUsers.length === 0 ? "admin" : "recruiter";

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await db.users.create({ 
        email, 
        passwordHash, 
        name, 
        company, 
        role, 
        status: "active" 
      });

      // Generate secure tokens: 1h access token, 7d refresh token
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role, status: user.status }, JWT_SECRET, { expiresIn: "1h" });
      const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: "7d" });

      // Save refresh token hash
      const refreshHash = await bcrypt.hash(refreshToken, 10);
      await db.users.update(user.id, { refresh_token_hash: refreshHash });

      // Set cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Log the registration event
      await logAudit(user.id, user.email, "USER_SIGNUP", `Registered account with role: ${user.role} and company: ${user.company}`, req);

      res.status(201).json({
        token,
        user: { id: user.id, email: user.email, name: user.name, company: user.company, role: user.role, status: user.status, two_factor_enabled: false }
      });
    } catch (err: any) {
      console.error("Signup error:", err);
      res.status(500).json({ error: err.message || "Failed to create account" });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Please enter email and password" });
    }

    try {
      const user = await db.users.findByEmail(email);
      if (!user) {
        // Obfuscate message to prevent account harvesting but log details inside audit logs
        await logAudit(undefined, email, "LOGIN_FAILED", "Invalid login attempt: email not registered", req);
        return res.status(400).json({ error: "Invalid email or password" });
      }

      // Check suspension status before verifying credentials
      if (user.status === "suspended") {
        await logAudit(user.id, user.email, "LOGIN_BLOCKED", `Attempted login on suspended account`, req);
        return res.status(403).json({ error: "Your account has been suspended by an administrator." });
      }

      // Verify password
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        await logAudit(user.id, user.email, "LOGIN_FAILED", "Invalid login attempt: password mismatch", req);
        return res.status(400).json({ error: "Invalid email or password" });
      }

      // Check if 2FA is enabled
      if (user.two_factor_enabled) {
        // Generate a 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        await db.users.update(user.id, {
          two_factor_temp_code: code,
          two_factor_temp_expiry: expiry.toISOString()
        });

        // Push an app notification so user can grab code on frontend, and log code
        await db.appNotifications.create({
          recruiter_id: user.id,
          category: "SECURITY",
          recipient_email: user.email,
          subject: "Your Two-Factor Verification Code",
          body: `Your login code is: ${code}. It is valid for 5 minutes.`,
          status: "sent"
        });

        console.log(`\n==========================================\n[2FA CHALLENGE] User: ${user.email}\nCode: ${code}\n==========================================\n`);

        await logAudit(user.id, user.email, "2FA_CHALLENGE", "Two-factor authentication code generated and queued", req);

        const tempToken = jwt.sign({ tempId: user.id, is2FAChallenge: true }, JWT_SECRET, { expiresIn: "5m" });
        return res.json({ require2FA: true, tempToken, email: user.email });
      }

      // Normal Login Flow: Generate tokens
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role, status: user.status }, JWT_SECRET, { expiresIn: "1h" });
      const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: "7d" });

      const refreshHash = await bcrypt.hash(refreshToken, 10);
      await db.users.update(user.id, { refresh_token_hash: refreshHash });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Log successful login
      await logAudit(user.id, user.email, "USER_LOGIN", `Logged in successfully via JWT`, req);

      res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name, company: user.company, role: user.role, status: user.status, two_factor_enabled: false }
      });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/verify-2fa", authLimiter, async (req, res) => {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ error: "Challenge token and 2FA verification code are required" });
    }

    try {
      const decoded = jwt.verify(tempToken, JWT_SECRET) as any;
      if (!decoded.is2FAChallenge || !decoded.tempId) {
        return res.status(400).json({ error: "Invalid challenge session token" });
      }

      const user = await db.users.findById(decoded.tempId);
      if (!user) {
        return res.status(404).json({ error: "User profile not found" });
      }

      if (!user.two_factor_temp_code || user.two_factor_temp_code !== code) {
        await logAudit(user.id, user.email, "2FA_FAILED", "Failed 2FA code entry attempt", req);
        return res.status(400).json({ error: "Incorrect 2FA code" });
      }

      const expiry = user.two_factor_temp_expiry ? new Date(user.two_factor_temp_expiry) : null;
      if (!expiry || expiry.getTime() < Date.now()) {
        await logAudit(user.id, user.email, "2FA_EXPIRED", "Expired 2FA code entry attempt", req);
        return res.status(400).json({ error: "Verification code has expired. Please log in again." });
      }

      // Clear code
      await db.users.update(user.id, {
        two_factor_temp_code: null,
        two_factor_temp_expiry: null
      });

      // Generate access and refresh tokens
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role, status: user.status }, JWT_SECRET, { expiresIn: "1h" });
      const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: "7d" });

      const refreshHash = await bcrypt.hash(refreshToken, 10);
      await db.users.update(user.id, { refresh_token_hash: refreshHash });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      await logAudit(user.id, user.email, "USER_LOGIN_2FA", "Logged in successfully via 2FA verification", req);

      res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name, company: user.company, role: user.role, status: user.status, two_factor_enabled: true }
      });
    } catch (err) {
      res.status(400).json({ error: "Challenge session expired or invalid. Please log in again." });
    }
  });

  app.post("/api/auth/setup-2fa", authenticateToken, async (req: any, res) => {
    const { enable } = req.body;
    try {
      const user = await db.users.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (enable) {
        const secret = Math.random().toString(36).substring(2, 12).toUpperCase();
        await db.users.update(user.id, {
          two_factor_enabled: true,
          two_factor_secret: secret
        });
        await logAudit(user.id, user.email, "2FA_ENABLED", "Enabled Two-Factor Authentication on account", req);
        return res.json({ success: true, message: "Two-Factor Authentication enabled", secret });
      } else {
        await db.users.update(user.id, {
          two_factor_enabled: false,
          two_factor_secret: null,
          two_factor_temp_code: null,
          two_factor_temp_expiry: null
        });
        await logAudit(user.id, user.email, "2FA_DISABLED", "Disabled Two-Factor Authentication on account", req);
        return res.json({ success: true, message: "Two-Factor Authentication disabled" });
      }
    } catch (err: any) {
      res.status(500).json({ error: "Failed to set up 2FA: " + err.message });
    }
  });

  app.post("/api/auth/refresh", async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token is missing" });
    }

    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
      const user = await db.users.findById(decoded.id);

      if (!user || !user.refresh_token_hash) {
        return res.status(403).json({ error: "Refresh token revoked or session ended" });
      }

      const isMatch = await bcrypt.compare(refreshToken, user.refresh_token_hash);
      if (!isMatch) {
        return res.status(403).json({ error: "Refresh token validation failed" });
      }

      // Rotate access token
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role, status: user.status }, JWT_SECRET, { expiresIn: "1h" });
      res.json({ token });
    } catch (err) {
      res.status(403).json({ error: "Invalid or expired refresh token" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
        await db.users.update(decoded.id, { refresh_token_hash: null });
      } catch (err) {
        // Ignore parsing/revoking errors and proceed to clear client cookies
      }
    }
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "strict"
    });
    res.json({ success: true, message: "Logged out successfully" });
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    try {
      const user = await db.users.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password_hash, two_factor_secret, two_factor_temp_code, two_factor_temp_expiry, refresh_token_hash, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch user session" });
    }
  });

  app.post("/api/auth/change-password", authenticateToken, async (req: any, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required." });
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      return res.status(400).json({ error: strengthError });
    }

    try {
      const user = await db.users.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User profile not found." });
      }

      // Fetch full user record (including password_hash)
      const fullUser = await db.users.findByEmail(user.email);
      if (!fullUser) {
        return res.status(404).json({ error: "User not found." });
      }

      const isMatch = await bcrypt.compare(currentPassword, fullUser.password_hash);
      if (!isMatch) {
        await logAudit(user.id, user.email, "PASSWORD_CHANGE_FAILED", "Failed password rotation: incorrect current password", req);
        return res.status(400).json({ error: "Incorrect current password." });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      await db.users.update(user.id, { 
        password_hash: newHash,
        password_changed_at: new Date().toISOString()
      });

      await logAudit(user.id, user.email, "PASSWORD_CHANGE_SUCCESS", "Password rotated successfully", req);
      res.json({ success: true, message: "Password updated successfully." });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to rotate password: " + err.message });
    }
  });

  app.get("/api/auth/audit-logs", authenticateToken, async (req: any, res) => {
    try {
      const allLogs = await db.auditLogs.listAll();
      const userLogs = allLogs.filter((log: any) => 
        log.user_id === req.user.id || 
        (log.user_email && log.user_email.toLowerCase() === req.user.email.toLowerCase())
      );
      // Return 20 most recent logs
      res.json({ logs: userLogs.slice(-20).reverse() });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to load security logs: " + err.message });
    }
  });

  // =========================================================================
  // JOB POOL ENDPOINTS
  // =========================================================================

  app.post("/api/jobs/generate-description", authenticateToken, async (req: any, res) => {
    const { title, experience, employmentType, skills, industry, location, companySize } = req.body;
    if (!title || !experience || !employmentType) {
      return res.status(400).json({ error: "Job title, experience level, and employment type are required to generate description." });
    }

    try {
      const skillsArray = Array.isArray(skills) 
        ? skills 
        : (skills ? skills.split(",").map((s: string) => s.trim()) : []);
      
      const generated = await generateJobDescriptionWithAI(
        title,
        experience,
        employmentType,
        skillsArray,
        industry || "Technology",
        location || "Remote",
        companySize || "Medium"
      );

      res.json({ generated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to generate AI job description." });
    }
  });

  app.post("/api/jobs", authenticateToken, async (req: any, res) => {
    const { title, description, experience, skills, education, salary, location, employment_type } = req.body;
    if (!title || !description || !skills || !experience || !education || !employment_type) {
      return res.status(400).json({ error: "Missing required fields for job creation" });
    }

    try {
      const jobSkills = Array.isArray(skills) ? skills : skills.split(",").map((s: string) => s.trim());
      const job = await db.jobs.create({
        recruiter_id: req.user.id,
        title,
        description,
        experience,
        skills: jobSkills,
        education,
        salary: salary || "Confidential",
        location: location || "Remote",
        employment_type
      });
      await logAudit(req.user.id, req.user.email, "JOB_CREATE", `Created new job posting: "${job.title}"`, req);
      res.status(201).json({ job });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create job" });
    }
  });

  app.get("/api/jobs", authenticateToken, async (req: any, res) => {
    try {
      const jobs = await db.jobs.listByRecruiter(req.user.id);
      res.json({ jobs });
    } catch (err) {
      res.status(500).json({ error: "Failed to list jobs" });
    }
  });

  app.get("/api/jobs/:id", authenticateToken, async (req: any, res) => {
    try {
      const job = await db.jobs.findById(Number(req.params.id));
      if (!job) {
        return res.status(404).json({ error: "Job posting not found" });
      }
      if (job.recruiter_id !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json({ job });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch job description" });
    }
  });

  app.put("/api/jobs/:id", authenticateToken, async (req: any, res) => {
    try {
      const job = await db.jobs.findById(Number(req.params.id));
      if (!job) {
        return res.status(404).json({ error: "Job posting not found" });
      }
      if (job.recruiter_id !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const updated = await db.jobs.update(job.id, req.body);
      res.json({ job: updated });
    } catch (err) {
      res.status(500).json({ error: "Failed to update job posting" });
    }
  });

  app.delete("/api/jobs/:id", authenticateToken, async (req: any, res) => {
    try {
      const job = await db.jobs.findById(Number(req.params.id));
      if (!job) {
        return res.status(404).json({ error: "Job posting not found" });
      }
      if (job.recruiter_id !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      await db.jobs.delete(job.id);
      res.json({ success: true, message: "Job posting deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  // =========================================================================
  // RESUME UPLOAD & PARSING ENDPOINTS
  // =========================================================================

  app.post("/api/jobs/:jobId/upload", authenticateToken, async (req: any, res) => {
    const jobId = Number(req.params.jobId);
    const { fileName, textContent } = req.body;

    if (!fileName || !textContent) {
      return res.status(400).json({ error: "Please upload a valid resume or provide parsed text details" });
    }

    try {
      // Verify job belongs to user
      const job = await db.jobs.findById(jobId);
      if (!job) {
        return res.status(404).json({ error: "Target job posting not found" });
      }
      if (job.recruiter_id !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized access" });
      }

      // Call Gemini parser
      console.log(`AI parsing file "${fileName}" with text length ${textContent.length}...`);
      const parsedData = await parseResumeWithAI(textContent, fileName);

      // Create candidate record in DB
      const candidate = await db.candidates.create({
        job_id: jobId,
        name: parsedData.name || "Unknown Candidate",
        email: parsedData.email || "unknown@candidate.com",
        phone: parsedData.phone || "N/A",
        skills: parsedData.skills || [],
        experience_summary: parsedData.experience_summary || "N/A",
        education_summary: parsedData.education_summary || "N/A",
        resume_text: textContent,
        file_name: fileName
      });

      // Automatically perform matching immediately on upload for best SaaS UX
      const matchResult = await matchCandidateWithAI(candidate, job);
      const match = await db.matchResults.create({
        candidate_id: candidate.id,
        ...matchResult
      });

      // Log AI Actions
      await logAudit(req.user.id, req.user.email, "AI_RESUME_PARSE", `AI parsed candidate resume: "${candidate.name}" (${fileName})`, req);
      await logAudit(req.user.id, req.user.email, "AI_CANDIDATE_MATCH", `AI matched candidate: "${candidate.name}" against job: "${job.title}" (Score: ${match.overall_score}%)`, req);

      // Populate matching into candidate object
      res.status(201).json({
        candidate: {
          ...candidate,
          match
        }
      });
    } catch (err: any) {
      console.error("Upload/Parsing error:", err);
      res.status(500).json({ error: err.message || "Failed to process and parse resume" });
    }
  });

  // =========================================================================
  // PUBLIC CAREER PORTAL ENDPOINTS
  // =========================================================================

  app.get("/api/public/jobs", async (req, res) => {
    try {
      if (isPostgres && pool) {
        const query = `
          SELECT j.id, j.title, j.description, j.experience, j.skills, j.education, j.salary, j.location, j.employment_type, j.status, j.created_at, u.company
          FROM jobs j
          JOIN users u ON j.recruiter_id = u.id
          WHERE j.status = 'active'
          ORDER BY j.created_at DESC
        `;
        const result = await pool.query(query);
        const rows = result.rows.map(row => ({
          ...row,
          skills: JSON.parse(row.skills)
        }));
        return res.json({ jobs: rows });
      } else {
        // Local JSON DB fallback
        const data = fs.readFileSync(path.join(process.cwd(), "data", "db.json"), "utf8");
        const parsed = JSON.parse(data);
        const activeJobs = (parsed.jobs || []).filter((j: any) => j.status === "active").map((j: any) => {
          const user = (parsed.users || []).find((u: any) => u.id === j.recruiter_id);
          return {
            ...j,
            company: user ? user.company : "Apex Technologies"
          };
        });
        return res.json({ jobs: activeJobs });
      }
    } catch (err: any) {
      console.error("Public jobs fetch error:", err);
      res.status(500).json({ error: "Failed to list active job openings" });
    }
  });

  app.post("/api/public/jobs/:jobId/apply", async (req, res) => {
    const jobId = Number(req.params.jobId);
    const { name, email, phone, coverLetter, fileName, textContent } = req.body;

    if (!fileName || !textContent) {
      return res.status(400).json({ error: "Please upload a valid resume or provide parsed text details" });
    }

    try {
      const job = await db.jobs.findById(jobId);
      if (!job || job.status !== "active") {
        return res.status(404).json({ error: "This job posting is no longer active or accepting applications" });
      }

      console.log(`Public Application: parsing resume for "${name || 'Applicant'}"...`);
      const parsedData = await parseResumeWithAI(textContent, fileName);

      // Create candidate record in DB
      const candidate = await db.candidates.create({
        job_id: jobId,
        name: parsedData.name && parsedData.name !== "Unknown Candidate" ? parsedData.name : (name || "Unknown Candidate"),
        email: parsedData.email && parsedData.email !== "unknown@candidate.com" ? parsedData.email : (email || "unknown@candidate.com"),
        phone: parsedData.phone && parsedData.phone !== "N/A" ? parsedData.phone : (phone || "N/A"),
        skills: parsedData.skills || [],
        experience_summary: parsedData.experience_summary || "N/A",
        education_summary: parsedData.education_summary || "N/A",
        resume_text: textContent,
        file_name: fileName,
        cover_letter: coverLetter || null
      });

      // Automatically perform matching immediately
      const matchResult = await matchCandidateWithAI(candidate, job);
      const match = await db.matchResults.create({
        candidate_id: candidate.id,
        ...matchResult
      });

      // Log action publicly
      if (isPostgres && pool) {
        await pool.query(
          "INSERT INTO audit_logs (user_id, user_email, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)",
          [null, "public_applicant", "PUBLIC_JOB_APPLICATION", `Candidate "${candidate.name}" applied to job: "${job.title}" (Score: ${match.overall_score}%)`, req.ip]
        );
      } else {
        const data = fs.readFileSync(path.join(process.cwd(), "data", "db.json"), "utf8");
        const parsed = JSON.parse(data);
        if (!parsed.audit_logs) parsed.audit_logs = [];
        parsed.audit_logs.push({
          id: parsed.audit_logs.length + 1,
          user_id: null,
          user_email: "public_applicant",
          action: "PUBLIC_JOB_APPLICATION",
          details: `Candidate "${candidate.name}" applied to job: "${job.title}" (Score: ${match.overall_score}%)`,
          ip_address: req.ip,
          created_at: new Date().toISOString()
        });
        fs.writeFileSync(path.join(process.cwd(), "data", "db.json"), JSON.stringify(parsed, null, 2));
      }

      res.status(201).json({
        success: true,
        message: "Application submitted successfully!",
        candidate: {
          id: candidate.id,
          name: candidate.name,
          email: candidate.email,
          match_score: match.overall_score
        }
      });
    } catch (err: any) {
      console.error("Public job application submission error:", err);
      res.status(500).json({ error: err.message || "Failed to process and submit application" });
    }
  });

  // Get Candidates for specific Job
  app.get("/api/jobs/:jobId/candidates", authenticateToken, async (req: any, res) => {
    const jobId = Number(req.params.jobId);
    try {
      const job = await db.jobs.findById(jobId);
      if (!job) return res.status(404).json({ error: "Job not found" });
      if (job.recruiter_id !== req.user.id) return res.status(403).json({ error: "Access denied" });

      const candidates = await db.candidates.listByJob(jobId);
      res.json({ candidates });
    } catch (err) {
      res.status(500).json({ error: "Failed to list job candidates" });
    }
  });

  // Get All Candidates in pipeline for this Recruiter
  app.get("/api/candidates", authenticateToken, async (req: any, res) => {
    try {
      const candidates = await db.candidates.listByRecruiter(req.user.id);
      res.json({ candidates });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch candidates pipeline" });
    }
  });

  // Delete Candidate
  app.delete("/api/candidates/:id", authenticateToken, async (req: any, res) => {
    try {
      const candidate = await db.candidates.findById(Number(req.params.id));
      if (!candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }
      
      const job = await db.jobs.findById(candidate.job_id);
      if (!job || job.recruiter_id !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      await db.candidates.delete(candidate.id);
      res.json({ success: true, message: "Candidate deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: "Failed to remove candidate" });
    }
  });

  // Update Candidate Skills (Future Tech & Growth Sector Enrichment)
  app.put("/api/candidates/:id/skills", authenticateToken, async (req: any, res) => {
    try {
      const candidateId = Number(req.params.id);
      const { skills } = req.body;
      if (!Array.isArray(skills)) {
        return res.status(400).json({ error: "Skills must be a valid array of strings" });
      }

      const candidate = await db.candidates.findById(candidateId);
      if (!candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }

      const job = await db.jobs.findById(candidate.job_id);
      if (!job || job.recruiter_id !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized access" });
      }

      const updatedCandidate = await db.candidates.updateSkills(candidateId, skills);
      
      // Re-trigger Gemini matching automatically with the updated skills
      const matchResult = await matchCandidateWithAI(updatedCandidate || candidate, job);
      await db.matchResults.create({
        candidate_id: candidateId,
        ...matchResult
      });

      await logAudit(req.user.id, req.user.email, "AI_CANDIDATE_SKILL_ENHANCE", `Enriched skills for candidate: "${candidate.name}" with future technology growth assets.`, req);

      res.json({ success: true, candidate: updatedCandidate });
    } catch (err: any) {
      console.error("Error updating candidate skills:", err);
      res.status(500).json({ error: err.message || "Failed to update candidate skills" });
    }
  });

  // =========================================================================
  // AI SCREENING & INTERVIEW ENDPOINTS
  // =========================================================================

  app.post("/api/candidates/:id/match", authenticateToken, async (req: any, res) => {
    const candId = Number(req.params.id);
    try {
      const candidate = await db.candidates.findById(candId);
      if (!candidate) return res.status(404).json({ error: "Candidate not found" });

      const job = await db.jobs.findById(candidate.job_id);
      if (!job || job.recruiter_id !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const matchDetails = await matchCandidateWithAI(candidate, job);
      const match = await db.matchResults.create({
        candidate_id: candidate.id,
        ...matchDetails
      });

      res.json({ match });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to generate AI Match Score" });
    }
  });

  app.post("/api/candidates/:id/feedback", authenticateToken, async (req: any, res) => {
    const candId = Number(req.params.id);
    const { feedback } = req.body;
    try {
      const candidate = await db.candidates.findById(candId);
      if (!candidate) return res.status(404).json({ error: "Candidate not found" });

      const job = await db.jobs.findById(candidate.job_id);
      if (!job || job.recruiter_id !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      await db.matchResults.setFeedback(candidate.id, feedback);
      res.json({ success: true, feedback });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to save recruiter feedback" });
    }
  });

  app.post("/api/candidates/:id/pin", authenticateToken, async (req: any, res) => {
    const candId = Number(req.params.id);
    const { isPinned } = req.body;
    try {
      const candidate = await db.candidates.findById(candId);
      if (!candidate) return res.status(404).json({ error: "Candidate not found" });

      const job = await db.jobs.findById(candidate.job_id);
      if (!job || job.recruiter_id !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      await db.matchResults.setPinned(candidate.id, isPinned);
      res.json({ success: true, is_pinned: isPinned });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to pin/unpin candidate" });
    }
  });

  app.post("/api/candidates/:id/questions", authenticateToken, async (req: any, res) => {
    const candId = Number(req.params.id);
    try {
      const candidate = await db.candidates.findById(candId);
      if (!candidate) return res.status(404).json({ error: "Candidate not found" });

      const job = await db.jobs.findById(candidate.job_id);
      if (!job || job.recruiter_id !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Generate Questions
      const questionsList = await generateInterviewQuestionsWithAI(candidate, job);
      const interviewPlan = await db.interviewQuestions.create({
        candidate_id: candidate.id,
        questions: questionsList
      });

      res.json({ interviewPlan });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to generate interview plan" });
    }
  });

  app.get("/api/candidates/:id/questions", authenticateToken, async (req: any, res) => {
    try {
      const candidate = await db.candidates.findById(Number(req.params.id));
      if (!candidate) return res.status(404).json({ error: "Candidate not found" });

      const job = await db.jobs.findById(candidate.job_id);
      if (!job || job.recruiter_id !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      let interviewPlan = await db.interviewQuestions.findByCandidateId(candidate.id);
      if (!interviewPlan) {
        // Auto-generate if not exists for stellar UX
        const questionsList = await generateInterviewQuestionsWithAI(candidate, job);
        interviewPlan = await db.interviewQuestions.create({
          candidate_id: candidate.id,
          questions: questionsList
        });
      }

      res.json({ interviewPlan });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch interview questions" });
    }
  });

  // =========================================================================
  // AI COPILOT CHAT ENDPOINT
  // =========================================================================

  app.post("/api/copilot/chat", authenticateToken, async (req: any, res) => {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message content required" });
    }

    try {
      // 1. Save user message to persistent history
      await db.copilotChats.create({
        recruiter_id: req.user.id,
        role: "user",
        content: message
      });

      // Gather active jobs and active candidates for grounding
      const jobs = await db.jobs.listByRecruiter(req.user.id);
      const candidates = await db.candidates.listByRecruiter(req.user.id);

      // Set headers for clean chunked text streaming
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      const stream = await askCopilotWithAIStream(message, history || [], jobs, candidates);
      let fullReply = "";

      for await (const chunk of stream) {
        if (chunk.text) {
          res.write(chunk.text);
          fullReply += chunk.text;
        }
      }

      // 2. Save model's reply to persistent history
      if (fullReply) {
        await db.copilotChats.create({
          recruiter_id: req.user.id,
          role: "model",
          content: fullReply
        });
      }

      res.end();
    } catch (err: any) {
      console.error("Copilot stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "Failed to generate copilot reply stream" });
      } else {
        res.write("\n⚠️ [Stream interrupted due to an internal server error]");
        res.end();
      }
    }
  });

  app.get("/api/copilot/history", authenticateToken, async (req: any, res) => {
    try {
      const chats = await db.copilotChats.listByRecruiter(req.user.id);
      res.json({ history: chats });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to retrieve chat history: " + err.message });
    }
  });

  app.delete("/api/copilot/history", authenticateToken, async (req: any, res) => {
    try {
      await db.copilotChats.clear(req.user.id);
      res.json({ success: true, message: "Chat history cleared successfully" });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to clear chat history: " + err.message });
    }
  });

  // =========================================================================
  // INTERVIEW MANAGEMENT ENDPOINTS
  // =========================================================================

  // 1. Get all interviews for current recruiter
  app.get("/api/interviews", authenticateToken, async (req: any, res) => {
    try {
      const list = await db.interviews.listByRecruiter(req.user.id);
      res.json({ interviews: list });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to retrieve interviews: " + err.message });
    }
  });

  // 2. Schedule a new interview
  app.post("/api/interviews", authenticateToken, async (req: any, res) => {
    const {
      candidate_id,
      job_id,
      title,
      datetime,
      duration,
      interviewer_name,
      interviewer_email,
      platform,
      meeting_link,
      notes
    } = req.body;

    if (!candidate_id || !job_id || !title || !datetime || !duration || !interviewer_name || !interviewer_email || !platform) {
      return res.status(400).json({ error: "Missing required scheduling fields" });
    }

    try {
      // Create the interview
      const interview = await db.interviews.create({
        recruiter_id: req.user.id,
        candidate_id: Number(candidate_id),
        job_id: Number(job_id),
        title,
        datetime,
        duration: Number(duration),
        interviewer_name,
        interviewer_email,
        platform,
        meeting_link,
        notes
      });

      // Fetch candidates to find the details
      const localCandidates = await db.candidates.listByRecruiter(req.user.id);
      const candidate = localCandidates.find(c => c.id === Number(candidate_id));
      const candidateName = candidate ? candidate.name : "Candidate";
      const candidateEmail = candidate ? candidate.email : interviewer_email;

      // Log/Create Scheduled Notifications for Candidate and Interviewer
      await db.notifications.create({
        interview_id: interview.id,
        type: "scheduled",
        recipient_email: candidateEmail,
        subject: `Interview Scheduled: ${title}`,
        body: `Hi ${candidateName},

Your interview for the position has been scheduled.

Details:
- Title: ${title}
- Date/Time: ${new Date(datetime).toLocaleString()}
- Duration: ${duration} minutes
- Interviewer: ${interviewer_name}
- Platform: ${platform}
${meeting_link ? `- Meeting Link: ${meeting_link}` : ""}

Please let us know if you need to reschedule.

Best regards,
The Recruitment Team`
      });

      await db.notifications.create({
        interview_id: interview.id,
        type: "scheduled",
        recipient_email: interviewer_email,
        subject: `Interviewer Assignment: ${title} with ${candidateName}`,
        body: `Hi ${interviewer_name},

You have been assigned to conduct an interview.

Details:
- Candidate Name: ${candidateName}
- Title: ${title}
- Date/Time: ${new Date(datetime).toLocaleString()}
- Duration: ${duration} minutes
- Platform: ${platform}
${meeting_link ? `- Meeting Link: ${meeting_link}` : ""}

Please prepare the interview scorecard in advance.

Best regards,
TalentSync System`
      });

      // Audit logs
      await db.auditLogs.create({
        user_id: req.user.id,
        user_email: req.user.email,
        action: "SCHEDULE_INTERVIEW",
        details: `Scheduled "${title}" with candidate ID ${candidate_id} on ${datetime}`,
        ip_address: req.ip || "127.0.0.1"
      });

      res.status(201).json({ success: true, interview });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to schedule interview: " + err.message });
    }
  });

  // 3. Update interview status
  app.put("/api/interviews/:id/status", authenticateToken, async (req: any, res) => {
    const interviewId = Number(req.params.id);
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Missing status parameter" });
    }

    try {
      const interview = await db.interviews.updateStatus(interviewId, req.user.id, status);
      if (!interview) {
        return res.status(404).json({ error: "Interview not found or unauthorized" });
      }

      // If status is cancelled, notify
      if (status === "cancelled") {
        await db.notifications.create({
          interview_id: interviewId,
          type: "cancelled",
          recipient_email: interview.interviewer_email,
          subject: `Interview Cancelled: ${interview.title}`,
          body: `Hi ${interview.interviewer_name},

This is to inform you that your upcoming interview "${interview.title}" has been cancelled.

No action is required from your end.

Best regards,
The Recruitment Team`
        });
      }

      // Log action
      await db.auditLogs.create({
        user_id: req.user.id,
        user_email: req.user.email,
        action: "UPDATE_INTERVIEW_STATUS",
        details: `Updated interview ${interviewId} status to "${status}"`,
        ip_address: req.ip || "127.0.0.1"
      });

      res.json({ success: true, interview });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update status: " + err.message });
    }
  });

  // 4. Save interview feedback / scorecard
  app.put("/api/interviews/:id/scorecard", authenticateToken, async (req: any, res) => {
    const interviewId = Number(req.params.id);
    const { overall_rating, skills_rating, experience_rating, communication_rating, culture_fit_rating, strengths, weaknesses, recommendation } = req.body;

    if (overall_rating === undefined || !recommendation) {
      return res.status(400).json({ error: "Missing core scorecard parameters" });
    }

    try {
      const scorecard = {
        overall_rating: Number(overall_rating),
        skills_rating: Number(skills_rating || overall_rating),
        experience_rating: Number(experience_rating || overall_rating),
        communication_rating: Number(communication_rating || overall_rating),
        culture_fit_rating: Number(culture_fit_rating || overall_rating),
        strengths: strengths || "",
        weaknesses: weaknesses || "",
        recommendation,
        submitted_at: new Date().toISOString()
      };

      const interview = await db.interviews.updateScorecard(interviewId, req.user.id, scorecard);
      if (!interview) {
        return res.status(404).json({ error: "Interview not found or unauthorized" });
      }

      // Log/Create Feedback Submitted Notification
      await db.notifications.create({
        interview_id: interviewId,
        type: "feedback_submitted",
        recipient_email: req.user.email,
        subject: `Feedback Submitted: ${interview.title}`,
        body: `Hi Recruiter,

Interview scorecard has been successfully submitted for ${interview.candidate_name || "candidate"}.

Summary Evaluation:
- Recommendation: ${recommendation.toUpperCase()}
- Overall Score: ${overall_rating}/5
- Strengths: ${strengths}

This has been recorded on the candidate's profile dashboard.

Best regards,
TalentSync System`
      });

      // Audit logs
      await db.auditLogs.create({
        user_id: req.user.id,
        user_email: req.user.email,
        action: "SUBMIT_SCORECARD",
        details: `Submitted scorecard for interview ${interviewId} with recommendation ${recommendation}`,
        ip_address: req.ip || "127.0.0.1"
      });

      res.json({ success: true, interview });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to submit scorecard: " + err.message });
    }
  });

  // 5. Delete / Cancel Interview
  app.delete("/api/interviews/:id", authenticateToken, async (req: any, res) => {
    const interviewId = Number(req.params.id);
    try {
      await db.interviews.delete(interviewId, req.user.id);

      // Audit logs
      await db.auditLogs.create({
        user_id: req.user.id,
        user_email: req.user.email,
        action: "DELETE_INTERVIEW",
        details: `Deleted/Removed interview ID ${interviewId}`,
        ip_address: req.ip || "127.0.0.1"
      });

      res.json({ success: true, message: "Interview deleted successfully" });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to delete interview: " + err.message });
    }
  });

  // 6. Get all notifications logs
  app.get("/api/notifications", authenticateToken, async (req: any, res) => {
    try {
      const logs = await db.notifications.listByRecruiter(req.user.id);
      res.json({ notifications: logs });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to retrieve notification logs: " + err.message });
    }
  });

  // 7. Manually trigger a reminder notification
  app.post("/api/interviews/:id/remind", authenticateToken, async (req: any, res) => {
    const interviewId = Number(req.params.id);
    try {
      const list = await db.interviews.listByRecruiter(req.user.id);
      const interview = list.find(i => i.id === interviewId);
      if (!interview) {
        return res.status(404).json({ error: "Interview not found" });
      }

      const candidateName = interview.candidate_name || "Candidate";
      const candidateEmail = interview.candidate_email || interview.interviewer_email;

      // Log/Create Reminder Notifications
      await db.notifications.create({
        interview_id: interviewId,
        type: "reminder",
        recipient_email: candidateEmail,
        subject: `Reminder: Upcoming Interview - ${interview.title}`,
        body: `Hi ${candidateName},

This is a friendly reminder that your upcoming interview "${interview.title}" is scheduled soon.

Details:
- Date/Time: ${new Date(interview.datetime).toLocaleString()}
- Duration: ${interview.duration} minutes
- Platform: ${interview.platform}
${interview.meeting_link ? `- Meeting Link: ${interview.meeting_link}` : ""}

Please ensure you have a stable internet connection and are in a quiet room.

Best regards,
The Recruitment Team`
      });

      await db.notifications.create({
        interview_id: interviewId,
        type: "reminder",
        recipient_email: interview.interviewer_email,
        subject: `Reminder: Assigned Interview - ${interview.title} with ${candidateName}`,
        body: `Hi ${interview.interviewer_name},

This is a reminder that you have an assigned interview scheduled soon.

Details:
- Candidate Name: ${candidateName}
- Date/Time: ${new Date(interview.datetime).toLocaleString()}
- Duration: ${interview.duration} minutes
- Platform: ${interview.platform}
${interview.meeting_link ? `- Meeting Link: ${interview.meeting_link}` : ""}

Please make sure to review the candidate's screening report and have your scorecards open.

Best regards,
TalentSync System`
      });

      res.json({ success: true, message: "Reminder notifications sent successfully to candidate and interviewer" });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to send reminder: " + err.message });
    }
  });

  // =========================================================================
  // NOTIFICATION SERVICE ENDPOINTS (SUPPORT SMTP, REAL-TIME & COHESIVE SYSTEM)
  // =========================================================================

  // Helper: Send email via Nodemailer SMTP or Sandbox fallback
  async function sendEmailHelper(to: string, subject: string, body: string, customSmtp?: any) {
    const host = customSmtp?.host || process.env.SMTP_HOST;
    const port = Number(customSmtp?.port || process.env.SMTP_PORT || "587");
    const user = customSmtp?.user || process.env.SMTP_USER;
    const pass = customSmtp?.pass || process.env.SMTP_PASS;
    const fromEmail = customSmtp?.fromEmail || process.env.SMTP_FROM_EMAIL || "noreply@talentsync.ai";
    const fromName = customSmtp?.fromName || process.env.SMTP_FROM_NAME || "TalentSync Alerts";

    if (!host || !user || !pass) {
      console.log(`[SMTP Sandbox Mode] Simulated email to: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body:\n${body}`);
      return {
        success: true,
        mode: "sandbox",
        message: "Email simulated successfully in sandbox mode (SMTP not configured in server.env)."
      };
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        text: body,
        html: body.replace(/\n/g, "<br>"),
      });

      console.log(`[SMTP Sent] Sent mail to ${to} via ${host}. ID: ${info.messageId}`);
      return {
        success: true,
        mode: "smtp",
        messageId: info.messageId,
        message: "Email sent successfully via SMTP server."
      };
    } catch (err: any) {
      console.error(`[SMTP Error] Failed to send via SMTP: ${err.message}`);
      return {
        success: false,
        mode: "failed-smtp",
        error: err.message,
        message: `Failed to send email via SMTP: ${err.message}`
      };
    }
  }

  // 1. GET all notification templates
  app.get("/api/notifications/templates", authenticateToken, async (req: any, res) => {
    try {
      const list = await db.notificationTemplates.listAll();
      res.json({ templates: list });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to retrieve templates: " + err.message });
    }
  });

  // 2. PUT update notification template
  app.put("/api/notifications/templates/:category", authenticateToken, async (req: any, res) => {
    const { category } = req.params;
    const { subject, body } = req.body;
    if (!subject || !body) {
      return res.status(400).json({ error: "Subject and body parameters are required." });
    }
    try {
      const updated = await db.notificationTemplates.update(category, subject, body);
      if (!updated) {
        return res.status(404).json({ error: "Template category not found." });
      }

      await db.auditLogs.create({
        user_id: req.user.id,
        user_email: req.user.email,
        action: "UPDATE_NOTIFICATION_TEMPLATE",
        details: `Updated email template for "${category}"`,
        ip_address: req.ip || "127.0.0.1"
      });

      res.json({ success: true, template: updated });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update template: " + err.message });
    }
  });

  // 3. GET all dispatched notifications (Notification Center logs)
  app.get("/api/notifications/app", authenticateToken, async (req: any, res) => {
    try {
      const list = await db.appNotifications.listByRecruiter(req.user.id);
      res.json({ notifications: list });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to list notifications: " + err.message });
    }
  });

  // 4. PUT mark notification as read
  app.put("/api/notifications/app/:id/read", authenticateToken, async (req: any, res) => {
    const id = Number(req.params.id);
    try {
      const updated = await db.appNotifications.markAsRead(id);
      res.json({ success: true, notification: updated });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to mark read: " + err.message });
    }
  });

  // 5. PUT mark all notifications as read
  app.put("/api/notifications/app/read-all", authenticateToken, async (req: any, res) => {
    try {
      await db.appNotifications.markAllAsRead(req.user.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to clear notifications: " + err.message });
    }
  });

  // 6. POST send custom / template notification
  app.post("/api/notifications/send", authenticateToken, async (req: any, res) => {
    const { recipient_email, category, subject, body, customSmtp } = req.body;

    if (!recipient_email || !category || !subject || !body) {
      return res.status(400).json({ error: "Missing required properties (recipient_email, category, subject, body)" });
    }

    try {
      // Send real email via SMTP helper
      const mailResult = await sendEmailHelper(recipient_email, subject, body, customSmtp);

      // Record in system app notifications
      const notification = await db.appNotifications.create({
        recruiter_id: req.user.id,
        category,
        recipient_email,
        subject,
        body,
        status: mailResult.success ? (mailResult.mode === "sandbox" ? "sandbox-simulated" : "sent") : "failed"
      });

      // Audit Log
      await db.auditLogs.create({
        user_id: req.user.id,
        user_email: req.user.email,
        action: "SEND_NOTIFICATION",
        details: `Dispatched "${category}" notification to ${recipient_email} via ${mailResult.mode}`,
        ip_address: req.ip || "127.0.0.1"
      });

      res.json({
        success: true,
        notification,
        mailResult
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to dispatch notification: " + err.message });
    }
  });

  // 7. POST test SMTP server configuration dynamically
  app.post("/api/notifications/test-smtp", authenticateToken, async (req: any, res) => {
    const { host, port, user, pass, fromEmail, fromName, to_email } = req.body;

    if (!host || !port || !user || !pass || !to_email) {
      return res.status(400).json({ error: "All SMTP credentials and test recipient email are required." });
    }

    try {
      const mailResult = await sendEmailHelper(to_email, "SMTP Connection Test", "Congratulations! Your SMTP configuration is working flawlessly.", {
        host,
        port: Number(port),
        user,
        pass,
        fromEmail,
        fromName
      });

      if (mailResult.success && mailResult.mode === "smtp") {
        res.json({ success: true, message: "SMTP connection verified! Test email successfully delivered.", mailResult });
      } else {
        res.status(400).json({ success: false, error: mailResult.error || "Simulation mode used. Missing server configuration.", mailResult });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: "SMTP Connection failed: " + err.message });
    }
  });

  // =========================================================================
  // ADMIN PANEL ENDPOINTS
  // =========================================================================

  app.get("/api/admin/stats", authenticateAdmin, async (req: any, res) => {
    try {
      const allUsers = await db.users.listAll();
      const recruiters = allUsers.filter(u => u.role === "recruiter");
      const totalRecruiters = recruiters.length;
      const activeUsersCount = allUsers.filter(u => u.status === "active").length;

      let totalJobs = 0;
      let totalCandidates = 0;
      allUsers.forEach(u => {
        totalJobs += (u.jobs_count || 0);
        totalCandidates += (u.candidates_count || 0);
      });

      const aiRequestsToday = await db.auditLogs.countToday();
      const systemUptime = Math.floor(os.uptime());
      const freeMem = os.freemem();
      const totalMem = os.totalmem();
      const memoryUsagePct = Math.round(((totalMem - freeMem) / totalMem) * 100);

      const revenueDashboard = {
        totalRevenue: 28450,
        monthlyRecurringRevenue: 5900,
        subscribersCount: totalRecruiters + 2,
        activeTrialCount: 4,
        revenueByMonth: [
          { month: "Jan", revenue: 4200 },
          { month: "Feb", revenue: 4900 },
          { month: "Mar", revenue: 5100 },
          { month: "Apr", revenue: 5300 },
          { month: "May", revenue: 5600 },
          { month: "Jun", revenue: 5900 }
        ],
        tierDistribution: [
          { name: "Starter Tier", value: Math.max(1, Math.round(totalRecruiters * 0.4)), color: "#3B82F6" },
          { name: "Growth Premium", value: Math.max(1, Math.round(totalRecruiters * 0.5)), color: "#10B981" },
          { name: "Enterprise Custom", value: Math.max(0, Math.round(totalRecruiters * 0.1)), color: "#8B5CF6" }
        ]
      };

      res.json({
        stats: {
          totalRecruiters,
          totalCandidates,
          totalJobs,
          aiRequestsToday,
          activeUsers: activeUsersCount,
          databaseEngine: db.isPostgres() ? "PostgreSQL (Neon Cloud)" : "Local JSON Sandbox",
          systemHealth: {
            cpuCores: os.cpus().length,
            memoryUsagePct,
            uptimeSeconds: systemUptime,
            platform: os.platform()
          },
          revenueDashboard
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to load administrative stats: " + err.message });
    }
  });

  app.get("/api/admin/recruiters", authenticateAdmin, async (req: any, res) => {
    try {
      const recruiters = await db.users.listAll();
      res.json({ recruiters });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to list recruiters: " + err.message });
    }
  });

  app.post("/api/admin/recruiters", authenticateAdmin, async (req: any, res) => {
    const { email, password, name, company, role, status } = req.body;
    if (!email || !password || !name || !company) {
      return res.status(400).json({ error: "Please provide email, password, name and company" });
    }
    try {
      const existing = await db.users.findByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "Email is already registered" });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const recruiter = await db.users.create({
        email,
        passwordHash,
        name,
        company,
        role: role || "recruiter",
        status: status || "active"
      });
      await logAudit(req.user.id, req.user.email, "ADMIN_CREATE_USER", `Admin created user account: "${recruiter.email}" with role: ${recruiter.role}`, req);
      res.status(201).json({ recruiter });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to create user: " + err.message });
    }
  });

  app.put("/api/admin/recruiters/:id", authenticateAdmin, async (req: any, res) => {
    const id = Number(req.params.id);
    try {
      const user = await db.users.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (id === req.user.id && req.body.role && req.body.role !== user.role) {
        return res.status(400).json({ error: "You cannot demote or change your own admin role" });
      }
      if (id === req.user.id && req.body.status && req.body.status !== user.status) {
        return res.status(400).json({ error: "You cannot suspend or deactivate your own admin account" });
      }

      const updateFields = { ...req.body };
      if (updateFields.password) {
        updateFields.password_hash = await bcrypt.hash(updateFields.password, 10);
        delete updateFields.password;
      }

      const updated = await db.users.update(id, updateFields);
      await logAudit(req.user.id, req.user.email, "ADMIN_UPDATE_USER", `Admin modified user details for: "${updated.email}"`, req);
      res.json({ recruiter: updated });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update user: " + err.message });
    }
  });

  app.delete("/api/admin/recruiters/:id", authenticateAdmin, async (req: any, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ error: "You cannot delete your own admin account" });
    }
    try {
      const user = await db.users.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      await db.users.delete(id);
      await logAudit(req.user.id, req.user.email, "ADMIN_DELETE_USER", `Admin deleted recruiter account: "${user.email}"`, req);
      res.json({ success: true, message: "User deleted successfully" });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to delete user: " + err.message });
    }
  });

  app.get("/api/admin/audit-logs", authenticateAdmin, async (req: any, res) => {
    try {
      const logs = await db.auditLogs.listAll();
      res.json({ logs });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to list audit logs: " + err.message });
    }
  });

  app.get("/api/admin/settings", authenticateAdmin, async (req: any, res) => {
    try {
      const settingsList = await db.systemSettings.listAll();
      const settings: Record<string, string> = {};
      settingsList.forEach((s: any) => {
        settings[s.key] = s.value;
      });
      res.json({
        settings: {
          modelSelection: settings.modelSelection || "gemini-2.5-flash",
          maintenanceMode: settings.maintenanceMode || "false",
          candidateRateLimit: settings.candidateRateLimit || "50",
          aiRecruiterCopilot: settings.aiRecruiterCopilot || "true",
          allowedDomains: settings.allowedDomains || "*",
          requireEmailVerification: settings.requireEmailVerification || "false"
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch settings: " + err.message });
    }
  });

  app.post("/api/admin/settings", authenticateAdmin, async (req: any, res) => {
    const settings = req.body;
    try {
      for (const [key, value] of Object.entries(settings)) {
        await db.systemSettings.set(key, String(value));
      }
      await logAudit(req.user.id, req.user.email, "ADMIN_UPDATE_SETTINGS", "Admin modified system settings and thresholds", req);
      res.json({ success: true, message: "System settings saved successfully" });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to save settings: " + err.message });
    }
  });

  // =========================================================================
  // DOCUMENT MANAGEMENT SYSTEM ENDPOINTS
  // =========================================================================

  // GET /api/documents - List all documents
  app.get("/api/documents", authenticateToken, async (req: any, res) => {
    try {
      const allDocs = await db.documents.listAll();
      const userRole = req.user.role || "recruiter";
      
      // Filter based on role permissions
      const filteredDocs = allDocs.filter((doc: any) => {
        if (userRole === "admin") return true;
        if (doc.uploaded_by === req.user.email) return true;
        const permissions = doc.role_permissions || ["all"];
        return permissions.includes("all") || permissions.includes(userRole);
      });

      // Omit high-weight content payload when listing items for fast payload delivery
      const listWithoutContent = filteredDocs.map(({ content, ...rest }: any) => rest);

      res.json({ documents: listWithoutContent });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch documents: " + err.message });
    }
  });

  // POST /api/documents - Upload a new document
  app.post("/api/documents", authenticateToken, async (req: any, res) => {
    const { name, type, file_size, folder, content, mime_type, role_permissions } = req.body;
    if (!name || !type || !file_size) {
      return res.status(400).json({ error: "Missing required fields: name, type, file_size are mandatory" });
    }
    try {
      const doc = await db.documents.create({
        name,
        type,
        file_size,
        folder: folder || "Unsorted",
        uploaded_by: req.user.email,
        role_permissions: role_permissions ? JSON.stringify(role_permissions) : '["all"]',
        content: content || "",
        mime_type: mime_type || "application/octet-stream",
        versions: "[]"
      });

      await logAudit(
        req.user.id,
        req.user.email,
        "DOCUMENT_UPLOAD",
        `Uploaded document: "${name}" (${type}, size: ${file_size}) in folder: "${folder || "Unsorted"}"`,
        req
      );

      res.status(201).json({ document: doc });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to upload document: " + err.message });
    }
  });

  // POST /api/documents/:id/version - Upload a new version of an existing document
  app.post("/api/documents/:id/version", authenticateToken, async (req: any, res) => {
    const id = Number(req.params.id);
    const { name, file_size, content, note } = req.body;
    if (!name || !file_size || !content) {
      return res.status(400).json({ error: "Missing required fields: name, file_size, content are mandatory" });
    }
    try {
      const doc = await db.documents.findById(id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      const userRole = req.user.role || "recruiter";
      if (userRole !== "admin" && doc.uploaded_by !== req.user.email) {
        return res.status(403).json({ error: "Permission denied: Only the owner or an administrator can add versions" });
      }

      // Store previous state as a historical backup version
      const oldVersion = {
        version_id: `${Date.now()}`,
        name: doc.name,
        file_size: doc.file_size,
        uploaded_at: doc.uploaded_at || new Date().toISOString(),
        content: doc.content || "",
        uploaded_by: doc.uploaded_by,
        note: note || "Previous version backup"
      };

      const updatedVersions = [...(doc.versions || []), oldVersion];

      // Update to newer version
      const updatedDoc = await db.documents.update(id, {
        name,
        file_size,
        content,
        versions: JSON.stringify(updatedVersions)
      });

      await logAudit(
        req.user.id,
        req.user.email,
        "DOCUMENT_VERSION_ADD",
        `Created new version for document: "${name}" (size: ${file_size}). Backup saved to version history.`,
        req
      );

      res.json({ document: updatedDoc });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to push new document version: " + err.message });
    }
  });

  // GET /api/documents/:id/download - Secure download/preview payload fetching
  app.get("/api/documents/:id/download", authenticateToken, async (req: any, res) => {
    const id = Number(req.params.id);
    try {
      const doc = await db.documents.findById(id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      const userRole = req.user.role || "recruiter";
      const permissions = doc.role_permissions || ["all"];
      const isAllowed = userRole === "admin" || 
                        doc.uploaded_by === req.user.email || 
                        permissions.includes("all") || 
                        permissions.includes(userRole);

      if (!isAllowed) {
        return res.status(403).json({ error: "Access denied: You do not have permissions to access this document" });
      }

      await logAudit(
        req.user.id,
        req.user.email,
        "DOCUMENT_DOWNLOAD",
        `Downloaded/previewed document: "${doc.name}" securely.`,
        req
      );

      res.json({
        id: doc.id,
        name: doc.name,
        type: doc.type,
        mime_type: doc.mime_type,
        content: doc.content,
        file_size: doc.file_size
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to retrieve secure document download: " + err.message });
    }
  });

  // PUT /api/documents/:id - Edit folder and metadata properties
  app.put("/api/documents/:id", authenticateToken, async (req: any, res) => {
    const id = Number(req.params.id);
    const { name, folder, role_permissions } = req.body;
    try {
      const doc = await db.documents.findById(id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      const userRole = req.user.role || "recruiter";
      if (userRole !== "admin" && doc.uploaded_by !== req.user.email) {
        return res.status(403).json({ error: "Permission denied: Only the owner or an administrator can modify document settings" });
      }

      const updateFields: any = {};
      if (name !== undefined) updateFields.name = name;
      if (folder !== undefined) updateFields.folder = folder;
      if (role_permissions !== undefined) updateFields.role_permissions = JSON.stringify(role_permissions);

      const updated = await db.documents.update(id, updateFields);
      
      await logAudit(
        req.user.id,
        req.user.email,
        "DOCUMENT_METADATA_UPDATE",
        `Updated settings for document: "${updated.name}". New folder: "${folder || doc.folder}"`,
        req
      );

      res.json({ document: updated });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update document metadata: " + err.message });
    }
  });

  // DELETE /api/documents/:id - Delete a document
  app.delete("/api/documents/:id", authenticateToken, async (req: any, res) => {
    const id = Number(req.params.id);
    try {
      const doc = await db.documents.findById(id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      const userRole = req.user.role || "recruiter";
      if (userRole !== "admin" && doc.uploaded_by !== req.user.email) {
        return res.status(403).json({ error: "Permission denied: Only the owner or an administrator can delete this document" });
      }

      await db.documents.delete(id);
      
      await logAudit(
        req.user.id,
        req.user.email,
        "DOCUMENT_DELETE",
        `Deleted document: "${doc.name}" permanently from server files.`,
        req
      );

      res.json({ success: true, message: "Document deleted successfully" });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to delete document: " + err.message });
    }
  });

  // Check state of Postgres Connection for debug/banners
  app.get("/api/health", (req, res) => {
    res.json({
      status: "online",
      database: db.isPostgres() ? "PostgreSQL (Neon)" : "Trial Sandbox File DB",
      ai_engine: process.env.GEMINI_API_KEY ? "Gemini Live" : "Trial Sandbox Mode (No Key)"
    });
  });

  // 404 handler for any unhandled /api/* endpoints to ensure JSON response instead of Vite SPA HTML
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });

  // =========================================================================
  // VITE DEV SERVER / STATIC ASSETS ROUTING
  // =========================================================================

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Enterprise SaaS server listening at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start Full Stack Enterprise Server:", err);
});
