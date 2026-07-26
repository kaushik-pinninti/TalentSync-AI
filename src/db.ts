import pg from "pg";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const { Pool } = pg;

const DB_FILE_PATH = path.join(process.cwd(), "data", "db.json");

// Ensure data directory exists for fallback local database
if (!fs.existsSync(path.dirname(DB_FILE_PATH))) {
  fs.mkdirSync(path.dirname(DB_FILE_PATH), { recursive: true });
}

// Lowdb-style atomic local storage representation
interface LocalDB {
  users: any[];
  jobs: any[];
  candidates: any[];
  match_results: any[];
  interview_questions: any[];
  audit_logs: any[];
  system_settings: any[];
  copilot_chats: any[];
  interviews: any[];
  notifications: any[];
  notification_templates: any[];
  app_notifications: any[];
  documents: any[];
}

const defaultTemplates = [
  {
    id: 1,
    category: "interview_invitation",
    subject: "Interview Scheduled: {{interview_title}} at {{company_name}}",
    body: "Hi {{candidate_name}},\n\nWe are excited to invite you to interview for the {{job_title}} position at {{company_name}}.\n\nHere are your interview details:\n- Date/Time: {{datetime}}\n- Duration: {{duration}} minutes\n- Interviewer: {{interviewer_name}}\n- Platform: {{platform}}\n{{meeting_link_section}}\n\nPlease let us know if you have any questions or need to reschedule.\n\nBest regards,\n\n{{recruiter_name}}\n{{company_name}} Team",
    variables: "[\"candidate_name\", \"job_title\", \"company_name\", \"interview_title\", \"datetime\", \"duration\", \"interviewer_name\", \"platform\", \"meeting_link_section\", \"recruiter_name\"]"
  },
  {
    id: 2,
    category: "password_reset",
    subject: "Password Reset Request for {{user_name}}",
    body: "Hi {{user_name}},\n\nWe received a request to reset your password for your {{company_name}} account.\n\nTo reset your password, please click the link below or enter this verification code:\nVerification Code: {{reset_code}}\nReset Link: {{reset_link}}\n\nIf you did not request a password reset, please ignore this email or contact support if you have concerns.\n\nBest regards,\n\n{{company_name}} Security Team",
    variables: "[\"user_name\", \"company_name\", \"reset_code\", \"reset_link\"]"
  },
  {
    id: 3,
    category: "job_update",
    subject: "Application Update: {{job_title}} at {{company_name}}",
    body: "Hi {{candidate_name}},\n\nWe wanted to provide you with an update regarding your application for the {{job_title}} role at {{company_name}}.\n\nYour application status has been updated to: {{status}}.\n\nOur team is currently reviewing next steps, and we will reach out if we require further details or to schedule subsequent steps.\n\nBest regards,\n\n{{recruiter_name}}\n{{company_name}} Recruitment Team",
    variables: "[\"candidate_name\", \"job_title\", \"company_name\", \"status\", \"recruiter_name\"]"
  },
  {
    id: 4,
    category: "offer_letter",
    subject: "Official Job Offer: {{job_title}} - {{company_name}}",
    body: "Dear {{candidate_name}},\n\nOn behalf of {{company_name}}, we are thrilled to offer you the position of {{job_title}}!\n\nWe were incredibly impressed by your skills and experience, and we believe you will be a fantastic addition to our team.\n\nHere is a summary of the offer details:\n- Title: {{job_title}}\n- Base Salary: {{salary}} per year\n- Employment Type: {{employment_type}}\n- Proposed Start Date: {{start_date}}\n\nPlease find the full offer letter attached or viewable via your profile dashboard. To accept, please sign and return this document by {{deadline}}.\n\nWelcome to the team!\n\nSincerely,\n\n{{recruiter_name}}\n{{company_name}} Team",
    variables: "[\"candidate_name\", \"job_title\", \"company_name\", \"salary\", \"employment_type\", \"start_date\", \"deadline\", \"recruiter_name\"]"
  },
  {
    id: 5,
    category: "rejection",
    subject: "Your Application for {{job_title}} at {{company_name}}",
    body: "Dear {{candidate_name}},\n\nThank you so much for taking the time to meet with us and discuss the {{job_title}} position at {{company_name}}.\n\nAfter careful consideration, we have decided to move forward with other candidates whose experience more closely aligns with our immediate requirements.\n\nWe were deeply impressed by your background and will keep your profile in our candidate pool for future opportunities that match your expertise.\n\nWe wish you the absolute best in your career pursuits.\n\nWarm regards,\n\n{{recruiter_name}}\n{{company_name}} Recruitment Team",
    variables: "[\"candidate_name\", \"job_title\", \"company_name\", \"recruiter_name\"]"
  },
  {
    id: 6,
    category: "reminder",
    subject: "Friendly Reminder: Upcoming Interview for {{job_title}}",
    body: "Hi {{candidate_name}},\n\nThis is a friendly reminder of your upcoming interview round for the {{job_title}} position at {{company_name}}.\n\nUpcoming Session Details:\n- Subject: {{interview_title}}\n- Date/Time: {{datetime}}\n- Interviewer: {{interviewer_name}}\n- Platform: {{platform}}\n{{meeting_link_section}}\n\nPlease make sure to have a stable internet connection, turn your camera on, and join 3 minutes before the scheduled start time.\n\nBest regards,\n\n{{recruiter_name}}\n{{company_name}} Team",
    variables: "[\"candidate_name\", \"job_title\", \"company_name\", \"interview_title\", \"datetime\", \"interviewer_name\", \"platform\", \"meeting_link_section\", \"recruiter_name\"]"
  }
];

const defaultLocalDB: LocalDB = {
  users: [],
  jobs: [],
  candidates: [],
  match_results: [],
  interview_questions: [],
  audit_logs: [],
  system_settings: [],
  copilot_chats: [],
  interviews: [],
  notifications: [],
  notification_templates: defaultTemplates,
  app_notifications: [],
  documents: [],
};

function readLocalDB(): LocalDB {
  try {
    if (!fs.existsSync(DB_FILE_PATH)) {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(defaultLocalDB, null, 2));
      return defaultLocalDB;
    }
    const data = fs.readFileSync(DB_FILE_PATH, "utf-8");
    const parsed = JSON.parse(data);
    return {
      ...defaultLocalDB,
      ...parsed,
      users: parsed.users || [],
      jobs: parsed.jobs || [],
      candidates: parsed.candidates || [],
      match_results: parsed.match_results || [],
      interview_questions: parsed.interview_questions || [],
      audit_logs: parsed.audit_logs || [],
      system_settings: parsed.system_settings || [],
      copilot_chats: parsed.copilot_chats || [],
      interviews: parsed.interviews || [],
      notifications: parsed.notifications || [],
      notification_templates: parsed.notification_templates || defaultTemplates,
      app_notifications: parsed.app_notifications || [],
      documents: parsed.documents || []
    };
  } catch (err) {
    console.error("Failed to read local DB, using default structure:", err);
    return defaultLocalDB;
  }
}

function writeLocalDB(data: LocalDB) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to write to local DB:", err);
  }
}

// Database Connection
export let pool: pg.Pool | null = null;
export let isPostgres = false;

