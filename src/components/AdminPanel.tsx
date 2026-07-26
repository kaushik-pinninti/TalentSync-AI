import React, { useState, useEffect } from "react";
import { 
  Users, Briefcase, Bot, Shield, ShieldAlert, CheckCircle, AlertTriangle, 
  Search, RefreshCw, Trash2, Edit3, UserPlus, Save, Sliders, ListFilter, 
  Cpu, Database, Clock, HardDrive, DollarSign, PieChart, TrendingUp, Key, Lock, Mail, Building2, Award, Loader2, ArrowRight, Server, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AdminPanelProps {
  token: string;
  onLogout: () => void;
}

interface Recruiter {
  id: number;
  email: string;
  name: string;
  company: string;
  role: string;
  status: string;
  created_at: string;
  jobs_count: number;
  candidates_count: number;
}

interface AuditLog {
  id: number;
  user_id: number | null;
  user_email: string | null;
  action: string;
  details: string;
  ip_address: string | null;
  created_at: string;
}

interface AdminSettings {
  modelSelection: string;
  maintenanceMode: string;
  candidateRateLimit: string;
  aiRecruiterCopilot: string;
  allowedDomains: string;
  requireEmailVerification: string;
}

export default function AdminPanel({ token, onLogout }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "recruiters" | "audit" | "settings">("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // States for stats and data
  const [stats, setStats] = useState<any>(null);
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<AdminSettings>({
    modelSelection: "gemini-2.5-flash",
    maintenanceMode: "false",
    candidateRateLimit: "50",
    aiRecruiterCopilot: "true",
    allowedDomains: "*",
    requireEmailVerification: "false"
  });

  // Modal / Form States
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Recruiter | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // New Recruiter Form State
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formRole, setFormRole] = useState("recruiter");
  const [formStatus, setFormStatus] = useState("active");

  // Filter / Search States
  const [recruiterSearch, setRecruiterSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("all");

  // Chart Tooltips State
  const [activeMonthIdx, setActiveMonthIdx] = useState<number | null>(null);
  const [activeSliceIdx, setActiveSliceIdx] = useState<number | null>(null);

  useEffect(() => {
    fetchAdminData();
  }, [activeTab]);

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "dashboard") {
        const res = await fetch("/api/admin/stats", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setStats(data.stats);
        } else {
          setError(data.error || "Failed to fetch admin stats");
        }
      } else if (activeTab === "recruiters") {
        const res = await fetch("/api/admin/recruiters", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setRecruiters(data.recruiters || []);
        } else {
          setError(data.error || "Failed to fetch recruiter profiles");
        }
      } else if (activeTab === "audit") {
        const res = await fetch("/api/admin/audit-logs", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setAuditLogs(data.logs || []);
        } else {
          setError(data.error || "Failed to fetch audit records");
        }
      } else if (activeTab === "settings") {
        const res = await fetch("/api/admin/settings", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setSettings(data.settings);
        } else {
          setError(data.error || "Failed to fetch global settings");
        }
      }
    } catch (err: any) {
      console.error(err);
      setError("Network error connecting to administrative service");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const payload: any = {
      name: formName,
      email: formEmail,
      company: formCompany,
      role: formRole,
      status: formStatus
    };

    if (formPassword) {
      payload.password = formPassword;
    }

    try {
      let res;
      if (editingUser) {
        res = await fetch(`/api/admin/recruiters/${editingUser.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      } else {
        if (!formPassword) {
          setError("Password is required for new accounts");
          return;
        }
        res = await fetch("/api/admin/recruiters", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(editingUser ? "User updated successfully." : "User created successfully.");
        setUserModalOpen(false);
        resetUserForm();
        fetchAdminData();
      } else {
        setError(data.error || "Failed to save user details.");
      }
    } catch (err) {
      setError("Failed to execute database write operation.");
    }
  };

  const handleDeleteUser = async (id: number) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/recruiters/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Recruiter account and assets purged successfully.");
        setDeleteConfirmId(null);
        fetchAdminData();
      } else {
        setError(data.error || "Failed to delete account.");
      }
    } catch (err) {
      setError("Failed to execute account delete operation.");
    }
  };

  const handleQuickStatusToggle = async (user: Recruiter) => {
    setError(null);
    setSuccessMsg(null);
    const nextStatus = user.status === "active" ? "suspended" : "active";
    try {
      const res = await fetch(`/api/admin/recruiters/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Recruiter "${user.name}" status set to: ${nextStatus}`);
        fetchAdminData();
      } else {
        setError(data.error || "Failed to modify account status.");
      }
    } catch (err) {
      setError("Failed to execute status change.");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Global system parameters saved and pushed to production.");
      } else {
        setError(data.error || "Failed to save system configurations.");
      }
    } catch (err) {
      setError("Failed to sync settings with Cloud store.");
    }
  };

  const openEditModal = (user: Recruiter) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormCompany(user.company);
    setFormRole(user.role);
    setFormStatus(user.status);
    setFormPassword(""); // Don't prefill password
    setUserModalOpen(true);
  };

  const resetUserForm = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormCompany("");
    setFormRole("recruiter");
    setFormStatus("active");
  };

  // Human-friendly uptime formatter
  const formatUptime = (totalSeconds: number) => {
    if (!totalSeconds) return "N/A";
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return parts.join(" ");
  };

  // Human-friendly date formatter
  const formatTimeAgo = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
      if (seconds < 60) return "Just now";
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "N/A";
    }
  };

  // Filtering Logic
  const filteredRecruiters = recruiters.filter(r => {
    const term = recruiterSearch.toLowerCase();
    return r.name.toLowerCase().includes(term) || 
           r.email.toLowerCase().includes(term) || 
           r.company.toLowerCase().includes(term);
  });

  const filteredAuditLogs = auditLogs.filter(log => {
    const term = auditSearch.toLowerCase();
    const matchesSearch = 
      (log.user_email || "").toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      log.details.toLowerCase().includes(term) ||
      (log.ip_address || "").includes(term);
    
    if (auditActionFilter === "all") return matchesSearch;
    return matchesSearch && log.action === auditActionFilter;
  });

  return (
    <div className="space-y-6" id="admin-panel-viewport">
      {/* Admin Panel Header Banner */}
      <div className="glass-panel p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3 bg-white/5 border border-white/10 text-white rounded-2xl">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight font-sans text-white">Platform Control Center</h1>
            <p className="text-neutral-450 text-xs mt-1">SaaS System Administrator Dashboard & Enterprise Governance Panel</p>
          </div>
        </div>

        {/* Administration Navigation Tabs */}
        <div className="bg-white/5 p-1 rounded-full border border-white/10 flex flex-wrap gap-1 relative z-10">
          {[
            { id: "dashboard", label: "Stats & Telemetry", icon: Cpu },
            { id: "recruiters", label: "Recruiter Accounts", icon: Users },
            { id: "audit", label: "Security Logs", icon: ShieldAlert },
            { id: "settings", label: "System Parameters", icon: Sliders }
          ].map((tab) => {
            const Icon = tab.icon;
            const isTabActive = activeTab === tab.id;
            return (
              <button
                id={`admin-tab-btn-${tab.id}`}
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition duration-300 cursor-pointer ${
                  isTabActive 
                    ? "bg-white/10 text-white shadow-md border border-white/15" 
                    : "text-neutral-450 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Operation Alert Notification Panel */}
      <AnimatePresence mode="wait">
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/25 text-emerald-450 rounded-xl flex items-center gap-2 text-xs font-semibold"
          >
            <CheckCircle className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
            <button className="ml-auto text-emerald-400 hover:text-white font-extrabold cursor-pointer" onClick={() => setSuccessMsg(null)}>×</button>
          </motion.div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-xl flex items-center gap-2 text-xs font-semibold"
          >
            <AlertTriangle className="h-4.5 w-4.5 text-rose-450 shrink-0" />
            <span>{error}</span>
            <button className="ml-auto text-rose-400 hover:text-white font-extrabold cursor-pointer" onClick={() => setError(null)}>×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container Stage */}
      {loading ? (
        <div className="glass-panel rounded-2xl p-20 text-center space-y-4 shadow-2xl flex flex-col items-center justify-center border border-white/10">
          <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
          <p className="text-neutral-400 text-xs font-semibold">Synchronizing Cloud database telemetry streams...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {/* TAB 1: OVERVIEW DASHBOARD */}
          {activeTab === "dashboard" && stats && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              {/* Stat Bento Grid Card Widgets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { id: "recruiters-card", title: "Recruiter Accounts", val: stats.totalRecruiters, desc: `${stats.activeUsers} active profiles`, icon: Users, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
                  { id: "candidates-card", title: "Screened Applicants", val: stats.totalCandidates, desc: "Total candidate records", icon: Award, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
                  { id: "jobs-card", title: "Job Openings", val: stats.totalJobs, desc: "Active requisitions", icon: Briefcase, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" },
                  { id: "ai-card", title: "AI Requests Today", val: stats.aiRequestsToday, desc: "Gemini parsing pipeline", icon: Bot, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
                  { id: "rev-card", title: "MRR Projected", val: `$${stats.revenueDashboard?.monthlyRecurringRevenue || 0}`, desc: `${stats.revenueDashboard?.subscribersCount || 0} active subscribers`, icon: DollarSign, color: "text-rose-400 bg-rose-500/10 border-rose-500/20" }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div id={`stat-${item.id}`} key={item.title} className="glass-panel p-5 rounded-2xl border border-white/10 shadow-lg flex flex-col justify-between hover:border-white/15 transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-extrabold text-neutral-450 tracking-wider font-mono">{item.title}</span>
                        <div className={`p-2 rounded-xl border ${item.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="mt-4">
                        <h2 className="text-2xl font-black text-white tracking-tight">{item.val}</h2>
                        <p className="text-[10px] text-neutral-400 font-semibold mt-1">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Graphical Area & Pie Interactive Visualizers */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Handcrafted Animated Premium SVG Area Chart for MRR */}
                <div className="glass-panel rounded-2xl p-5 shadow-2xl border border-white/10 lg:col-span-2 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
                  <div className="flex items-center justify-between mb-6 relative z-10">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                        <span>Monthly Revenue Growth (ARR / MRR)</span>
                      </h3>
                      <p className="text-[10px] text-neutral-450 mt-0.5">Projected billing performance based on active recruiter subscriptions</p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 font-mono">ARR: $70,800</span>
                  </div>

                  {/* Responsive Custom Area Chart */}
                  <div className="relative h-48 w-full mt-2 z-10">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {/* Grid Lines */}
                      <line x1="0" y1="120" x2="500" y2="120" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                      <line x1="0" y1="80" x2="500" y2="80" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                      <line x1="0" y1="40" x2="500" y2="40" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                      
                      {/* Interactive Areas/Path for revenue data */}
                      <path 
                        d="M 0,150 L 0,116 M 0,116 L 100,102 M 100,102 L 200,98 M 200,98 L 300,94 M 300,94 L 400,88 M 400,88 L 500,82 L 500,150 Z" 
                        fill="url(#area-gradient)" 
                      />
                      <path 
                        d="M 0,116 L 100,102 L 200,98 L 300,94 L 400,88 L 500,82" 
                        fill="none" 
                        stroke="#10B981" 
                        strokeWidth="3.5" 
                        strokeLinecap="round"
                      />

                      {/* Interactive Hover Dots */}
                      {[
                        { x: 0, y: 116, val: "$4,200", m: "Jan" },
                        { x: 100, y: 102, val: "$4,900", m: "Feb" },
                        { x: 200, y: 98, val: "$5,100", m: "Mar" },
                        { x: 300, y: 94, val: "$5,300", m: "Apr" },
                        { x: 400, y: 88, val: "$5,600", m: "May" },
                        { x: 500, y: 82, val: "$5,900", m: "Jun" }
                      ].map((dot, idx) => (
                        <g key={idx}>
                          <circle 
                            cx={dot.x} 
                            cy={dot.y} 
                            r={activeMonthIdx === idx ? "7" : "5"} 
                            fill={activeMonthIdx === idx ? "#10B981" : "#047857"} 
                            stroke="#ffffff" 
                            strokeWidth="2.5"
                            className="cursor-pointer transition-all duration-150"
                            onMouseEnter={() => setActiveMonthIdx(idx)}
                            onMouseLeave={() => setActiveMonthIdx(null)}
                          />
                        </g>
                      ))}
                    </svg>

                    {/* Interactive Monthly Tooltip Overlay */}
                    {activeMonthIdx !== null && (
                      <div 
                        className="absolute bg-neutral-900 border border-white/10 rounded-xl p-2.5 text-xs font-bold shadow-2xl pointer-events-none transition-all z-20"
                        style={{
                          left: `${(activeMonthIdx * 20) + 1}%`,
                          top: `${40 - (activeMonthIdx * 2)}px`,
                          transform: "translateX(-50%)"
                        }}
                      >
                        <div className="font-extrabold text-emerald-400">{["Jan", "Feb", "Mar", "Apr", "May", "Jun"][activeMonthIdx]}</div>
                        <div className="text-white text-[11px] mt-0.5">MRR: {["$4,200", "$4,900", "$5,100", "$5,300", "$5,600", "$5,900"][activeMonthIdx]}</div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-extrabold text-neutral-450 uppercase mt-4 px-1 font-mono">
                    <span>Jan</span>
                    <span>Feb</span>
                    <span>Mar</span>
                    <span>Apr</span>
                    <span>May</span>
                    <span>Jun</span>
                  </div>
                </div>

                {/* Donut Chart for Recruiter Tiers Distribution */}
                <div className="glass-panel rounded-2xl p-5 shadow-2xl border border-white/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
                  <div className="mb-4 relative z-10">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <PieChart className="h-4 w-4 text-indigo-400" />
                      <span>Subscriber Distribution</span>
                    </h3>
                    <p className="text-[10px] text-neutral-450 mt-0.5">Recruiter tiered SaaS subscriptions</p>
                  </div>

                  <div className="relative flex justify-center items-center h-40 z-10">
                    <svg className="w-32 h-32 transform -rotate-90 overflow-visible">
                      {/* Premium SVG Slices with percentages based on 100 stroke-dasharray */}
                      {/* Starter Tier 40% (Dash: 40, Gap: 60) */}
                      <circle 
                        cx="64" 
                        cy="64" 
                        r="45" 
                        fill="transparent" 
                        stroke="#3B82F6" 
                        strokeWidth="14" 
                        strokeDasharray="40 100" 
                        strokeDashoffset="0"
                        className="cursor-pointer hover:stroke-blue-400 transition-all duration-300"
                        onMouseEnter={() => setActiveSliceIdx(0)}
                        onMouseLeave={() => setActiveSliceIdx(null)}
                      />
                      {/* Growth Tier 50% (Dash: 50, Gap: 50) */}
                      <circle 
                        cx="64" 
                        cy="64" 
                        r="45" 
                        fill="transparent" 
                        stroke="#10B981" 
                        strokeWidth="14" 
                        strokeDasharray="50 100" 
                        strokeDashoffset="-40"
                        className="cursor-pointer hover:stroke-emerald-400 transition-all duration-300"
                        onMouseEnter={() => setActiveSliceIdx(1)}
                        onMouseLeave={() => setActiveSliceIdx(null)}
                      />
                      {/* Enterprise Custom 10% (Dash: 10, Gap: 90) */}
                      <circle 
                        cx="64" 
                        cy="64" 
                        r="45" 
                        fill="transparent" 
                        stroke="#8B5CF6" 
                        strokeWidth="14" 
                        strokeDasharray="10 100" 
                        strokeDashoffset="-90"
                        className="cursor-pointer hover:stroke-violet-400 transition-all duration-300"
                        onMouseEnter={() => setActiveSliceIdx(2)}
                        onMouseLeave={() => setActiveSliceIdx(null)}
                      />
                    </svg>

                    <div className="absolute text-center">
                      <p className="text-sm font-black text-white tracking-tight">
                        {activeSliceIdx === 0 ? "40%" : activeSliceIdx === 1 ? "50%" : activeSliceIdx === 2 ? "10%" : "MRR"}
                      </p>
                      <p className="text-[9px] text-neutral-400 font-extrabold uppercase tracking-wider font-mono">
                        {activeSliceIdx === 0 ? "Starter" : activeSliceIdx === 1 ? "Growth" : activeSliceIdx === 2 ? "Enterprise" : "Tiers"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mt-2 relative z-10">
                    {[
                      { name: "Starter Tier", color: "bg-blue-500", desc: "40% representation" },
                      { name: "Growth Premium", color: "bg-emerald-500", desc: "50% representation" },
                      { name: "Enterprise Custom", color: "bg-purple-500", desc: "10% representation" }
                    ].map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${item.color}`} />
                          <span className="font-bold text-neutral-300">{item.name}</span>
                        </div>
                        <span className="text-neutral-450 font-semibold font-mono">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Database & Node System Infrastructure Telemetry */}
              <div className="glass-panel rounded-2xl p-5 shadow-2xl border border-white/10 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/5 gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Database className="h-4 w-4 text-indigo-400" />
                      <span>Database Engine & Infrastructure Telemetry</span>
                    </h3>
                    <p className="text-[10px] text-neutral-450 mt-0.5">Live visualization layer and background system diagnostics</p>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 font-bold self-start sm:self-auto flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>System Operational</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* DB ENGINE */}
                  <div className="p-3.5 bg-white/3 rounded-xl border border-white/5 space-y-1">
                    <span className="text-[9px] font-extrabold text-neutral-450 uppercase tracking-wider block font-mono">Database Core</span>
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5 text-indigo-400" />
                      <span>{stats.databaseEngine || "SQLite Embedded"}</span>
                    </p>
                    <span className="text-[9px] text-neutral-450 block font-medium">Secured connection pool</span>
                  </div>

                  {/* CPU INFRA */}
                  <div className="p-3.5 bg-white/3 rounded-xl border border-white/5 space-y-1">
                    <span className="text-[9px] font-extrabold text-neutral-450 uppercase tracking-wider block font-mono">Container CPU Cores</span>
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5 text-blue-400" />
                      <span>{stats.systemHealth?.cpuCores || 1} vCPU Dedicated</span>
                    </p>
                    <span className="text-[9px] text-neutral-450 block font-medium">Auto-scaling execution node</span>
                  </div>

                  {/* SYSTEM MEMORY */}
                  <div className="p-3.5 bg-white/3 rounded-xl border border-white/5 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-extrabold text-neutral-450 uppercase tracking-wider font-mono">Memory Allocation</span>
                      <span className="text-[10px] font-mono font-bold text-white">{stats.systemHealth?.memoryUsagePct || 0}%</span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all" 
                        style={{ width: `${stats.systemHealth?.memoryUsagePct || 35}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-neutral-450 block font-mono">RAM limit configured</span>
                  </div>

                  {/* CONTAINER UPTIME */}
                  <div className="p-3.5 bg-white/3 rounded-xl border border-white/5 space-y-1">
                    <span className="text-[9px] font-extrabold text-neutral-450 uppercase tracking-wider block font-mono">Container Uptime</span>
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-emerald-400" />
                      <span>{formatUptime(stats.systemHealth?.uptimeSeconds)}</span>
                    </p>
                    <span className="text-[9px] text-neutral-450 block font-medium">Operational without interruption</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: RECRUITER / USER MANAGEMENT */}
          {activeTab === "recruiters" && (
            <motion.div 
              key="recruiters"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              {/* Toolbar Actions */}
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white/2 p-4 border border-white/10 rounded-2xl">
                {/* Search input */}
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-450" />
                  <input
                    id="recruiter-search-input"
                    type="text"
                    value={recruiterSearch}
                    onChange={(e) => setRecruiterSearch(e.target.value)}
                    placeholder="Search administrators or recruiters..."
                    className="w-full pl-10 pr-4 py-2 bg-white/5 hover:bg-white/10 focus:bg-[#09090b]/60 text-xs border border-white/10 focus:border-indigo-500 rounded-xl focus:outline-none transition-all text-white placeholder-neutral-500 font-semibold"
                  />
                </div>

                {/* Add User trigger */}
                <button
                  id="admin-add-recruiter-btn"
                  onClick={() => { resetUserForm(); setUserModalOpen(true); }}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/15 whitespace-nowrap"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Provision Account</span>
                </button>
              </div>

              {/* Accounts Database Table */}
              <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-neutral-200 border-collapse">
                    <thead>
                      <tr className="bg-white/2 border-b border-white/10 text-[10px] font-bold text-neutral-450 uppercase tracking-wider">
                        <th className="px-5 py-3">Account Identity</th>
                        <th className="px-5 py-3">Organization</th>
                        <th className="px-5 py-3">Role</th>
                        <th className="px-5 py-3">Asset Count</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Administrative Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs font-semibold">
                      {filteredRecruiters.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-neutral-400 font-sans italic">
                            No account registrations found matching the specified search parameters.
                          </td>
                        </tr>
                      ) : (
                        filteredRecruiters.map((user) => (
                          <tr key={user.id} className="hover:bg-white/2 transition">
                            {/* IDENTITY */}
                            <td className="px-5 py-4">
                              <div className="font-bold text-white text-sm">{user.name}</div>
                              <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{user.email}</div>
                              <div className="text-[9px] text-neutral-500 font-mono mt-0.5">Registered: {new Date(user.created_at).toLocaleDateString()}</div>
                            </td>

                            {/* ORGANIZATION */}
                            <td className="px-5 py-4 text-neutral-300">
                              <span className="font-bold">{user.company}</span>
                            </td>

                            {/* ROLE */}
                            <td className="px-5 py-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-mono border ${
                                user.role === "admin" 
                                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                                  : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                              }`}>
                                {user.role}
                              </span>
                            </td>

                            {/* ASSET COUNT */}
                            <td className="px-5 py-4">
                              <div className="space-y-0.5 text-[10px] text-neutral-400 font-mono">
                                <div>Jobs: <b className="text-white font-bold">{user.jobs_count || 0}</b></div>
                                <div>Applicants: <b className="text-white font-bold">{user.candidates_count || 0}</b></div>
                              </div>
                            </td>

                            {/* STATUS */}
                            <td className="px-5 py-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase inline-flex items-center gap-1.5 border ${
                                user.status === "active"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${user.status === "active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                                <span>{user.status}</span>
                              </span>
                            </td>

                            {/* ACTIONS */}
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Suspend/Unsuspend trigger */}
                                <button
                                  onClick={() => handleQuickStatusToggle(user)}
                                  className={`px-2.5 py-1 text-[10px] font-bold rounded-xl border transition-all cursor-pointer ${
                                    user.status === "active"
                                      ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20"
                                      : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
                                  }`}
                                  title={user.status === "active" ? "Suspend Account" : "Activate Account"}
                                >
                                  {user.status === "active" ? "Suspend" : "Activate"}
                                </button>

                                {/* Edit trigger */}
                                <button
                                  onClick={() => openEditModal(user)}
                                  className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-neutral-300 hover:text-white transition cursor-pointer"
                                  title="Edit Credentials"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>

                                {/* Delete trigger */}
                                <button
                                  onClick={() => setDeleteConfirmId(user.id)}
                                  className="p-1.5 bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/20 rounded-xl text-neutral-400 hover:text-rose-400 transition cursor-pointer"
                                  title="Delete Account"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: AUDIT / ACTIVITY LOGS */}
          {activeTab === "audit" && (
            <motion.div 
              key="audit"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              {/* Audit Toolbar Filters */}
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white/2 p-4 border border-white/10 rounded-2xl">
                {/* Search */}
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-450" />
                  <input
                    id="audit-search-input"
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Search logs by action, message detail, or IP..."
                    className="w-full pl-10 pr-4 py-2 bg-white/5 hover:bg-white/10 focus:bg-[#09090b]/60 text-xs border border-white/10 focus:border-indigo-500 rounded-xl focus:outline-none transition text-white placeholder-neutral-500 font-semibold"
                  />
                </div>

                {/* Filter Selector */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <ListFilter className="h-4 w-4 text-neutral-450 shrink-0" />
                  <select
                    id="audit-action-select"
                    value={auditActionFilter}
                    onChange={(e) => setAuditActionFilter(e.target.value)}
                    className="bg-white/5 hover:bg-white/10 text-xs border border-white/10 rounded-xl px-3 py-2 text-white font-bold w-full sm:w-56 focus:bg-[#09090b]/60 focus:outline-none cursor-pointer"
                  >
                    <option value="all" className="bg-[#09090b] text-white font-bold">All Category Events</option>
                    <option value="USER_LOGIN" className="bg-[#09090b] text-white">User Logins (USER_LOGIN)</option>
                    <option value="USER_SIGNUP" className="bg-[#09090b] text-white">New Account Signups (USER_SIGNUP)</option>
                    <option value="JOB_CREATE" className="bg-[#09090b] text-white">Job Listing Created (JOB_CREATE)</option>
                    <option value="AI_RESUME_PARSE" className="bg-[#09090b] text-white">AI Resume Parsings (AI_RESUME_PARSE)</option>
                    <option value="AI_CANDIDATE_MATCH" className="bg-[#09090b] text-white">AI Fit Screening Matches (AI_CANDIDATE_MATCH)</option>
                    <option value="ADMIN_UPDATE_SETTINGS" className="bg-[#09090b] text-white">System Configuration Saves</option>
                    <option value="LOGIN_BLOCKED" className="bg-[#09090b] text-white">Suspended Account Blocks</option>
                  </select>
                </div>
              </div>

              {/* Audit Log Timeline Table */}
              <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-neutral-200 border-collapse">
                    <thead>
                      <tr className="bg-white/2 border-b border-white/10 text-[10px] font-bold text-neutral-450 uppercase tracking-wider">
                        <th className="px-5 py-3 w-40">Time & Timestamp</th>
                        <th className="px-5 py-3 w-48">Recruiter Email</th>
                        <th className="px-5 py-3 w-44">Action Category</th>
                        <th className="px-5 py-3">Description / Event Details</th>
                        <th className="px-5 py-3 w-32 text-right">Access IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs font-semibold">
                      {filteredAuditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-12 text-center text-neutral-400 font-sans italic">
                            No security audit matches found in system timeline history logs.
                          </td>
                        </tr>
                      ) : (
                        filteredAuditLogs.map((log) => {
                          // Action color matching engine
                          let actionColor = "bg-white/5 text-neutral-300 border-white/10";
                          if (log.action === "USER_LOGIN") actionColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                          else if (log.action === "USER_SIGNUP") actionColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                          else if (log.action === "AI_RESUME_PARSE") actionColor = "bg-purple-500/10 text-purple-400 border-purple-500/20";
                          else if (log.action === "AI_CANDIDATE_MATCH") actionColor = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
                          else if (log.action.startsWith("ADMIN_")) actionColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                          else if (log.action === "LOGIN_BLOCKED") actionColor = "bg-rose-500/10 text-rose-400 border-rose-500/20";

                          return (
                            <tr key={log.id} className="hover:bg-white/2 transition">
                              {/* TIMESTAMP */}
                              <td className="px-5 py-3 text-neutral-400 whitespace-nowrap">
                                <div className="font-bold text-neutral-300">{formatTimeAgo(log.created_at)}</div>
                                <div className="text-[9px] text-neutral-500 mt-0.5 font-mono">{new Date(log.created_at).toLocaleTimeString()}</div>
                              </td>

                              {/* RECRUITER */}
                              <td className="px-5 py-3 text-white font-bold truncate max-w-[190px]">
                                <span>{log.user_email || "System-wide Automated"}</span>
                              </td>

                              {/* ACTION TAG */}
                              <td className="px-5 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-mono border ${actionColor}`}>
                                  {log.action}
                                </span>
                              </td>

                              {/* DETAILS */}
                              <td className="px-5 py-3 text-neutral-300 font-normal">
                                <span className="leading-relaxed font-medium">{log.details}</span>
                              </td>

                              {/* IP ADDRESS */}
                              <td className="px-5 py-3 text-right font-mono text-[10px] text-neutral-400 whitespace-nowrap">
                                <span className="bg-[#09090b]/60 px-2 py-0.5 rounded-lg border border-white/5 text-neutral-400 font-extrabold">
                                  {log.ip_address || "Internal"}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: SYSTEM GLOBAL SETTINGS */}
          {activeTab === "settings" && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="max-w-3xl mx-auto"
            >
              <form onSubmit={handleSaveSettings} className="glass-panel border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6">
                <div className="border-b border-white/5 pb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-indigo-400" />
                    <span>Global Platform Configuration Parameters</span>
                  </h3>
                  <p className="text-xs text-neutral-450 mt-1">Control live screening thresholds, operational Gemini models, and platform safety settings.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* MODEL SELECTION */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-extrabold text-neutral-400 flex items-center gap-1 font-mono">
                      <Bot className="h-3 w-3" />
                      <span>Operational AI Model Engine</span>
                    </label>
                    <select
                      id="setting-model-select"
                      value={settings.modelSelection}
                      onChange={(e) => setSettings({ ...settings, modelSelection: e.target.value })}
                      className="w-full text-xs bg-white/5 border border-white/10 rounded-xl p-2.5 font-bold text-white focus:bg-[#09090b]/60 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="gemini-2.5-flash" className="bg-[#09090b] text-white">Gemini 2.5 Flash (Ultralight, instant matching)</option>
                      <option value="gemini-2.5-pro" className="bg-[#09090b] text-white">Gemini 2.5 Pro (Extreme reasoning, heavy profiles)</option>
                    </select>
                    <span className="text-[10px] text-neutral-450 block">Directly configures the server-side Gemini client model parameter.</span>
                  </div>

                  {/* RATE LIMIT */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-extrabold text-neutral-400 flex items-center gap-1 font-mono">
                      <HardDrive className="h-3 w-3" />
                      <span>Daily Applicant Upload Threshold</span>
                    </label>
                    <input
                      id="setting-ratelimit-input"
                      type="number"
                      value={settings.candidateRateLimit}
                      onChange={(e) => setSettings({ ...settings, candidateRateLimit: e.target.value })}
                      className="w-full text-xs bg-white/5 border border-white/10 rounded-xl p-2.5 font-extrabold text-white focus:bg-[#09090b]/60 focus:outline-none focus:border-indigo-500"
                      placeholder="50"
                      min="5"
                      max="1000"
                    />
                    <span className="text-[10px] text-neutral-450 block">Maximum resume parsing pipeline requests allowed per day.</span>
                  </div>

                  {/* ALLOWED DOMAINS */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-extrabold text-neutral-400 flex items-center gap-1 font-mono">
                      <Building2 className="h-3 w-3" />
                      <span>SaaS Domain Access Lock</span>
                    </label>
                    <input
                      id="setting-domains-input"
                      type="text"
                      value={settings.allowedDomains}
                      onChange={(e) => setSettings({ ...settings, allowedDomains: e.target.value })}
                      className="w-full text-xs bg-white/5 border border-white/10 rounded-xl p-2.5 font-semibold text-white focus:bg-[#09090b]/60 focus:outline-none focus:border-indigo-500 placeholder-neutral-500"
                      placeholder="*"
                    />
                    <span className="text-[10px] text-neutral-450 block">Restricts signup access to specific domains (e.g. `*` or `intel.com, google.com`).</span>
                  </div>

                  {/* COPILOT ENABLED */}
                  <div className="space-y-3 p-3.5 bg-white/3 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-neutral-400 font-mono">Recruiter Copilot Chat</span>
                      <input
                        id="setting-copilot-checkbox"
                        type="checkbox"
                        checked={settings.aiRecruiterCopilot === "true"}
                        onChange={(e) => setSettings({ ...settings, aiRecruiterCopilot: e.target.checked ? "true" : "false" })}
                        className="w-4 h-4 text-indigo-600 bg-white/5 border-white/10 rounded-md focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>
                    <span className="text-[10px] text-neutral-450 block leading-normal">Allows recruiters to query the conversational grounding database using natural language copilot.</span>
                  </div>

                  {/* EMAIL VERIFICATION REQUIRED */}
                  <div className="space-y-3 p-3.5 bg-white/3 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-neutral-400 font-mono">Enforce Email Check</span>
                      <input
                        id="setting-email-checkbox"
                        type="checkbox"
                        checked={settings.requireEmailVerification === "true"}
                        onChange={(e) => setSettings({ ...settings, requireEmailVerification: e.target.checked ? "true" : "false" })}
                        className="w-4 h-4 text-indigo-600 bg-white/5 border-white/10 rounded-md focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>
                    <span className="text-[10px] text-neutral-450 block leading-normal">Requires users to verify their registration email addresses before listing jobs.</span>
                  </div>

                  {/* MAINTENANCE MODE */}
                  <div className="space-y-3 p-3.5 bg-rose-500/5 rounded-xl border border-rose-500/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-rose-400 font-mono">Maintenance Lockout Mode</span>
                      <input
                        id="setting-maint-checkbox"
                        type="checkbox"
                        checked={settings.maintenanceMode === "true"}
                        onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked ? "true" : "false" })}
                        className="w-4 h-4 text-rose-600 bg-white/5 border-white/10 rounded-md focus:ring-rose-500 cursor-pointer"
                      />
                    </div>
                    <span className="text-[10px] text-rose-400/75 block leading-normal">Locks out non-admin users, showing a clean platform-wide system maintenance window.</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex justify-end">
                  <button
                    id="save-admin-settings-btn"
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/15"
                  >
                    <Save className="h-4 w-4" />
                    <span>Apply Settings</span>
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* PROVISION ACCOUNTS DIALOG MODAL */}
      <AnimatePresence>
        {userModalOpen && (
          <div className="fixed inset-0 bg-[#09090b]/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="text-sm font-extrabold text-white font-sans uppercase tracking-tight flex items-center gap-1.5">
                  <Key className="h-4 w-4 text-indigo-400" />
                  <span>{editingUser ? "Edit User Authority" : "Provision Security Profile"}</span>
                </h3>
                <button className="text-neutral-400 hover:text-white font-bold cursor-pointer" onClick={() => setUserModalOpen(false)}>×</button>
              </div>

              <form onSubmit={handleCreateOrUpdateUser} className="space-y-4">
                {/* NAME */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-neutral-400 font-mono">Full Name</label>
                  <input
                    id="modal-form-name"
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Alexander Vance"
                    className="w-full text-xs p-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:bg-[#09090b]/60 focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>

                {/* EMAIL */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1 font-mono">
                    <Mail className="h-3 w-3 text-indigo-400" />
                    <span>Corporate Email</span>
                  </label>
                  <input
                    id="modal-form-email"
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="alex@microsoft.com"
                    className="w-full text-xs p-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:bg-[#09090b]/60 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* PASSWORD */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1 font-mono">
                    <Lock className="h-3 w-3 text-indigo-400" />
                    <span>{editingUser ? "Change Password (Optional)" : "Security Password"}</span>
                  </label>
                  <input
                    id="modal-form-password"
                    type="password"
                    required={!editingUser}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editingUser ? "Leave blank to preserve current" : "••••••••••••"}
                    className="w-full text-xs p-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:bg-[#09090b]/60 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* COMPANY */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1 font-mono">
                    <Building2 className="h-3 w-3 text-indigo-400" />
                    <span>Company Name</span>
                  </label>
                  <input
                    id="modal-form-company"
                    type="text"
                    required
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    placeholder="Microsoft Corporation"
                    className="w-full text-xs p-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:bg-[#09090b]/60 focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>

                {/* ROLE & STATUS */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-neutral-400 font-mono">Account Role</label>
                    <select
                      id="modal-form-role"
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:bg-[#09090b]/60 focus:outline-none focus:border-indigo-500 font-bold cursor-pointer"
                    >
                      <option value="recruiter" className="bg-[#09090b] text-white">Recruiter (Standard)</option>
                      <option value="admin" className="bg-[#09090b] text-white">Platform Admin</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-neutral-400 font-mono">Initial Status</label>
                    <select
                      id="modal-form-status"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:bg-[#09090b]/60 focus:outline-none focus:border-indigo-500 font-bold cursor-pointer"
                    >
                      <option value="active" className="bg-[#09090b] text-white">Active (Full Access)</option>
                      <option value="suspended" className="bg-[#09090b] text-white">Suspended (Blocked)</option>
                    </select>
                  </div>
                </div>

                {/* TRIGGERS */}
                <div className="flex gap-2 justify-end pt-3 border-t border-white/5">
                  <button
                    id="modal-form-cancel"
                    type="button"
                    onClick={() => setUserModalOpen(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="modal-form-submit"
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/15"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{editingUser ? "Save User" : "Provision User"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE ACCOUNT CONFIRMATION DIALOG */}
      <AnimatePresence>
        {deleteConfirmId !== null && (
          <div className="fixed inset-0 bg-[#09090b]/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center"
            >
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-full w-12 h-12 flex items-center justify-center mx-auto border border-rose-500/20">
                <AlertTriangle className="h-6 w-6 text-rose-400" />
              </div>
              
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-tight">Purge User Authority?</h3>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  This administrative action is permanent. Deleting this recruiter will clean up and cascade-delete all their job postings and matched candidate portfolios.
                </p>
              </div>

              <div className="flex gap-2 justify-center pt-2">
                <button
                  id="delete-cancel-btn"
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-neutral-300 transition-all cursor-pointer border border-white/5"
                >
                  Cancel Action
                </button>
                <button
                  id="delete-confirm-btn"
                  onClick={() => handleDeleteUser(deleteConfirmId)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-rose-600/15"
                >
                  Purge Account
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
