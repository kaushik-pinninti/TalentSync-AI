import React, { useState, useEffect } from "react";
import { Mail, Settings, RefreshCw, Send, CheckCircle2, AlertCircle, Edit3, FileText, Bell, Check, User, Loader2 } from "lucide-react";
import { Job, Candidate } from "../types";

interface NotificationSectionProps {
  jobs: Job[];
  candidates: Candidate[];
  token: string | null;
}

interface NotificationTemplate {
  id: number;
  category: string;
  subject: string;
  body: string;
  variables: string; // JSON string array
  updated_at?: string;
}

interface AppNotification {
  id: number;
  recruiter_id: number | null;
  category: string;
  recipient_email: string;
  subject: string;
  body: string;
  status: string;
  sent_at: string;
  read_status: boolean;
}

export default function NotificationSection({ jobs, candidates, token }: NotificationSectionProps) {
  const [activeTab, setActiveTab] = useState<"inbox" | "dispatch" | "templates" | "smtp">("inbox");
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // SMTP form states
  const [smtpConfig, setSmtpConfig] = useState({
    host: "",
    port: "587",
    user: "",
    pass: "",
    fromEmail: "",
    fromName: "TalentSync Notifications",
    testRecipient: ""
  });
  const [testingSmtp, setTestingSmtp] = useState(false);

  // Template editor states
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState<string>("interview_invitation");
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Dispatcher States
  const [dispatchRecipient, setDispatchRecipient] = useState("");
  const [dispatchCategory, setDispatchCategory] = useState("interview_invitation");
  const [dispatchSubject, setDispatchSubject] = useState("");
  const [dispatchBody, setDispatchBody] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");

  // Variables for selected candidate
  const [customVariables, setCustomVariables] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchTemplates();
    fetchNotifications();
  }, [token]);

  // Load configuration from local storage if saved
  useEffect(() => {
    const savedSmtp = localStorage.getItem("ts_smtp_config");
    if (savedSmtp) {
      try {
        setSmtpConfig(JSON.parse(savedSmtp));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/notifications/templates", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.templates) {
        setTemplates(data.templates);
        // Set initial editing state
        const initial = data.templates.find((t: any) => t.category === selectedTemplateCategory);
        if (initial) {
          setEditSubject(initial.subject);
          setEditBody(initial.body);
        }
      }
    } catch (err) {
      console.error("Failed to load templates", err);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications/app", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
      }
    } catch (err) {
      console.error("Failed to load notifications", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/notifications/templates/${selectedTemplateCategory}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ subject: editSubject, body: editBody })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Email template successfully updated." });
        await fetchTemplates();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update template." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setMessage(null);
    try {
      const res = await fetch("/api/notifications/test-smtp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          host: smtpConfig.host,
          port: Number(smtpConfig.port),
          user: smtpConfig.user,
          pass: smtpConfig.pass,
          fromEmail: smtpConfig.fromEmail,
          fromName: smtpConfig.fromName,
          to_email: smtpConfig.testRecipient
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: "success", text: "SMTP Verification Succeeded! Test email delivered to " + smtpConfig.testRecipient });
        localStorage.setItem("ts_smtp_config", JSON.stringify(smtpConfig));
      } else {
        setMessage({ type: "error", text: data.error || "SMTP Connection Failed. Please double check credentials." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: "Connection Timeout: " + err.message });
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleSaveSmtpSettings = () => {
    localStorage.setItem("ts_smtp_config", JSON.stringify(smtpConfig));
    setMessage({ type: "success", text: "SMTP local credentials stored successfully. They will be applied on your outgoing dispatches." });
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await fetch(`/api/notifications/app/${id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_status: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch("/api/notifications/app/read-all", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, read_status: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectCandidate = (candidateId: string) => {
    setSelectedCandidateId(candidateId);
    if (!candidateId) {
      setDispatchRecipient("");
      return;
    }

    const cand = candidates.find(c => c.id === Number(candidateId));
    if (cand) {
      setDispatchRecipient(cand.email);
      const matchedJob = jobs.find(j => j.id === cand.job_id);

      const vars: Record<string, string> = {
        candidate_name: cand.name,
        job_title: matchedJob ? matchedJob.title : "Specialist Position",
        company_name: localStorage.getItem("ts_user_company") || "TalentSync Enterprise",
        interview_title: `Screening for ${matchedJob ? matchedJob.title : "Specialist"}`,
        datetime: new Date(Date.now() + 86400000 * 2).toLocaleString(),
        duration: "45",
        interviewer_name: "Technical Recruitment Committee",
        platform: "Google Meet",
        meeting_link_section: "https://meet.google.com/abc-defg-hij",
        recruiter_name: "HR Talent Partner",
        status: "Technical Review Phase",
        salary: matchedJob ? matchedJob.salary : "$90,000",
        employment_type: matchedJob ? matchedJob.employment_type : "Full-time",
        start_date: new Date(Date.now() + 86400000 * 30).toLocaleDateString(),
        deadline: new Date(Date.now() + 86400000 * 7).toLocaleDateString(),
        user_name: cand.name,
        reset_code: Math.floor(100000 + Math.random() * 900000).toString(),
        reset_link: "https://talentsync.ai/reset-password?token=verify-9912"
      };
      setCustomVariables(vars);

      const currentTpl = templates.find(t => t.category === dispatchCategory);
      if (currentTpl) {
        compileAndSet(currentTpl.subject, currentTpl.body, vars);
      }
    }
  };

  const handleCategoryChange = (category: string) => {
    setDispatchCategory(category);
    const currentTpl = templates.find(t => t.category === category);
    if (currentTpl) {
      compileAndSet(currentTpl.subject, currentTpl.body, customVariables);
    }
  };

  const compileAndSet = (subjectTpl: string, bodyTpl: string, vars: Record<string, string>) => {
    let compiledSub = subjectTpl;
    let compiledBody = bodyTpl;

    Object.entries(vars).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      compiledSub = compiledSub.replaceAll(placeholder, value);
      compiledBody = compiledBody.replaceAll(placeholder, value);
    });

    setDispatchSubject(compiledSub);
    setDispatchBody(compiledBody);
  };

  const handleSendNotification = async () => {
    if (!dispatchRecipient) {
      setMessage({ type: "error", text: "Please enter a valid recipient email address." });
      return;
    }
    setDispatching(true);
    setMessage(null);
    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          recipient_email: dispatchRecipient,
          category: dispatchCategory,
          subject: dispatchSubject,
          body: dispatchBody,
          customSmtp: smtpConfig.host ? {
            host: smtpConfig.host,
            port: Number(smtpConfig.port),
            user: smtpConfig.user,
            pass: smtpConfig.pass,
            fromEmail: smtpConfig.fromEmail,
            fromName: smtpConfig.fromName
          } : undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: "success",
          text: `Notification successfully dispatched! Transport Mode: ${data.mailResult.mode.toUpperCase()}. logged into records.`
        });
        fetchNotifications();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to deliver notification." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div id="notification-service-suite" className="space-y-6">
      {/* Header Info Banner */}
      <div className="glass-panel p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-xl font-extrabold text-white tracking-tight font-sans">Notification Service Center</h2>
          <p className="text-xs text-neutral-450 mt-1">Manage transactional email layouts, dispatcher updates, SMTP configuration and outbox delivery metrics.</p>
        </div>

        <div className="bg-white/5 p-1 rounded-full border border-white/10 flex flex-wrap gap-1 self-stretch lg:self-auto relative z-10">
          {[
            { id: "inbox", label: "Delivery Log", icon: Bell },
            { id: "dispatch", label: "Dispatch Email", icon: Send },
            { id: "templates", label: "Layout Templates", icon: FileText },
            { id: "smtp", label: "SMTP Gateway", icon: Settings }
          ].map((tab) => (
            <button
              id={`tab-btn-${tab.id}`}
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setMessage(null);
                if (tab.id === "templates") {
                  const initial = templates.find(t => t.category === selectedTemplateCategory);
                  if (initial) {
                    setEditSubject(initial.subject);
                    setEditBody(initial.body);
                  }
                }
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full transition-all duration-300 cursor-pointer ${
                activeTab === tab.id
                  ? "bg-white/10 text-white shadow-md border border-white/15"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.id === "inbox" && notifications.filter(n => !n.read_status).length > 0 && (
                <span className="ml-1 bg-indigo-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold font-mono">
                  {notifications.filter(n => !n.read_status).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div
          id="service-feedback-banner"
          className={`p-4 rounded-xl border flex items-start gap-3 animate-fade-in ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/25 text-rose-400"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-450 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4.5 h-4.5 text-rose-450 shrink-0 mt-0.5" />
          )}
          <div className="text-xs font-semibold leading-relaxed">{message.text}</div>
        </div>
      )}

      <div className="glass-panel rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        {/* TAB 1: INBOX & LOGS */}
        {activeTab === "inbox" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm">Real-Time Delivery Logs</h3>
                <p className="text-xs text-neutral-450">Stamps and outbox records matching live verification events.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-mark-all-read"
                  onClick={handleMarkAllAsRead}
                  disabled={notifications.length === 0}
                  className="px-3.5 py-1.5 text-xs text-neutral-300 hover:text-white font-bold bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition cursor-pointer disabled:opacity-40"
                >
                  <Check className="w-3.5 h-3.5 inline mr-1" /> Mark All Read
                </button>
                <button
                  id="btn-refresh-logs"
                  onClick={fetchNotifications}
                  className="p-1.5 hover:bg-white/10 rounded-xl text-neutral-450 hover:text-white transition cursor-pointer"
                  title="Refresh Logs"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-20 text-center text-neutral-400 text-xs flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                <span>Synchronizing pipeline logs...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-white/10 rounded-2xl">
                <Bell className="w-10 h-10 text-neutral-500 mx-auto mb-3" />
                <p className="text-white text-xs font-bold">No Transaction Logs Recorded</p>
                <p className="text-[11px] text-neutral-450 mt-1 leading-relaxed">
                  Campaign dispatches or test SMTP emails will compile history feeds here dynamically.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
                {notifications.map((n) => {
                  const isFail = n.status.includes("fail");
                  const isSimulated = n.status === "sandbox-simulated";

                  return (
                    <div
                      key={n.id}
                      className={`p-4 rounded-xl border transition-all ${
                        n.read_status ? "bg-white/1 border-white/5" : "bg-white/3 border-indigo-500/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-xl shrink-0 mt-0.5 border ${
                              isFail
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                : isSimulated
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            }`}
                          >
                            <Mail className="w-4 h-4" />
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-white text-sm">{n.subject}</span>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-white/5 text-neutral-300 border border-white/10 font-mono">
                                {n.category.replace("_", " ")}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase font-mono border ${
                                  isFail
                                    ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                    : isSimulated
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                    : "bg-[#09090b]/60 text-emerald-400 border-emerald-500/20"
                                }`}
                              >
                                {isSimulated ? "Sandbox Simulated" : n.status}
                              </span>
                            </div>

                            <p className="text-[10px] text-neutral-450">
                              To: <span className="font-semibold text-neutral-300 font-mono">{n.recipient_email}</span> &bull; Sent: {new Date(n.sent_at).toLocaleString()}
                            </p>

                            <div className="mt-2.5 bg-[#09090b]/40 rounded-xl p-3 text-xs text-neutral-300 whitespace-pre-line border border-white/5 font-mono max-h-36 overflow-y-auto custom-scrollbar">
                              {n.body}
                            </div>
                          </div>
                        </div>

                        {!n.read_status && (
                          <button
                            id={`btn-read-${n.id}`}
                            onClick={() => handleMarkAsRead(n.id)}
                            className="shrink-0 p-1.5 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white rounded-lg border border-white/10 transition-all text-xs flex items-center gap-0.5 font-bold cursor-pointer"
                            title="Mark Read"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DISPATCHER */}
        {activeTab === "dispatch" && (
          <div className="p-6">
            <div className="mb-5">
              <h3 className="font-bold text-white text-sm">Campaign Dispatch Command</h3>
              <p className="text-xs text-neutral-450">Load variables from active applications to send instant communications.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Controls */}
              <div className="lg:col-span-4 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 font-mono">
                    1. Target Candidate Record
                  </label>
                  <select
                    id="select-dispatch-candidate"
                    value={selectedCandidateId}
                    onChange={(e) => handleSelectCandidate(e.target.value)}
                    className="w-full text-xs font-semibold border border-white/10 focus:border-indigo-500 rounded-xl p-2.5 bg-white/5 focus:bg-[#09090b]/60 focus:outline-none transition-all text-white"
                  >
                    <option value="" className="bg-[#09090b] text-neutral-400">-- Direct Manual Entry --</option>
                    {candidates.map((cand) => {
                      const j = jobs.find(job => job.id === cand.job_id);
                      return (
                        <option key={cand.id} value={cand.id} className="bg-[#09090b] text-white">
                          {cand.name} ({cand.email}) - {j ? j.title : "Specialist"}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 font-mono">
                    Recipient Address
                  </label>
                  <input
                    id="input-dispatch-recipient"
                    type="email"
                    value={dispatchRecipient}
                    onChange={(e) => setDispatchRecipient(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full text-xs font-semibold border border-white/10 focus:border-indigo-500 rounded-xl p-2.5 bg-white/5 focus:bg-[#09090b]/60 focus:outline-none transition-all text-white placeholder-neutral-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 font-mono">
                    2. Choose Communication Type
                  </label>
                  <select
                    id="select-dispatch-category"
                    value={dispatchCategory}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full text-xs font-semibold border border-white/10 focus:border-indigo-500 rounded-xl p-2.5 bg-white/5 focus:bg-[#09090b]/60 focus:outline-none transition-all text-white"
                  >
                    <option value="interview_invitation" className="bg-[#09090b]">Interview Invitation</option>
                    <option value="password_reset" className="bg-[#09090b]">Account Password Reset</option>
                    <option value="job_update" className="bg-[#09090b]">Job Status Update</option>
                    <option value="offer_letter" className="bg-[#09090b]">Official Offer Letter</option>
                    <option value="rejection" className="bg-[#09090b]">Candidate rejection Letter</option>
                    <option value="reminder" className="bg-[#09090b]">Scheduled Phase Reminder</option>
                  </select>
                </div>

                <div className="bg-white/2 border border-white/15 rounded-2xl p-4">
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                    <User className="w-3.5 h-3.5 text-indigo-400" /> Compiled Variables
                  </h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {Object.entries(customVariables).length > 0 ? (
                      Object.entries(customVariables).slice(0, 6).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-[10px] font-mono text-neutral-300 bg-black/40 border border-white/5 p-1.5 rounded-lg">
                          <span className="font-extrabold text-indigo-400">{"{{" + key + "}}"}</span>
                          <span className="truncate max-w-[110px] font-medium text-neutral-400" title={value}>{value}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-[10px] text-neutral-450 italic">No variables loaded yet. Select a candidate above to populate.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Editor */}
              <div className="lg:col-span-8 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 font-mono">
                    Compiled Subject Line
                  </label>
                  <input
                    id="input-dispatch-subject"
                    type="text"
                    value={dispatchSubject}
                    onChange={(e) => setDispatchSubject(e.target.value)}
                    className="w-full text-xs font-bold border border-white/10 focus:border-indigo-500 rounded-xl p-2.5 bg-white/5 focus:bg-[#09090b]/60 focus:outline-none transition-all text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 font-mono">
                    Compiled HTML Template Message Body
                  </label>
                  <textarea
                    id="textarea-dispatch-body"
                    rows={12}
                    value={dispatchBody}
                    onChange={(e) => setDispatchBody(e.target.value)}
                    className="w-full text-xs border border-white/10 focus:border-indigo-500 rounded-xl p-3 font-mono bg-white/5 focus:bg-[#09090b]/60 focus:outline-none transition-all text-neutral-200"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 flex-wrap">
                  {smtpConfig.host ? (
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 font-mono">
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Live SMTP: {smtpConfig.host}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 font-mono">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> Trial Sandbox Simulation
                    </span>
                  )}

                  <button
                    id="btn-dispatch-notification"
                    onClick={handleSendNotification}
                    disabled={dispatching}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/15 cursor-pointer"
                  >
                    {dispatching ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending Outbox...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Notification</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TEMPLATES */}
        {activeTab === "templates" && (
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-bold text-white text-sm">Template Matrix Configurator</h3>
                <p className="text-xs text-neutral-450">Edit transactional mail drafts mapped to HR event challenges.</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-neutral-450 uppercase tracking-wider font-mono">Select Category:</span>
                <select
                  id="select-edit-template-category"
                  value={selectedTemplateCategory}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setSelectedTemplateCategory(cat);
                    const t = templates.find(item => item.category === cat);
                    if (t) {
                      setEditSubject(t.subject);
                      setEditBody(t.body);
                    }
                  }}
                  className="text-xs border border-white/10 rounded-xl p-2 font-bold bg-[#09090b]/60 text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="interview_invitation" className="bg-[#09090b]">Interview Invitation</option>
                  <option value="password_reset" className="bg-[#09090b]">Password Reset</option>
                  <option value="job_update" className="bg-[#09090b]">Job Status Update</option>
                  <option value="offer_letter" className="bg-[#09090b]">Offer Letter</option>
                  <option value="rejection" className="bg-[#09090b]">Candidate Rejection</option>
                  <option value="reminder" className="bg-[#09090b]">Round Reminder Alerts</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form editing */}
              <div className="lg:col-span-7 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 font-mono">
                    Subject Pattern
                  </label>
                  <input
                    id="input-edit-template-subject"
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="w-full text-xs font-bold border border-white/10 focus:border-indigo-500 rounded-xl p-2.5 bg-white/5 focus:bg-[#09090b]/60 focus:outline-none transition-all text-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono">
                      HTML Message Payload
                    </label>
                    <span className="text-[10px] text-neutral-500 font-mono">Accepts basic styling nodes</span>
                  </div>
                  <textarea
                    id="textarea-edit-template-body"
                    rows={12}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="w-full text-xs border border-white/10 focus:border-indigo-500 rounded-xl p-3 font-mono bg-white/5 focus:bg-[#09090b]/60 focus:outline-none transition-all text-neutral-200"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    id="btn-save-template"
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    {savingTemplate ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Template...</span>
                      </>
                    ) : (
                      <>
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Update Master Template</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Reference */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-[#09090b]/40 border border-white/10 rounded-2xl p-5">
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-wider mb-3 font-mono">
                    Supported Token Reference
                  </h4>
                  <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
                    Double bracket placeholders are compiled at routing time using details from associated databases.
                  </p>

                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                    {[
                      { tag: "{{candidate_name}}", desc: "The candidate's full display name" },
                      { tag: "{{job_title}}", desc: "Target job title of the applied role" },
                      { tag: "{{company_name}}", desc: "Your registered company title" },
                      { tag: "{{datetime}}", desc: "Structured timestamp of scheduled reviews" },
                      { tag: "{{duration}}", desc: "Duration of interview session (in minutes)" },
                      { tag: "{{interviewer_name}}", desc: "Assigned recruiter/manager interviewer" },
                      { tag: "{{platform}}", desc: "Meet, Teams, Zoom, phone, In-Person" },
                      { tag: "{{meeting_link_section}}", desc: "Unique target web URLs for digital join rooms" },
                      { tag: "{{recruiter_name}}", desc: "Sender Recruiter's full display name" },
                      { tag: "{{status}}", desc: "Phase or current disposition state description" },
                      { tag: "{{salary}}", desc: "Assigned compensation details" },
                      { tag: "{{employment_type}}", desc: "Full-Time, Contract, Hybrid" },
                      { tag: "{{start_date}}", desc: "Offered target joining calendar date" },
                      { tag: "{{deadline}}", desc: "Acceptance timeline expiration window" }
                    ].map((item) => (
                      <div key={item.tag} className="flex flex-col border-b border-white/5 pb-2 last:border-b-0">
                        <span className="font-mono text-xs font-bold text-indigo-400">{item.tag}</span>
                        <span className="text-[11px] text-neutral-400 mt-0.5">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SMTP */}
        {activeTab === "smtp" && (
          <div className="p-6">
            <div className="mb-5">
              <h3 className="font-bold text-white text-sm">SMTP Relay Settings</h3>
              <p className="text-xs text-neutral-450">Redirect transaction communications using your corporate mail transport layers.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Settings Parameters */}
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 font-mono">
                      Relay Server (Host)
                    </label>
                    <input
                      id="input-smtp-host"
                      type="text"
                      value={smtpConfig.host}
                      onChange={(e) => setSmtpConfig(prev => ({ ...prev, host: e.target.value }))}
                      placeholder="smtp.company.com"
                      className="w-full text-xs font-semibold border border-white/10 focus:border-indigo-500 rounded-xl p-2.5 bg-white/5 focus:bg-[#09090b]/60 focus:outline-none transition-all text-white placeholder-neutral-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 font-mono">
                      SMTP Port
                    </label>
                    <input
                      id="input-smtp-port"
                      type="text"
                      value={smtpConfig.port}
                      onChange={(e) => setSmtpConfig(prev => ({ ...prev, port: e.target.value }))}
                      placeholder="587"
                      className="w-full text-xs font-semibold border border-white/10 focus:border-indigo-500 rounded-xl p-2.5 bg-white/5 focus:bg-[#09090b]/60 focus:outline-none transition-all text-white placeholder-neutral-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 font-mono">
                      SMTP Username
                    </label>
                    <input
                      id="input-smtp-username"
                      type="text"
                      value={smtpConfig.user}
                      onChange={(e) => setSmtpConfig(prev => ({ ...prev, user: e.target.value }))}
                      placeholder="user@domain.com"
                      className="w-full text-xs font-semibold border border-white/10 focus:border-indigo-500 rounded-xl p-2.5 bg-white/5 focus:bg-[#09090b]/60 focus:outline-none transition-all text-white placeholder-neutral-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 font-mono">
                      SMTP Password
                    </label>
                    <input
                      id="input-smtp-password"
                      type="password"
                      value={smtpConfig.pass}
                      onChange={(e) => setSmtpConfig(prev => ({ ...prev, pass: e.target.value }))}
                      placeholder="••••••••••••"
                      className="w-full text-xs font-semibold border border-white/10 focus:border-indigo-500 rounded-xl p-2.5 bg-white/5 focus:bg-[#09090b]/60 focus:outline-none transition-all text-white placeholder-neutral-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 font-mono">
                      Sender Email (From)
                    </label>
                    <input
                      id="input-smtp-from-email"
                      type="email"
                      value={smtpConfig.fromEmail}
                      onChange={(e) => setSmtpConfig(prev => ({ ...prev, fromEmail: e.target.value }))}
                      placeholder="alerts@company.com"
                      className="w-full text-xs font-semibold border border-white/10 focus:border-indigo-500 rounded-xl p-2.5 bg-white/5 focus:bg-[#09090b]/60 focus:outline-none transition-all text-white placeholder-neutral-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 font-mono">
                      Display Name
                    </label>
                    <input
                      id="input-smtp-from-name"
                      type="text"
                      value={smtpConfig.fromName}
                      onChange={(e) => setSmtpConfig(prev => ({ ...prev, fromName: e.target.value }))}
                      placeholder="TalentSync HR"
                      className="w-full text-xs font-semibold border border-white/10 focus:border-indigo-500 rounded-xl p-2.5 bg-white/5 focus:bg-[#09090b]/60 focus:outline-none transition-all text-white placeholder-neutral-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    id="btn-save-smtp-settings"
                    onClick={handleSaveSmtpSettings}
                    className="flex-1 text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-2.5 px-4 rounded-xl transition-all text-center cursor-pointer shadow-md shadow-indigo-600/15"
                  >
                    Save local credentials
                  </button>
                </div>
              </div>

              {/* Verify Connection */}
              <div className="bg-[#09090b]/40 border border-white/10 rounded-2xl p-5 space-y-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5 font-sans">
                  <Mail className="w-4 h-4 text-indigo-400" /> Relay Transport Test
                </h4>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Verify SMTP server reachability. Triggers a transaction test email directly through the active channel.
                </p>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 font-mono">
                    Test Recipient Email
                  </label>
                  <input
                    id="input-smtp-test-recipient"
                    type="email"
                    value={smtpConfig.testRecipient}
                    onChange={(e) => setSmtpConfig(prev => ({ ...prev, testRecipient: e.target.value }))}
                    placeholder="verify@company.com"
                    className="w-full text-xs font-semibold border border-white/10 focus:border-indigo-500 rounded-xl p-2.5 bg-white/5 focus:bg-[#09090b]/60 focus:outline-none transition-all text-white placeholder-neutral-500"
                  />
                </div>

                <button
                  id="btn-test-smtp"
                  onClick={handleTestSmtp}
                  disabled={testingSmtp || !smtpConfig.host || !smtpConfig.user || !smtpConfig.pass || !smtpConfig.testRecipient}
                  className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  {testingSmtp ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>Verifying relay route...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Verify Route Delivery</span>
                    </>
                  )}
                </button>

                <div className="bg-black/30 rounded-xl p-3.5 text-[11px] text-neutral-450 leading-relaxed border border-white/5">
                  <span className="font-bold text-neutral-200">Alternative config:</span> You may alternatively seed outbound credentials directly as environment variables: <code className="font-mono text-neutral-300 font-bold bg-white/5 px-1 rounded">SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS</code> in the production host manifest.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
