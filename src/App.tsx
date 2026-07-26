import { useState, useEffect } from "react";
import { Sparkles, Briefcase, Users, Bot, Settings2, LogOut, Award, ClipboardCheck, LayoutDashboard, ShieldAlert, Calendar, Bell, Folder, UserRoundSearch, CircleUserRound, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { Candidate, Job } from "./types";
import AuthScreen from "./components/AuthScreen";
import DashboardStats from "./components/DashboardStats";
import JobsSection from "./components/JobsSection";
import CandidateSection from "./components/CandidateSection";
import MatchDrawer from "./components/MatchDrawer";
import InterviewSuite from "./components/InterviewSuite";
import CopilotChat from "./components/CopilotChat";
import SettingsSection from "./components/SettingsSection";
import AdminPanel from "./components/AdminPanel";
import InterviewsSection from "./components/InterviewsSection";
import NotificationSection from "./components/NotificationSection";
import DocumentManagement from "./components/DocumentManagement";
import CommandPalette from "./components/CommandPalette";
import CareersPortal from "./components/CareersPortal";
// @ts-ignore
import talentsyncLogo from "./assets/images/talentsync_logo_1784467747926.jpg";

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("ts_token"));
  const [user, setUser] = useState<{ id: number; email: string; name: string; company: string; role?: string; status?: string } | null>(() => {
    const saved = localStorage.getItem("ts_user");
    return saved ? JSON.parse(saved) : null;
  });

  const theme = "dark";

  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute("data-theme", "dark");
    root.classList.add("dark");
    root.classList.remove("light");
    localStorage.setItem("ts_theme", "dark");
  }, []);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  
  const [activeView, setActiveView] = useState<"dashboard" | "jobs" | "candidates" | "copilot" | "interviews" | "settings" | "admin" | "notifications" | "documents" | "careers">("dashboard");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  
  // Drill-down details for a specific candidate
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [candidateDetailTab, setCandidateDetailTab] = useState<"match" | "interview">("match");

  const [loadingData, setLoadingData] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Command palette hotkey listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Synchronize state with LocalStorage for flawless reload persistence
  useEffect(() => {
    if (token) {
      localStorage.setItem("ts_token", token);
    } else {
      localStorage.removeItem("ts_token");
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("ts_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("ts_user");
    }
  }, [user]);

  // Fetch jobs and candidate pools
  const fetchData = async () => {
    if (!token) return;
    setLoadingData(true);
    try {
      // Fetch Jobs
      const jobsRes = await fetch("/api/jobs", {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (jobsRes.status === 401 || jobsRes.status === 403) {
        handleLogout();
        return;
      }

      let fetchedJobs: Job[] = [];

      if (jobsRes.ok) {
        const jobsContentType = jobsRes.headers.get("content-type");
        if (jobsContentType && jobsContentType.includes("application/json")) {
          const jobsData = await jobsRes.json().catch(() => null);
          fetchedJobs = jobsData?.jobs || [];
        } else {
          console.warn(`Non-JSON response from /api/jobs`);
        }
      } else {
        console.error(`Failed to fetch /api/jobs. Status: ${jobsRes.status}`);
      }

      setJobs(fetchedJobs);

      // Auto-select first active job if none selected yet for a smoother onboarding experience
      if (fetchedJobs.length > 0 && !selectedJob) {
        const activeOne = fetchedJobs.find((j: Job) => j.status === "active");
        if (activeOne) setSelectedJob(activeOne);
      }

      // Fetch Candidates
      const candsRes = await fetch("/api/candidates", {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (candsRes.status === 401 || candsRes.status === 403) {
        handleLogout();
        return;
      }

      let fetchedCands: Candidate[] = [];

      if (candsRes.ok) {
        const candsContentType = candsRes.headers.get("content-type");
        if (candsContentType && candsContentType.includes("application/json")) {
          const candsData = await candsRes.json().catch(() => null);
          fetchedCands = candsData?.candidates || [];
        } else {
          console.warn(`Non-JSON response from /api/candidates`);
        }
      } else {
        console.error(`Failed to fetch /api/candidates. Status: ${candsRes.status}`);
      }

      setCandidates(fetchedCands);

    } catch (err) {
      console.error("Error loading recruiter data pipeline:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const handleAuthSuccess = (newToken: string, newUser: any) => {
    setToken(newToken);
    setUser(newUser);
    setActiveView("dashboard");
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setJobs([]);
    setCandidates([]);
    setSelectedJob(null);
    setSelectedCandidate(null);
    localStorage.removeItem("ts_token");
    localStorage.removeItem("ts_user");
  };

  const [showCareers, setShowCareers] = useState(false);

  if (showCareers) {
    return <CareersPortal onBackToLogin={() => setShowCareers(false)} theme={theme} />;
  }

  if (!token) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} onEnterCareersPortal={() => setShowCareers(true)} />;
  }

  return (
    <div className="min-h-screen bg-[var(--apple-bg-canvas)] text-[var(--apple-text-primary)] transition-colors duration-350 flex flex-col selection:bg-indigo-500/30 overflow-x-hidden relative">
      {/* Aurora Ambient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[30%] -left-[20%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-tr from-blue-600/20 to-purple-600/10 blur-[130px] animate-blob-1" style={{ opacity: "var(--aurora-opacity)" }} />
        <div className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-indigo-600/20 to-cyan-600/10 blur-[120px] animate-blob-2" style={{ opacity: "var(--aurora-opacity)" }} />
        <div className="absolute top-[40%] left-[30%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-r from-purple-600/15 via-indigo-600/10 to-pink-600/10 blur-[140px] animate-blob-3" style={{ opacity: "var(--aurora-opacity)" }} />
        <div className="noise-overlay" style={{ opacity: "var(--noise-opacity)" }} />
        <div className="absolute inset-0 linear-grid" style={{ opacity: "var(--aurora-opacity)" }} />
      </div>

      {/* Main Layout Shell */}
      <div className="relative z-10 flex flex-1 w-full max-w-7xl mx-auto px-4 py-4 sm:py-6 lg:py-8 gap-6">
        
        {/* Floating Apple Sidebar (Desktop) */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 glass-panel rounded-2xl p-5 sticky top-8 h-[calc(100vh-4rem)]">
          {/* Logo brand */}
          <div className="flex items-center gap-3 mb-8 cursor-pointer group" onClick={() => { setActiveView("dashboard"); setSelectedCandidate(null); }}>
            <div className="p-0.5 bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden w-11 h-11 shrink-0 group-hover:bg-indigo-500/10 transition-all duration-300">
              <img
                src={talentsyncLogo}
                alt="TalentSync Logo"
                className="w-full h-full object-cover rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-sm font-bold text-neutral-900 dark:text-white tracking-wider font-sans">TALENTSYNC AI</h1>
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold tracking-widest uppercase">Enterprise</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
            {[
              { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
              { id: "jobs", label: "Job Positions", icon: Briefcase },
              { id: "candidates", label: "Applicant Pools", icon: UserRoundSearch },
              { id: "documents", label: "Document Hub", icon: Folder },
              { id: "copilot", label: "AI Copilot Chat", icon: Bot },
              { id: "interviews", label: "Interviews Suite", icon: Calendar },
              { id: "notifications", label: "Notifications Service", icon: Bell },
              { id: "careers", label: "Public Careers Board", icon: Sparkles },
              ...(user?.role === "admin" ? [{ id: "admin", label: "Admin Panel", icon: ShieldAlert }] : []),
              { id: "settings", label: "Diagnostics", icon: Settings2 },
            ].map((view) => {
              const Icon = view.icon;
              const isActive = activeView === view.id;
              return (
                <button
                  id={`nav-item-${view.id}`}
                  key={view.id}
                  onClick={() => {
                    setActiveView(view.id as any);
                    setSelectedCandidate(null);
                  }}
                  className="w-full relative group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-300 cursor-pointer text-left"
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-pill"
                      className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-indigo-600/10 border-l-2 border-blue-500 rounded-xl"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className={`h-4 w-4 shrink-0 transition-transform duration-300 group-hover:scale-110 z-10 ${isActive ? "text-blue-500 dark:text-blue-400" : "text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white"}`} />
                  <span className={`z-10 transition-colors duration-300 ${isActive ? "text-neutral-900 dark:text-white font-semibold" : "text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white"}`}>
                    {view.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* User profile & logout block */}
          <div className="border-t border-neutral-200 dark:border-white/5 pt-4 mt-auto space-y-3">
            <div className="flex items-center gap-3 px-2">
              <div className="p-1.5 bg-neutral-100 dark:bg-white/5 rounded-full border border-neutral-200 dark:border-white/10">
                <CircleUserRound className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate leading-tight">{user?.name}</span>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">{user?.company}</span>
              </div>
            </div>

            <button
              id="logout-btn"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-red-500/10 dark:bg-white/5 text-neutral-700 dark:text-neutral-300 hover:text-red-500 dark:hover:text-red-400 border border-neutral-200 dark:border-white/5 hover:border-red-500/20 transition-all duration-300 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log out session</span>
            </button>
          </div>
        </aside>

        {/* Content Shell */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* Glass Topbar */}
          <header className="glass-panel rounded-2xl p-4 mb-6 flex items-center justify-between gap-4 sticky top-4 z-40">
            <div className="flex items-center gap-2.5 lg:hidden">
              <div className="w-6 h-6 rounded-lg overflow-hidden border border-neutral-200 dark:border-white/10 shrink-0">
                <img
                  src={talentsyncLogo}
                  alt="TalentSync Logo"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="text-xs font-bold tracking-wider font-sans text-neutral-900 dark:text-white">TALENTSYNC AI</span>
            </div>

            {/* Live active monitor indicator */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-neutral-100 dark:bg-white/5 rounded-full border border-neutral-200 dark:border-white/5 text-[11px] text-neutral-700 dark:text-neutral-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-neutral-500 dark:text-neutral-400">Enterprise AI Engine:</span>
              <span className="font-medium text-neutral-900 dark:text-white">Active</span>
            </div>

            <div className="flex items-center gap-4">
              {/* Cmd+K Search trigger */}
              <button
                id="header-cmd-k-search"
                type="button"
                onClick={() => setIsCommandPaletteOpen(true)}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 rounded-xl border border-neutral-200 dark:border-white/5 transition-all cursor-pointer text-xs font-semibold"
              >
                <Search className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-450" />
                <span>Search Commands</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-white/10 border border-neutral-300 dark:border-white/5 text-[9px] font-mono text-neutral-700 dark:text-neutral-300 font-bold ml-1.5">
                  ⌘K
                </kbd>
              </button>

              {/* Profile sub details */}
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-neutral-900 dark:text-white leading-tight">{user?.name}</span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">{user?.company}</span>
              </div>

              {/* Log out on mobile */}
              <button
                onClick={handleLogout}
                className="lg:hidden p-2 hover:bg-white/5 rounded-xl text-neutral-400 hover:text-white transition cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Mobile Navigation Sticky Rail */}
          <div className="lg:hidden glass-panel rounded-2xl p-2 mb-6 flex overflow-x-auto gap-1.5 items-center justify-start sticky top-20 z-30 no-scrollbar">
            {[
              { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
              { id: "jobs", label: "Jobs", icon: Briefcase },
              { id: "candidates", label: "Candidates", icon: UserRoundSearch },
              { id: "documents", label: "Documents", icon: Folder },
              { id: "copilot", label: "AI Copilot", icon: Bot },
              { id: "interviews", label: "Interviews", icon: Calendar },
              { id: "notifications", label: "Notifications", icon: Bell },
              { id: "careers", label: "Careers Board", icon: Sparkles },
              ...(user?.role === "admin" ? [{ id: "admin", label: "Admin", icon: ShieldAlert }] : []),
              { id: "settings", label: "Diagnostics", icon: Settings2 },
            ].map((view) => {
              const isActive = activeView === view.id;
              return (
                <button
                  id={`nav-mob-${view.id}`}
                  key={view.id}
                  onClick={() => {
                    setActiveView(view.id as any);
                    setSelectedCandidate(null);
                  }}
                  className={`px-3 py-2 rounded-xl text-[10px] font-semibold tracking-tight whitespace-nowrap flex items-center gap-1.5 transition-all duration-300 ${
                    isActive
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-100/80 dark:bg-white/5 border border-neutral-200 dark:border-white/5"
                  }`}
                >
                  <view.icon className="w-3.5 h-3.5" />
                  <span>{view.label}</span>
                </button>
              );
            })}
          </div>

          {/* Main workspace frame */}
          <main className="flex-1">
            <AnimatePresence mode="wait">
              {selectedCandidate ? (
                /* DETAILED CANDIDATE SCREENING INSPECTION PAGE */
                <motion.div
                  key="candidate-detail-stage"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="space-y-6"
                >
                  {/* Profile subheader control */}
                  <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-extrabold text-white tracking-tight">{selectedCandidate.name}</h2>
                      <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1.5">
                        <span>Inspecting applicant for:</span>
                        <span className="font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">{selectedJob ? selectedJob.title : "Direct Sourcing"}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        id="cand-tab-match"
                        onClick={() => setCandidateDetailTab("match")}
                        className={`px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-2 transition-all duration-300 ${
                          candidateDetailTab === "match"
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                            : "bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/5"
                        }`}
                      >
                        <Award className="h-4 w-4" />
                        <span>AI Screening Report</span>
                      </button>

                      <button
                        id="cand-tab-interview"
                        onClick={() => setCandidateDetailTab("interview")}
                        className={`px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-2 transition-all duration-300 ${
                          candidateDetailTab === "interview"
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                            : "bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/5"
                        }`}
                      >
                        <ClipboardCheck className="h-4 w-4" />
                        <span>Interview Suite Planner</span>
                      </button>
                    </div>
                  </div>

                  {/* Sub-tab view toggle */}
                  {candidateDetailTab === "match" ? (
                    <MatchDrawer
                      candidate={selectedCandidate}
                      job={selectedJob || jobs.find((j) => j.id === selectedCandidate.job_id)!}
                      onBackToList={() => setSelectedCandidate(null)}
                    />
                  ) : (
                    <div className="space-y-6">
                      <button
                        id="back-to-report-tab-btn"
                        onClick={() => setCandidateDetailTab("match")}
                        className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer flex items-center gap-1 transition"
                      >
                        <span>←</span>
                        <span>View AI Fit Match Report</span>
                      </button>
                      <InterviewSuite
                        candidate={selectedCandidate}
                        job={selectedJob || jobs.find((j) => j.id === selectedCandidate.job_id)!}
                        token={token}
                      />
                    </div>
                  )}
                </motion.div>
              ) : (
                /* GENERAL NAVIGATION SECTIONS */
                <motion.div
                  key={activeView}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="space-y-6"
                >
                  {activeView === "dashboard" && (
                    <DashboardStats jobs={jobs} candidates={candidates} />
                  )}

                  {activeView === "jobs" && (
                    <JobsSection
                      jobs={jobs}
                      token={token}
                      onRefreshJobs={fetchData}
                      onSelectJob={setSelectedJob}
                      selectedJob={selectedJob}
                    />
                  )}

                  {activeView === "candidates" && (
                    <CandidateSection
                      candidates={candidates}
                      jobs={jobs}
                      selectedJob={selectedJob}
                      token={token}
                      onRefreshCandidates={fetchData}
                      onSelectCandidateForDetails={setSelectedCandidate}
                    />
                  )}

                  {activeView === "documents" && (
                    <DocumentManagement token={token} user={user} />
                  )}

                  {activeView === "copilot" && (
                    <div className="max-w-4xl mx-auto">
                      <div className="mb-6">
                        <h2 className="text-2xl font-bold text-white tracking-tight font-sans text-gradient-apple">AI Recruitment Copilot</h2>
                        <p className="text-xs text-neutral-400 mt-1">Ask questions, match developer skills, and summarize profiles instantly.</p>
                      </div>
                      <CopilotChat token={token} />
                    </div>
                  )}

                  {activeView === "interviews" && (
                    <InterviewsSection jobs={jobs} candidates={candidates} token={token} />
                  )}

                  {activeView === "notifications" && (
                    <NotificationSection jobs={jobs} candidates={candidates} token={token} />
                  )}

                  {activeView === "settings" && (
                    <SettingsSection user={user} />
                  )}

                  {activeView === "careers" && (
                    <CareersPortal
                      onBackToLogin={() => setActiveView("dashboard")}
                      theme="dark"
                      recruiterMode={true}
                    />
                  )}

                  {activeView === "admin" && user?.role === "admin" && (
                    <AdminPanel token={token} onLogout={handleLogout} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Persistent platform footer */}
          <footer className="mt-12 pt-6 border-t border-white/5 text-center text-neutral-500 text-[10px] font-mono flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>TALENTSYNC AI • SECURE RECRUITER GATEWAY</span>
            <span>© 2026 • Enterprise Cloud Native Architecture</span>
          </footer>
        </div>

      </div>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        candidates={candidates}
        onNavigate={(view) => setActiveView(view)}
        onSelectCandidate={(candidate) => setSelectedCandidate(candidate)}
      />
    </div>
  );
}