export async function initDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    try {
      console.log("PostgreSQL: Connection string detected. Connecting...");
      pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }, // Critical for Neon PostgreSQL
      });
      
      // Test connection
      await pool.query("SELECT NOW()");
      isPostgres = true;
      console.log("PostgreSQL: Connected successfully to Neon DB.");
      
      // Bootstrap tables
      await bootstrapPostgresTables();
    } catch (err) {
      console.error("PostgreSQL: Connection failed. Falling back to local file storage.", err);
      isPostgres = false;
      pool = null;
    }
  } else {
    console.log("PostgreSQL: DATABASE_URL not set. Using local file database storage.");
    // Initialize JSON local db file if needed
    readLocalDB();
  }
}

async function bootstrapPostgresTables() {
  if (!pool) return;
  
  console.log("PostgreSQL: Bootstrapping database tables if they do not exist...");
  
  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      company VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'recruiter',
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      recruiter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      experience VARCHAR(255) NOT NULL,
      skills TEXT NOT NULL, -- JSON string array
      education VARCHAR(255) NOT NULL,
      salary VARCHAR(255) NOT NULL,
      location VARCHAR(255) NOT NULL,
      employment_type VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS candidates (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(100) NOT NULL,
      skills TEXT NOT NULL, -- JSON string array
      experience_summary TEXT NOT NULL,
      education_summary TEXT NOT NULL,
      resume_text TEXT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      cover_letter TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS match_results (
      id SERIAL PRIMARY KEY,
      candidate_id INTEGER UNIQUE NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
      overall_score INTEGER NOT NULL,
      skills_match_score INTEGER NOT NULL,
      experience_match_score INTEGER NOT NULL,
      education_match_score INTEGER NOT NULL,
      matched_skills TEXT NOT NULL, -- JSON string array
      missing_skills TEXT NOT NULL, -- JSON string array
      summary TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      explanation TEXT NOT NULL,
      detailed_analysis TEXT, -- JSON structure
      recruiter_feedback VARCHAR(50),
      is_pinned BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS interview_questions (
      id SERIAL PRIMARY KEY,
      candidate_id INTEGER UNIQUE NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
      questions TEXT NOT NULL, -- JSON string array of InterviewQuestionItem
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      user_email VARCHAR(255),
      action VARCHAR(100) NOT NULL,
      details TEXT NOT NULL,
      ip_address VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS system_settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS copilot_chats (
      id SERIAL PRIMARY KEY,
      recruiter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS interviews (
      id SERIAL PRIMARY KEY,
      recruiter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      datetime VARCHAR(255) NOT NULL,
      duration INTEGER NOT NULL DEFAULT 60,
      interviewer_name VARCHAR(255) NOT NULL,
      interviewer_email VARCHAR(255) NOT NULL,
      platform VARCHAR(50) NOT NULL,
      meeting_link TEXT,
      notes TEXT,
      status VARCHAR(50) DEFAULT 'scheduled',
      scorecard TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS interview_notifications (
      id SERIAL PRIMARY KEY,
      interview_id INTEGER NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      recipient_email VARCHAR(255) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(50) DEFAULT 'sent'
    )`,
    `CREATE TABLE IF NOT EXISTS notification_templates (
      id SERIAL PRIMARY KEY,
      category VARCHAR(100) UNIQUE NOT NULL,
      subject VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      variables TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS app_notifications (
      id SERIAL PRIMARY KEY,
      recruiter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      category VARCHAR(100) NOT NULL,
      recipient_email VARCHAR(255) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'sent',
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      read_status BOOLEAN DEFAULT FALSE
    )`,
    `CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      file_size VARCHAR(50) NOT NULL,
      folder VARCHAR(100) DEFAULT 'Unsorted',
      uploaded_by VARCHAR(255) NOT NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      role_permissions TEXT DEFAULT '["all"]',
      content TEXT,
      mime_type VARCHAR(100) DEFAULT 'application/octet-stream',
      versions TEXT DEFAULT '[]'
    )`,
    // Ensure existing databases are updated seamlessly with fallback role and status columns
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'recruiter'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_temp_code VARCHAR(10) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_temp_expiry TIMESTAMP DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token_hash VARCHAR(255) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP DEFAULT NULL`,
    `ALTER TABLE match_results ADD COLUMN IF NOT EXISTS detailed_analysis TEXT DEFAULT NULL`,
    `ALTER TABLE match_results ADD COLUMN IF NOT EXISTS recruiter_feedback VARCHAR(50) DEFAULT NULL`,
    `ALTER TABLE match_results ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cover_letter TEXT DEFAULT NULL`
  ];

  for (const query of queries) {
    try {
      await pool.query(query);
    } catch (e) {
      console.error("Error running bootstrapping query. Query:", query, "Error:", e);
    }
  }

  // Seed default templates if table is empty
  try {
    const checkTemplates = await pool.query("SELECT COUNT(*) FROM notification_templates");
    if (parseInt(checkTemplates.rows[0].count) === 0) {
      console.log("PostgreSQL: Seeding default notification templates...");
      for (const t of defaultTemplates) {
        await pool.query(
          "INSERT INTO notification_templates (category, subject, body, variables) VALUES ($1, $2, $3, $4) ON CONFLICT (category) DO NOTHING",
          [t.category, t.subject, t.body, t.variables]
        );
      }
    }
  } catch (err) {
    console.error("PostgreSQL: Failed to seed templates:", err);
  }

  console.log("PostgreSQL: Schema initialization verified.");
}

// Repository Methods (Unified Interface)

export const db = {
  isPostgres: () => isPostgres,

  // Users
  users: {
    async create(user: { email: string; passwordHash: string; name: string; company: string; role?: string; status?: string }) {
      const uRole = user.role || "recruiter";
      const uStatus = user.status || "active";
      if (isPostgres && pool) {
        const query = `
          INSERT INTO users (email, password_hash, name, company, role, status)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, email, name, company, role, status, created_at
        `;
        const res = await pool.query(query, [user.email, user.passwordHash, user.name, user.company, uRole, uStatus]);
        return res.rows[0];
      } else {
        const local = readLocalDB();
        // Check uniqueness
        if (local.users.find((u) => u.email.toLowerCase() === user.email.toLowerCase())) {
          throw new Error("Email already registered");
        }
        const newUser = {
          id: local.users.length + 1,
          email: user.email,
          password_hash: user.passwordHash,
          name: user.name,
          company: user.company,
          role: uRole,
          status: uStatus,
          created_at: new Date().toISOString(),
        };
        local.users.push(newUser);
        writeLocalDB(local);
        const { password_hash, ...safeUser } = newUser;
        return safeUser;
      }
    },

    async findByEmail(email: string) {
      if (isPostgres && pool) {
        const query = `SELECT * FROM users WHERE email = $1 LIMIT 1`;
        const res = await pool.query(query, [email]);
        return res.rows[0] || null;
      } else {
        const local = readLocalDB();
        const found = local.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        return found ? { role: "recruiter", status: "active", ...found } : null;
      }
    },

    async findById(id: number) {
      if (isPostgres && pool) {
        const query = `SELECT * FROM users WHERE id = $1`;
        const res = await pool.query(query, [id]);
        return res.rows[0] || null;
      } else {
        const local = readLocalDB();
        const found = local.users.find((u) => u.id === id);
        if (!found) return null;
        const { password_hash, ...safeUser } = found;
        return { role: "recruiter", status: "active", ...safeUser };
      }
    },

    async listAll() {
      if (isPostgres && pool) {
        const query = `
          SELECT u.id, u.email, u.name, u.company, u.role, u.status, u.created_at,
                 COUNT(DISTINCT j.id) as jobs_count,
                 COUNT(DISTINCT c.id) as candidates_count
          FROM users u
          LEFT JOIN jobs j ON u.id = j.recruiter_id
          LEFT JOIN candidates c ON j.id = c.job_id
          GROUP BY u.id
          ORDER BY u.id ASC
        `;
        const res = await pool.query(query);
        return res.rows.map(row => ({
          ...row,
          jobs_count: parseInt(row.jobs_count || "0", 10),
          candidates_count: parseInt(row.candidates_count || "0", 10)
        }));
      } else {
        const local = readLocalDB();
        return local.users.map(({ password_hash, ...u }) => {
          const userJobs = local.jobs.filter(j => j.recruiter_id === u.id);
          const jobIds = userJobs.map(j => j.id);
          const userCandidates = local.candidates.filter(c => jobIds.includes(c.job_id));
          return {
            role: "recruiter",
            status: "active",
            ...u,
            jobs_count: userJobs.length,
            candidates_count: userCandidates.length
          };
        });
      }
    },

    async update(
      id: number,
      fields: Partial<{
        name: string;
        email: string;
        company: string;
        role: string;
        status: string;
        password_hash: string;
        two_factor_secret: string | null;
        two_factor_enabled: boolean;
        two_factor_temp_code: string | null;
        two_factor_temp_expiry: string | null;
        refresh_token_hash: string | null;
        password_changed_at: string | null;
      }>
    ) {
      if (isPostgres && pool) {
        const setClause: string[] = [];
        const values: any[] = [];
        let index = 1;
        
        Object.entries(fields).forEach(([key, val]) => {
          if (key === "id" || key === "created_at") return;
          setClause.push(`${key} = $${index}`);
          values.push(val);
          index++;
        });

        if (setClause.length === 0) return await this.findById(id);

        values.push(id);
        const query = `
          UPDATE users 
          SET ${setClause.join(", ")}
          WHERE id = $${index}
          RETURNING *
        `;
        const res = await pool.query(query, values);
        return res.rows[0] || null;
      } else {
        const local = readLocalDB();
        const index = local.users.findIndex((u) => u.id === id);
        if (index === -1) return null;
        local.users[index] = { ...local.users[index], ...fields };
        writeLocalDB(local);
        const { password_hash, ...safeUser } = local.users[index];
        return { role: "recruiter", status: "active", ...safeUser };
      }
    },

    async delete(id: number) {
      if (isPostgres && pool) {
        await pool.query("DELETE FROM users WHERE id = $1", [id]);
        return true;
      } else {
        const local = readLocalDB();
        local.users = local.users.filter((u) => u.id !== id);
        const jobsToDelete = local.jobs.filter((j) => j.recruiter_id === id).map((j) => j.id);
        local.jobs = local.jobs.filter((j) => j.recruiter_id !== id);
        local.candidates = local.candidates.filter((c) => !jobsToDelete.includes(c.job_id));
        writeLocalDB(local);
        return true;
      }
    }
  },

  // Jobs
  jobs: {
    async create(job: {
      recruiter_id: number;
      title: string;
      description: string;
      experience: string;
      skills: string[];
      education: string;
      salary: string;
      location: string;
      employment_type: string;
    }) {
      if (isPostgres && pool) {
        const query = `
          INSERT INTO jobs (recruiter_id, title, description, experience, skills, education, salary, location, employment_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `;
        const res = await pool.query(query, [
          job.recruiter_id,
          job.title,
          job.description,
          job.experience,
          JSON.stringify(job.skills),
          job.education,
          job.salary,
          job.location,
          job.employment_type
        ]);
        const row = res.rows[0];
        return { ...row, skills: JSON.parse(row.skills) };
      } else {
        const local = readLocalDB();
        const newJob = {
          id: local.jobs.length + 1,
          recruiter_id: job.recruiter_id,
          title: job.title,
          description: job.description,
          experience: job.experience,
          skills: job.skills,
          education: job.education,
          salary: job.salary,
          location: job.location,
          employment_type: job.employment_type,
          status: "active",
          created_at: new Date().toISOString(),
        };
        local.jobs.push(newJob);
        writeLocalDB(local);
        return newJob;
      }
    },

    async listByRecruiter(recruiterId: number) {
      if (isPostgres && pool) {
        const query = `SELECT * FROM jobs WHERE recruiter_id = $1 ORDER BY created_at DESC`;
        const res = await pool.query(query, [recruiterId]);
        return res.rows.map((row) => ({
          ...row,
          skills: JSON.parse(row.skills)
        }));
      } else {
        const local = readLocalDB();
        return local.jobs
          .filter((j) => j.recruiter_id === recruiterId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    },

    async findById(id: number) {
      if (isPostgres && pool) {
        const query = `SELECT * FROM jobs WHERE id = $1`;
        const res = await pool.query(query, [id]);
        const row = res.rows[0];
        if (!row) return null;
        return { ...row, skills: JSON.parse(row.skills) };
      } else {
        const local = readLocalDB();
        return local.jobs.find((j) => j.id === id) || null;
      }
    },

    async update(id: number, fields: Partial<any>) {
      if (isPostgres && pool) {
        const setClause: string[] = [];
        const values: any[] = [];
        let index = 1;
        
        Object.entries(fields).forEach(([key, val]) => {
          if (key === "id" || key === "recruiter_id" || key === "created_at") return;
          const dbVal = key === "skills" ? JSON.stringify(val) : val;
          setClause.push(`${key} = $${index}`);
          values.push(dbVal);
          index++;
        });

        if (setClause.length === 0) return await this.findById(id);

        values.push(id);
        const query = `
          UPDATE jobs 
          SET ${setClause.join(", ")}
          WHERE id = $${index}
          RETURNING *
        `;
        const res = await pool.query(query, values);
        const row = res.rows[0];
        if (!row) return null;
        return { ...row, skills: JSON.parse(row.skills) };
      } else {
        const local = readLocalDB();
        const index = local.jobs.findIndex((j) => j.id === id);
        if (index === -1) return null;
        local.jobs[index] = { ...local.jobs[index], ...fields };
        writeLocalDB(local);
        return local.jobs[index];
      }
    },

    async delete(id: number) {
      if (isPostgres && pool) {
        await pool.query("DELETE FROM jobs WHERE id = $1", [id]);
        return true;
      } else {
        const local = readLocalDB();
        local.jobs = local.jobs.filter((j) => j.id !== id);
        local.candidates = local.candidates.filter((c) => c.job_id !== id);
        writeLocalDB(local);
        return true;
      }
    }
  },

  // Candidates
  candidates: {
    async create(candidate: {
      job_id: number;
      name: string;
      email: string;
      phone: string;
      skills: string[];
      experience_summary: string;
      education_summary: string;
      resume_text: string;
      file_name: string;
      cover_letter?: string;
    }) {
      if (isPostgres && pool) {
        const query = `
          INSERT INTO candidates (job_id, name, email, phone, skills, experience_summary, education_summary, resume_text, file_name, cover_letter)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `;
        const res = await pool.query(query, [
          candidate.job_id,
          candidate.name,
          candidate.email,
          candidate.phone,
          JSON.stringify(candidate.skills),
          candidate.experience_summary,
          candidate.education_summary,
          candidate.resume_text,
          candidate.file_name,
          candidate.cover_letter || null
        ]);
        const row = res.rows[0];
        return { ...row, skills: JSON.parse(row.skills) };
      } else {
        const local = readLocalDB();
        const newCandidate = {
          id: local.candidates.length + 1,
          job_id: candidate.job_id,
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone,
          skills: candidate.skills,
          experience_summary: candidate.experience_summary,
          education_summary: candidate.education_summary,
          resume_text: candidate.resume_text,
          file_name: candidate.file_name,
          cover_letter: candidate.cover_letter || null,
          created_at: new Date().toISOString()
        };
        local.candidates.push(newCandidate);
        writeLocalDB(local);
        return newCandidate;
      }
    },

    async listByJob(jobId: number) {
      if (isPostgres && pool) {
        const query = `
          SELECT c.*, 
                 m.overall_score, m.skills_match_score, m.experience_match_score, m.education_match_score, 
                 m.matched_skills, m.missing_skills, m.summary, m.recommendation, m.explanation,
                 m.detailed_analysis, m.recruiter_feedback, m.is_pinned
          FROM candidates c
          LEFT JOIN match_results m ON c.id = m.candidate_id
          WHERE c.job_id = $1
          ORDER BY m.is_pinned DESC, m.overall_score DESC NULLS LAST, c.created_at DESC
        `;
        const res = await pool.query(query, [jobId]);
        return res.rows.map((row) => {
          const skills = JSON.parse(row.skills);
          const hasMatch = row.overall_score !== null;
          return {
            id: row.id,
            job_id: row.job_id,
            name: row.name,
            email: row.email,
            phone: row.phone,
            skills,
            experience_summary: row.experience_summary,
            education_summary: row.education_summary,
            resume_text: row.resume_text,
            file_name: row.file_name,
            created_at: row.created_at,
            match: hasMatch ? {
              overall_score: row.overall_score,
              skills_match_score: row.skills_match_score,
              experience_match_score: row.experience_match_score,
              education_match_score: row.education_match_score,
              matched_skills: JSON.parse(row.matched_skills),
              missing_skills: JSON.parse(row.missing_skills),
              summary: row.summary,
              recommendation: row.recommendation,
              explanation: row.explanation,
              detailed_analysis: row.detailed_analysis ? JSON.parse(row.detailed_analysis) : undefined,
              recruiter_feedback: row.recruiter_feedback || undefined,
              is_pinned: !!row.is_pinned
            } : undefined
          };
        });
      } else {
        const local = readLocalDB();
        const candList = local.candidates.filter((c) => c.job_id === jobId);
        return candList.map((c) => {
          const match = local.match_results.find((m) => m.candidate_id === c.id);
          return {
            ...c,
            match
          };
        }).sort((a, b) => {
          const pinA = a.match?.is_pinned ? 1 : 0;
          const pinB = b.match?.is_pinned ? 1 : 0;
          if (pinA !== pinB) return pinB - pinA;
          const scoreA = a.match?.overall_score || -1;
          const scoreB = b.match?.overall_score || -1;
          if (scoreA !== scoreB) return scoreB - scoreA;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      }
    },

    async findById(id: number) {
      if (isPostgres && pool) {
        const query = `
          SELECT c.*, 
                 m.overall_score, m.skills_match_score, m.experience_match_score, m.education_match_score, 
                 m.matched_skills, m.missing_skills, m.summary, m.recommendation, m.explanation,
                 m.detailed_analysis, m.recruiter_feedback, m.is_pinned
          FROM candidates c
          LEFT JOIN match_results m ON c.id = m.candidate_id
          WHERE c.id = $1
        `;
        const res = await pool.query(query, [id]);
        const row = res.rows[0];
        if (!row) return null;
        const skills = JSON.parse(row.skills);
        const hasMatch = row.overall_score !== null;
        return {
          id: row.id,
          job_id: row.job_id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          skills,
          experience_summary: row.experience_summary,
          education_summary: row.education_summary,
          resume_text: row.resume_text,
          file_name: row.file_name,
          created_at: row.created_at,
          match: hasMatch ? {
            overall_score: row.overall_score,
            skills_match_score: row.skills_match_score,
            experience_match_score: row.experience_match_score,
            education_match_score: row.education_match_score,
            matched_skills: JSON.parse(row.matched_skills),
            missing_skills: JSON.parse(row.missing_skills),
            summary: row.summary,
            recommendation: row.recommendation,
            explanation: row.explanation,
            detailed_analysis: row.detailed_analysis ? JSON.parse(row.detailed_analysis) : undefined,
            recruiter_feedback: row.recruiter_feedback || undefined,
            is_pinned: !!row.is_pinned
          } : undefined
        };
      } else {
        const local = readLocalDB();
        const c = local.candidates.find((candidate) => candidate.id === id);
        if (!c) return null;
        const match = local.match_results.find((m) => m.candidate_id === c.id);
        return { ...c, match };
      }
    },

    async listByRecruiter(recruiterId: number) {
      if (isPostgres && pool) {
        const query = `
          SELECT c.*, j.title as job_title,
                 m.overall_score, m.skills_match_score, m.experience_match_score, m.education_match_score,
                 m.detailed_analysis, m.recruiter_feedback, m.is_pinned
          FROM candidates c
          JOIN jobs j ON c.job_id = j.id
          LEFT JOIN match_results m ON c.id = m.candidate_id
          WHERE j.recruiter_id = $1
          ORDER BY m.is_pinned DESC, c.created_at DESC
        `;
        const res = await pool.query(query, [recruiterId]);
        return res.rows.map((row) => ({
          ...row,
          skills: JSON.parse(row.skills),
          match: row.overall_score !== null ? {
            overall_score: row.overall_score,
            skills_match_score: row.skills_match_score,
            experience_match_score: row.experience_match_score,
            education_match_score: row.education_match_score,
            detailed_analysis: row.detailed_analysis ? JSON.parse(row.detailed_analysis) : undefined,
            recruiter_feedback: row.recruiter_feedback || undefined,
            is_pinned: !!row.is_pinned
          } : undefined
        }));
      } else {
        const local = readLocalDB();
        const jobs = local.jobs.filter((j) => j.recruiter_id === recruiterId);
        const jobIds = jobs.map((j) => j.id);
        const cands = local.candidates.filter((c) => jobIds.includes(c.job_id));
        return cands.map((c) => {
          const job = jobs.find((j) => j.id === c.job_id);
          const match = local.match_results.find((m) => m.candidate_id === c.id);
          return {
            ...c,
            job_title: job ? job.title : "Unknown Job",
            match
          };
        }).sort((a, b) => {
          const pinA = a.match?.is_pinned ? 1 : 0;
          const pinB = b.match?.is_pinned ? 1 : 0;
          if (pinA !== pinB) return pinB - pinA;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      }
    },

    async updateSkills(id: number, skills: string[]) {
      if (isPostgres && pool) {
        const query = `
          UPDATE candidates
          SET skills = $1
          WHERE id = $2
          RETURNING *
        `;
        const res = await pool.query(query, [JSON.stringify(skills), id]);
        const row = res.rows[0];
        if (!row) return null;
        return { ...row, skills: JSON.parse(row.skills) };
      } else {
        const local = readLocalDB();
        const cand = local.candidates.find((c) => c.id === id);
        if (!cand) return null;
        cand.skills = skills;
        writeLocalDB(local);
        return cand;
      }
    },

    async delete(id: number) {
      if (isPostgres && pool) {
        await pool.query("DELETE FROM candidates WHERE id = $1", [id]);
        return true;
      } else {
        const local = readLocalDB();
        local.candidates = local.candidates.filter((c) => c.id !== id);
        local.match_results = local.match_results.filter((m) => m.candidate_id !== id);
        local.interview_questions = local.interview_questions.filter((q) => q.candidate_id !== id);
        writeLocalDB(local);
        return true;
      }
    }
  },

  // Match Results
  matchResults: {
    async create(match: {
      candidate_id: number;
      overall_score: number;
      skills_match_score: number;
      experience_match_score: number;
      education_match_score: number;
      matched_skills: string[];
      missing_skills: string[];
      summary: string;
      recommendation: string;
      explanation: string;
      detailed_analysis?: any;
      recruiter_feedback?: string;
      is_pinned?: boolean;
    }) {
      if (isPostgres && pool) {
        const query = `
          INSERT INTO match_results (candidate_id, overall_score, skills_match_score, experience_match_score, education_match_score, matched_skills, missing_skills, summary, recommendation, explanation, detailed_analysis, recruiter_feedback, is_pinned)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (candidate_id) 
          DO UPDATE SET 
            overall_score = EXCLUDED.overall_score,
            skills_match_score = EXCLUDED.skills_match_score,
            experience_match_score = EXCLUDED.experience_match_score,
            education_match_score = EXCLUDED.education_match_score,
            matched_skills = EXCLUDED.matched_skills,
            missing_skills = EXCLUDED.missing_skills,
            summary = EXCLUDED.summary,
            recommendation = EXCLUDED.recommendation,
            explanation = EXCLUDED.explanation,
            detailed_analysis = EXCLUDED.detailed_analysis,
            recruiter_feedback = EXCLUDED.recruiter_feedback,
            is_pinned = EXCLUDED.is_pinned
          RETURNING *
        `;
        const res = await pool.query(query, [
          match.candidate_id,
          match.overall_score,
          match.skills_match_score,
          match.experience_match_score,
          match.education_match_score,
          JSON.stringify(match.matched_skills),
          JSON.stringify(match.missing_skills),
          match.summary,
          match.recommendation,
          match.explanation,
          match.detailed_analysis ? JSON.stringify(match.detailed_analysis) : null,
          match.recruiter_feedback || null,
          !!match.is_pinned
        ]);
        const row = res.rows[0];
        return {
          ...row,
          matched_skills: JSON.parse(row.matched_skills),
          missing_skills: JSON.parse(row.missing_skills),
          detailed_analysis: row.detailed_analysis ? JSON.parse(row.detailed_analysis) : undefined
        };
      } else {
        const local = readLocalDB();
        const existingIndex = local.match_results.findIndex((m) => m.candidate_id === match.candidate_id);
        const newMatch = {
          id: existingIndex !== -1 ? local.match_results[existingIndex].id : local.match_results.length + 1,
          candidate_id: match.candidate_id,
          overall_score: match.overall_score,
          skills_match_score: match.skills_match_score,
          experience_match_score: match.experience_match_score,
          education_match_score: match.education_match_score,
          matched_skills: match.matched_skills,
          missing_skills: match.missing_skills,
          summary: match.summary,
          recommendation: match.recommendation,
          explanation: match.explanation,
          detailed_analysis: match.detailed_analysis,
          recruiter_feedback: match.recruiter_feedback,
          is_pinned: !!match.is_pinned,
          created_at: new Date().toISOString()
        };
        if (existingIndex !== -1) {
          local.match_results[existingIndex] = newMatch;
        } else {
          local.match_results.push(newMatch);
        }
        writeLocalDB(local);
        return newMatch;
      }
    },

    async setFeedback(candidateId: number, feedback: string) {
      if (isPostgres && pool) {
        await pool.query("UPDATE match_results SET recruiter_feedback = $1 WHERE candidate_id = $2", [feedback, candidateId]);
      } else {
        const local = readLocalDB();
        const m = local.match_results.find((mr) => mr.candidate_id === candidateId);
        if (m) {
          m.recruiter_feedback = feedback;
          writeLocalDB(local);
        }
      }
    },

    async setPinned(candidateId: number, isPinned: boolean) {
      if (isPostgres && pool) {
        await pool.query("UPDATE match_results SET is_pinned = $1 WHERE candidate_id = $2", [isPinned, candidateId]);
      } else {
        const local = readLocalDB();
        const m = local.match_results.find((mr) => mr.candidate_id === candidateId);
        if (m) {
          m.is_pinned = isPinned;
          writeLocalDB(local);
        }
      }
    },

    async findByCandidateId(candidateId: number) {
      if (isPostgres && pool) {
        const query = `SELECT * FROM match_results WHERE candidate_id = $1`;
        const res = await pool.query(query, [candidateId]);
        const row = res.rows[0];
        if (!row) return null;
        return {
          ...row,
          matched_skills: JSON.parse(row.matched_skills),
          missing_skills: JSON.parse(row.missing_skills),
          detailed_analysis: row.detailed_analysis ? JSON.parse(row.detailed_analysis) : undefined
        };
      } else {
        const local = readLocalDB();
        return local.match_results.find((m) => m.candidate_id === candidateId) || null;
      }
    }
  },

  // Interview Questions
  interviewQuestions: {
    async create(q: { candidate_id: number; questions: any[] }) {
      if (isPostgres && pool) {
        const query = `
          INSERT INTO interview_questions (candidate_id, questions)
          VALUES ($1, $2)
          ON CONFLICT (candidate_id)
          DO UPDATE SET questions = EXCLUDED.questions
          RETURNING *
        `;
        const res = await pool.query(query, [q.candidate_id, JSON.stringify(q.questions)]);
        const row = res.rows[0];
        return { ...row, questions: JSON.parse(row.questions) };
      } else {
        const local = readLocalDB();
        const existingIndex = local.interview_questions.findIndex((it) => it.candidate_id === q.candidate_id);
        const newQ = {
          id: existingIndex !== -1 ? local.interview_questions[existingIndex].id : local.interview_questions.length + 1,
          candidate_id: q.candidate_id,
          questions: q.questions,
          created_at: new Date().toISOString()
        };
        if (existingIndex !== -1) {
          local.interview_questions[existingIndex] = newQ;
        } else {
          local.interview_questions.push(newQ);
        }
        writeLocalDB(local);
        return newQ;
      }
    },

    async findByCandidateId(candidateId: number) {
      if (isPostgres && pool) {
        const query = `SELECT * FROM interview_questions WHERE candidate_id = $1`;
        const res = await pool.query(query, [candidateId]);
        const row = res.rows[0];
        if (!row) return null;
        return { ...row, questions: JSON.parse(row.questions) };
      } else {
        const local = readLocalDB();
        return local.interview_questions.find((it) => it.candidate_id === candidateId) || null;
      }
    }
  },

  // Audit Logs
  auditLogs: {
    async create(log: { user_id?: number; user_email?: string; action: string; details: string; ip_address?: string }) {
      if (isPostgres && pool) {
        const query = `
          INSERT INTO audit_logs (user_id, user_email, action, details, ip_address)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `;
        const res = await pool.query(query, [
          log.user_id || null,
          log.user_email || null,
          log.action,
          log.details,
          log.ip_address || null
        ]);
        return res.rows[0];
      } else {
        const local = readLocalDB();
        const newLog = {
          id: (local.audit_logs || []).length + 1,
          user_id: log.user_id || null,
          user_email: log.user_email || null,
          action: log.action,
          details: log.details,
          ip_address: log.ip_address || null,
          created_at: new Date().toISOString()
        };
        if (!local.audit_logs) local.audit_logs = [];
        local.audit_logs.push(newLog);
        writeLocalDB(local);
        return newLog;
      }
    },

    async listAll() {
      if (isPostgres && pool) {
        const query = `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500`;
        const res = await pool.query(query);
        return res.rows;
      } else {
        const local = readLocalDB();
        return (local.audit_logs || [])
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 500);
      }
    },

    async countToday() {
      const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      if (isPostgres && pool) {
        const query = `SELECT COUNT(*) as count FROM audit_logs WHERE created_at::text LIKE $1`;
        const res = await pool.query(query, [`${todayStr}%`]);
        return parseInt(res.rows[0]?.count || "0", 10);
      } else {
        const local = readLocalDB();
        return (local.audit_logs || []).filter((log) => log.created_at.startsWith(todayStr)).length;
      }
    }
  },

  // System Settings
  systemSettings: {
    async get(key: string, defaultValue: string): Promise<string> {
      if (isPostgres && pool) {
        const query = `SELECT value FROM system_settings WHERE key = $1`;
        const res = await pool.query(query, [key]);
        return res.rows[0]?.value ?? defaultValue;
      } else {
        const local = readLocalDB();
        const setting = (local.system_settings || []).find((s: any) => s.key === key);
        return setting ? setting.value : defaultValue;
      }
    },

    async set(key: string, value: string) {
      if (isPostgres && pool) {
        const query = `
          INSERT INTO system_settings (key, value)
          VALUES ($1, $2)
          ON CONFLICT (key)
          DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `;
        const res = await pool.query(query, [key, value]);
        return res.rows[0];
      } else {
        const local = readLocalDB();
        if (!local.system_settings) local.system_settings = [];
        const index = local.system_settings.findIndex((s: any) => s.key === key);
        const newSetting = { key, value, updated_at: new Date().toISOString() };
        if (index !== -1) {
          local.system_settings[index] = newSetting;
        } else {
          local.system_settings.push(newSetting);
        }
        writeLocalDB(local);
        return newSetting;
      }
    },

    async listAll() {
      if (isPostgres && pool) {
        const query = `SELECT key, value FROM system_settings`;
        const res = await pool.query(query);
        return res.rows;
      } else {
        const local = readLocalDB();
        return local.system_settings || [];
      }
    }
  },

  // Copilot Chats
  copilotChats: {
    async create(chat: { recruiter_id: number; role: "user" | "model"; content: string }) {
      if (isPostgres && pool) {
        const query = `
          INSERT INTO copilot_chats (recruiter_id, role, content)
          VALUES ($1, $2, $3)
          RETURNING *
        `;
        const res = await pool.query(query, [chat.recruiter_id, chat.role, chat.content]);
        return res.rows[0];
      } else {
        const local = readLocalDB();
        if (!local.copilot_chats) local.copilot_chats = [];
        const newChat = {
          id: local.copilot_chats.length + 1,
          recruiter_id: chat.recruiter_id,
          role: chat.role,
          content: chat.content,
          created_at: new Date().toISOString()
        };
        local.copilot_chats.push(newChat);
        writeLocalDB(local);
        return newChat;
      }
    },

    async listByRecruiter(recruiterId: number) {
      if (isPostgres && pool) {
        const query = `SELECT * FROM copilot_chats WHERE recruiter_id = $1 ORDER BY created_at ASC`;
        const res = await pool.query(query, [recruiterId]);
        return res.rows;
      } else {
        const local = readLocalDB();
        const list = (local.copilot_chats || []).filter((c: any) => c.recruiter_id === recruiterId);
        return list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
    },

    async clear(recruiterId: number) {
      if (isPostgres && pool) {
        const query = `DELETE FROM copilot_chats WHERE recruiter_id = $1`;
        await pool.query(query, [recruiterId]);
        return true;
      } else {
        const local = readLocalDB();
        local.copilot_chats = (local.copilot_chats || []).filter((c: any) => c.recruiter_id !== recruiterId);
        writeLocalDB(local);
        return true;
      }
    }
  },

  // Interviews
  interviews: {
    async create(data: {
      recruiter_id: number;
      candidate_id: number;
      job_id: number;
      title: string;
      datetime: string;
      duration: number;
      interviewer_name: string;
      interviewer_email: string;
      platform: string;
      meeting_link?: string;
      notes?: string;
    }) {
      if (isPostgres && pool) {
        const query = `
          INSERT INTO interviews (recruiter_id, candidate_id, job_id, title, datetime, duration, interviewer_name, interviewer_email, platform, meeting_link, notes, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'scheduled')
          RETURNING *
        `;
        const res = await pool.query(query, [
          data.recruiter_id,
          data.candidate_id,
          data.job_id,
          data.title,
          data.datetime,
          data.duration,
          data.interviewer_name,
          data.interviewer_email,
          data.platform,
          data.meeting_link || "",
          data.notes || "",
        ]);
        return res.rows[0];
      } else {
        const local = readLocalDB();
        if (!local.interviews) local.interviews = [];
        const newInterview = {
          id: local.interviews.length + 1,
          ...data,
          status: "scheduled" as const,
          scorecard: null,
          created_at: new Date().toISOString(),
        };
        local.interviews.push(newInterview);
        writeLocalDB(local);
        return newInterview;
      }
    },

    async listByRecruiter(recruiterId: number) {
      if (isPostgres && pool) {
        const query = `
          SELECT i.*, c.name as candidate_name, c.email as candidate_email, j.title as job_title
          FROM interviews i
          JOIN candidates c ON i.candidate_id = c.id
          JOIN jobs j ON i.job_id = j.id
          WHERE i.recruiter_id = $1
          ORDER BY i.datetime ASC
        `;
        const res = await pool.query(query, [recruiterId]);
        const rows = res.rows;
        // Parse scorecards if they exist
        for (const row of rows) {
          if (row.scorecard && typeof row.scorecard === "string") {
            try {
              row.scorecard = JSON.parse(row.scorecard);
            } catch {
              row.scorecard = null;
            }
          }
        }
        return rows;
      } else {
        const local = readLocalDB();
        const list = (local.interviews || []).filter((i: any) => i.recruiter_id === recruiterId);
        return list.map((i: any) => {
          const candidate = (local.candidates || []).find((c) => c.id === i.candidate_id);
          const job = (local.jobs || []).find((j) => j.id === i.job_id);
          return {
            ...i,
            candidate_name: candidate ? candidate.name : "Unknown Candidate",
            candidate_email: candidate ? candidate.email : "",
            job_title: job ? job.title : "Unknown Job",
          };
        }).sort((a: any, b: any) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
      }
    },

    async updateStatus(id: number, recruiterId: number, status: string) {
      if (isPostgres && pool) {
        const query = `
          UPDATE interviews
          SET status = $1
          WHERE id = $2 AND recruiter_id = $3
          RETURNING *
        `;
        const res = await pool.query(query, [status, id, recruiterId]);
        const row = res.rows[0];
        if (row && row.scorecard && typeof row.scorecard === "string") {
          try {
            row.scorecard = JSON.parse(row.scorecard);
          } catch {}
        }
        return row;
      } else {
        const local = readLocalDB();
        const interview = (local.interviews || []).find((i: any) => i.id === id && i.recruiter_id === recruiterId);
        if (interview) {
          interview.status = status;
          writeLocalDB(local);
          return interview;
        }
        return null;
      }
    },

    async updateScorecard(id: number, recruiterId: number, scorecard: any) {
      const scorecardStr = typeof scorecard === "string" ? scorecard : JSON.stringify(scorecard);
      if (isPostgres && pool) {
        const query = `
          UPDATE interviews
          SET scorecard = $1, status = 'completed'
          WHERE id = $2 AND recruiter_id = $3
          RETURNING *
        `;
        const res = await pool.query(query, [scorecardStr, id, recruiterId]);
        const row = res.rows[0];
        if (row && typeof row.scorecard === "string") {
          try {
            row.scorecard = JSON.parse(row.scorecard);
          } catch {}
        }
        return row;
      } else {
        const local = readLocalDB();
        const interview = (local.interviews || []).find((i: any) => i.id === id && i.recruiter_id === recruiterId);
        if (interview) {
          interview.scorecard = typeof scorecard === "string" ? JSON.parse(scorecard) : scorecard;
          interview.status = "completed";
          writeLocalDB(local);
          return interview;
        }
        return null;
      }
    },

    async delete(id: number, recruiterId: number) {
      if (isPostgres && pool) {
        const query = `DELETE FROM interviews WHERE id = $1 AND recruiter_id = $2`;
        await pool.query(query, [id, recruiterId]);
        return true;
      } else {
        const local = readLocalDB();
        local.interviews = (local.interviews || []).filter((i: any) => !(i.id === id && i.recruiter_id === recruiterId));
        writeLocalDB(local);
        return true;
      }
    }
  },

  // Notifications Log
  notifications: {
    async create(data: {
      interview_id: number;
      type: string;
      recipient_email: string;
      subject: string;
      body: string;
      status?: string;
    }) {
      const status = data.status || "sent";
      if (isPostgres && pool) {
        const query = `
          INSERT INTO interview_notifications (interview_id, type, recipient_email, subject, body, status)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `;
        const res = await pool.query(query, [
          data.interview_id,
          data.type,
          data.recipient_email,
          data.subject,
          data.body,
          status,
        ]);
        return res.rows[0];
      } else {
        const local = readLocalDB();
        if (!local.notifications) local.notifications = [];
        const newNotification = {
          id: local.notifications.length + 1,
          ...data,
          status,
          sent_at: new Date().toISOString(),
        };
        local.notifications.push(newNotification);
        writeLocalDB(local);
        return newNotification;
      }
    },

    async listByRecruiter(recruiterId: number) {
      if (isPostgres && pool) {
        const query = `
          SELECT n.*, i.title as interview_title
          FROM interview_notifications n
          JOIN interviews i ON n.interview_id = i.id
          WHERE i.recruiter_id = $1
          ORDER BY n.sent_at DESC
        `;
        const res = await pool.query(query, [recruiterId]);
        return res.rows;
      } else {
        const local = readLocalDB();
        const recInterviews = (local.interviews || []).filter((i: any) => i.recruiter_id === recruiterId);
        const intIds = recInterviews.map((i: any) => i.id);
        const list = (local.notifications || []).filter((n: any) => intIds.includes(n.interview_id));
        return list.map((n: any) => {
          const interview = recInterviews.find((i: any) => i.id === n.interview_id);
          return {
            ...n,
            interview_title: interview ? interview.title : "Unknown Interview",
          };
        }).sort((a: any, b: any) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
      }
    }
  },

  // 1. Notification Templates Repository
  notificationTemplates: {
    async listAll() {
      if (isPostgres && pool) {
        const query = "SELECT * FROM notification_templates ORDER BY category ASC";
        const res = await pool.query(query);
        return res.rows;
      } else {
        const local = readLocalDB();
        return local.notification_templates || [];
      }
    },

    async getByCategory(category: string) {
      if (isPostgres && pool) {
        const query = "SELECT * FROM notification_templates WHERE category = $1";
        const res = await pool.query(query, [category]);
        return res.rows[0] || null;
      } else {
        const local = readLocalDB();
        return (local.notification_templates || []).find((t: any) => t.category === category) || null;
      }
    },

    async update(category: string, subject: string, body: string) {
      if (isPostgres && pool) {
        const query = `
          UPDATE notification_templates
          SET subject = $2, body = $3, updated_at = CURRENT_TIMESTAMP
          WHERE category = $1
          RETURNING *
        `;
        const res = await pool.query(query, [category, subject, body]);
        return res.rows[0];
      } else {
        const local = readLocalDB();
        const templates = local.notification_templates || [];
        const index = templates.findIndex((t: any) => t.category === category);
        if (index !== -1) {
          templates[index] = {
            ...templates[index],
            subject,
            body,
            updated_at: new Date().toISOString()
          };
          writeLocalDB(local);
          return templates[index];
        }
        return null;
      }
    }
  },

  // 2. App-wide General Notifications Repository
  appNotifications: {
    async create(data: {
      recruiter_id: number | null;
      category: string;
      recipient_email: string;
      subject: string;
      body: string;
      status?: string;
    }) {
      const status = data.status || "sent";
      if (isPostgres && pool) {
        const query = `
          INSERT INTO app_notifications (recruiter_id, category, recipient_email, subject, body, status)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `;
        const res = await pool.query(query, [
          data.recruiter_id,
          data.category,
          data.recipient_email,
          data.subject,
          data.body,
          status,
        ]);
        return res.rows[0];
      } else {
        const local = readLocalDB();
        if (!local.app_notifications) local.app_notifications = [];
        const newNotification = {
          id: local.app_notifications.length + 1,
          recruiter_id: data.recruiter_id,
          category: data.category,
          recipient_email: data.recipient_email,
          subject: data.subject,
          body: data.body,
          status,
          sent_at: new Date().toISOString(),
          read_status: false
        };
        local.app_notifications.push(newNotification);
        writeLocalDB(local);
        return newNotification;
      }
    },

    async listByRecruiter(recruiterId: number) {
      if (isPostgres && pool) {
        const query = `
          SELECT * FROM app_notifications
          WHERE recruiter_id = $1 OR recruiter_id IS NULL
          ORDER BY sent_at DESC
        `;
        const res = await pool.query(query, [recruiterId]);
        return res.rows;
      } else {
        const local = readLocalDB();
        return (local.app_notifications || [])
          .filter((n: any) => n.recruiter_id === recruiterId || n.recruiter_id === null)
          .sort((a: any, b: any) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
      }
    },

    async markAsRead(id: number) {
      if (isPostgres && pool) {
        const query = `
          UPDATE app_notifications
          SET read_status = TRUE
          WHERE id = $1
          RETURNING *
        `;
        const res = await pool.query(query, [id]);
        return res.rows[0];
      } else {
        const local = readLocalDB();
        const list = local.app_notifications || [];
        const index = list.findIndex((n: any) => n.id === id);
        if (index !== -1) {
          list[index].read_status = true;
          writeLocalDB(local);
          return list[index];
        }
        return null;
      }
    },

    async markAllAsRead(recruiterId: number) {
      if (isPostgres && pool) {
        const query = `
          UPDATE app_notifications
          SET read_status = TRUE
          WHERE recruiter_id = $1 OR recruiter_id IS NULL
        `;
        await pool.query(query, [recruiterId]);
        return true;
      } else {
        const local = readLocalDB();
        const list = local.app_notifications || [];
        list.forEach((n: any) => {
          if (n.recruiter_id === recruiterId || n.recruiter_id === null) {
            n.read_status = true;
          }
        });
        writeLocalDB(local);
        return true;
      }
    }
  },

  // 3. Document Management Service Repository
  documents: {
    async create(data: {
      name: string;
      type: string;
      file_size: string;
      folder?: string;
      uploaded_by: string;
      role_permissions?: string;
      content?: string;
      mime_type?: string;
      versions?: string;
    }) {
      const folder = data.folder || "Unsorted";
      const permissions = data.role_permissions || '["all"]';
      const versions = data.versions || '[]';
      const mime = data.mime_type || 'application/octet-stream';
      
      if (isPostgres && pool) {
        const query = `
          INSERT INTO documents (name, type, file_size, folder, uploaded_by, role_permissions, content, mime_type, versions)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `;
        const res = await pool.query(query, [
          data.name,
          data.type,
          data.file_size,
          folder,
          data.uploaded_by,
          permissions,
          data.content || "",
          mime,
          versions
        ]);
        return res.rows[0];
      } else {
        const local = readLocalDB();
        const newDoc = {
          id: (local.documents || []).length + 1,
          name: data.name,
          type: data.type,
          file_size: data.file_size,
          folder,
          uploaded_by: data.uploaded_by,
          uploaded_at: new Date().toISOString(),
          role_permissions: JSON.parse(permissions),
          content: data.content || "",
          mime_type: mime,
          versions: JSON.parse(versions)
        };
        if (!local.documents) local.documents = [];
        local.documents.push(newDoc);
        writeLocalDB(local);
        return newDoc;
      }
    },

    async listAll() {
      if (isPostgres && pool) {
        const query = `SELECT * FROM documents ORDER BY uploaded_at DESC`;
        const res = await pool.query(query);
        // Postgres returns versions and role_permissions as strings; parse them
        return res.rows.map((r: any) => ({
          ...r,
          role_permissions: typeof r.role_permissions === "string" ? JSON.parse(r.role_permissions) : r.role_permissions,
          versions: typeof r.versions === "string" ? JSON.parse(r.versions) : r.versions
        }));
      } else {
        const local = readLocalDB();
        return (local.documents || []).sort((a: any, b: any) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
      }
    },

    async findById(id: number) {
      if (isPostgres && pool) {
        const query = `SELECT * FROM documents WHERE id = $1`;
        const res = await pool.query(query, [id]);
        const r = res.rows[0];
        if (!r) return null;
        return {
          ...r,
          role_permissions: typeof r.role_permissions === "string" ? JSON.parse(r.role_permissions) : r.role_permissions,
          versions: typeof r.versions === "string" ? JSON.parse(r.versions) : r.versions
        };
      } else {
        const local = readLocalDB();
        const doc = (local.documents || []).find((d: any) => d.id === id);
        return doc || null;
      }
    },

    async update(id: number, data: { folder?: string; role_permissions?: string; name?: string; content?: string; file_size?: string; versions?: string }) {
      if (isPostgres && pool) {
        const fields: string[] = [];
        const params: any[] = [];
        let index = 1;
        
        if (data.folder !== undefined) {
          fields.push(`folder = $${index++}`);
          params.push(data.folder);
        }
        if (data.role_permissions !== undefined) {
          fields.push(`role_permissions = $${index++}`);
          params.push(data.role_permissions);
        }
        if (data.name !== undefined) {
          fields.push(`name = $${index++}`);
          params.push(data.name);
        }
        if (data.content !== undefined) {
          fields.push(`content = $${index++}`);
          params.push(data.content);
        }
        if (data.file_size !== undefined) {
          fields.push(`file_size = $${index++}`);
          params.push(data.file_size);
        }
        if (data.versions !== undefined) {
          fields.push(`versions = $${index++}`);
          params.push(data.versions);
        }
        
        if (fields.length === 0) return null;
        
        params.push(id);
        const query = `
          UPDATE documents
          SET ${fields.join(", ")}
          WHERE id = $${index}
          RETURNING *
        `;
        const res = await pool.query(query, params);
        const r = res.rows[0];
        if (!r) return null;
        return {
          ...r,
          role_permissions: typeof r.role_permissions === "string" ? JSON.parse(r.role_permissions) : r.role_permissions,
          versions: typeof r.versions === "string" ? JSON.parse(r.versions) : r.versions
        };
      } else {
        const local = readLocalDB();
        const list = local.documents || [];
        const idx = list.findIndex((d: any) => d.id === id);
        if (idx !== -1) {
          if (data.folder !== undefined) list[idx].folder = data.folder;
          if (data.role_permissions !== undefined) list[idx].role_permissions = JSON.parse(data.role_permissions);
          if (data.name !== undefined) list[idx].name = data.name;
          if (data.content !== undefined) list[idx].content = data.content;
          if (data.file_size !== undefined) list[idx].file_size = data.file_size;
          if (data.versions !== undefined) list[idx].versions = JSON.parse(data.versions);
          writeLocalDB(local);
          return list[idx];
        }
        return null;
      }
    },

    async delete(id: number) {
      if (isPostgres && pool) {
        const query = `DELETE FROM documents WHERE id = $1 RETURNING *`;
        const res = await pool.query(query, [id]);
        const r = res.rows[0];
        if (!r) return null;
        return {
          ...r,
          role_permissions: typeof r.role_permissions === "string" ? JSON.parse(r.role_permissions) : r.role_permissions,
          versions: typeof r.versions === "string" ? JSON.parse(r.versions) : r.versions
        };
      } else {
        const local = readLocalDB();
        const list = local.documents || [];
        const idx = list.findIndex((d: any) => d.id === id);
        if (idx !== -1) {
          const deleted = list.splice(idx, 1)[0];
          writeLocalDB(local);
          return deleted;
        }
        return null;
      }
    }
  }
};
