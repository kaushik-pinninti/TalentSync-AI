import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Calendar, 
  Clock, 
  Video, 
  Phone, 
  MapPin, 
  Plus, 
  Mail, 
  Star, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Bell, 
  ExternalLink, 
  Download, 
  FileText, 
  Users, 
  Briefcase, 
  User, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
  CalendarDays,
  ListFilter
} from "lucide-react";
import { Candidate, Job, Interview, InterviewScorecard, InterviewNotification } from "../types";

interface InterviewsSectionProps {
  jobs: Job[];
  candidates: Candidate[];
  token: string;
}

export default function InterviewsSection({ jobs, candidates, token }: InterviewsSectionProps) {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [notifications, setNotifications] = useState<InterviewNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "calendar" | "scheduler" | "notifications">("dashboard");

  // Scheduling Form State
  const [candidateId, setCandidateId] = useState("");
  const [jobId, setJobId] = useState("");
  const [title, setTitle] = useState("");
  const [datetime, setDatetime] = useState("");
  const [duration, setDuration] = useState("60");
  const [interviewerName, setInterviewerName] = useState("");
  const [interviewerEmail, setInterviewerEmail] = useState("");
  const [platform, setPlatform] = useState<"google_meet" | "microsoft_teams" | "phone" | "in_person">("google_meet");
  const [meetingLink, setMeetingLink] = useState("");
  const [notes, setNotes] = useState("");

  // Scorecard Dialog State
  const [selectedInterviewForScorecard, setSelectedInterviewForScorecard] = useState<Interview | null>(null);
  const [overallRating, setOverallRating] = useState(4);
  const [skillsRating, setSkillsRating] = useState(4);
  const [experienceRating, setExperienceRating] = useState(4);
  const [communicationRating, setCommunicationRating] = useState(4);
  const [cultureFitRating, setCultureFitRating] = useState(4);
  const [strengths, setStrengths] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [recommendation, setRecommendation] = useState<"hire" | "strong_hire" | "hold" | "reject">("hire");

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());

  // Mini-Calendar and Job Selection State
  const [selectedJobId, setSelectedJobId] = useState<string>("all");
  const [miniDate, setMiniDate] = useState(new Date());
  const [selectedMiniDay, setSelectedMiniDay] = useState<Date | null>(new Date());

  // Load interviews & notifications on mount / tab switch
  const loadInterviews = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/interviews", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json().catch(() => null);
          if (data && Array.isArray(data.interviews)) {
            setInterviews(data.interviews);
          } else {
            setInterviews([]);
          }
        } else {
          setInterviews([]);
        }
      } else {
        throw new Error("Failed to load interviews list.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const res = await fetch("/api/notifications", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json().catch(() => null);
          if (data && Array.isArray(data.notifications)) {
            setNotifications(data.notifications);
          } else {
            setNotifications([]);
          }
        } else {
          setNotifications([]);
        }
      }
    } catch (err) {
      console.error("Failed to load notifications logs:", err);
    }
  };

  useEffect(() => {
    loadInterviews();
    loadNotifications();
  }, [token]);

  // Handle schedule submit
  const handleScheduleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!candidateId || !jobId || !title || !datetime || !interviewerName || !interviewerEmail) {
      setError("Please fill out all mandatory fields.");
      return;
    }

    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          candidate_id: candidateId,
          job_id: jobId,
          title,
          datetime,
          duration,
          interviewer_name: interviewerName,
          interviewer_email: interviewerEmail,
          platform,
          meeting_link: meetingLink,
          notes
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to schedule interview.");
      }

      setSuccessMsg(`Successfully scheduled "${title}"! Notification emails queued.`);
      
      // Clear form
      setCandidateId("");
      setJobId("");
      setTitle("");
      setDatetime("");
      setInterviewerName("");
      setInterviewerEmail("");
      setMeetingLink("");
      setNotes("");

      // Refresh data
      loadInterviews();
      loadNotifications();
      setActiveTab("dashboard");
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Status transitions
  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/interviews/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        loadInterviews();
        loadNotifications();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // Scorecard submit
  const handleSubmitScorecard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInterviewForScorecard) return;

    try {
      const res = await fetch(`/api/interviews/${selectedInterviewForScorecard.id}/scorecard`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          overall_rating: overallRating,
          skills_rating: skillsRating,
          experience_rating: experienceRating,
          communication_rating: communicationRating,
          culture_fit_rating: cultureFitRating,
          strengths,
          weaknesses,
          recommendation
        })
      });

      if (res.ok) {
        setSuccessMsg(`Submitted evaluation scorecard for ${selectedInterviewForScorecard.title}`);
        setSelectedInterviewForScorecard(null);
        // Reset scorecard fields
        setStrengths("");
        setWeaknesses("");
        setOverallRating(4);
        setSkillsRating(4);
        setExperienceRating(4);
        setCommunicationRating(4);
        setCultureFitRating(4);
        
        loadInterviews();
        loadNotifications();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to submit scorecard");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Delete/Cancel interview
  const handleDeleteInterview = async (id: number) => {
    if (confirm("Are you sure you want to cancel and remove this interview?")) {
      try {
        const res = await fetch(`/api/interviews/${id}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          loadInterviews();
          loadNotifications();
        }
      } catch (err) {
        console.error("Failed to delete interview:", err);
      }
    }
  };

  // Trigger manual reminder email alert
  const handleSendReminder = async (id: number) => {
    try {
      const res = await fetch(`/api/interviews/${id}/remind`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        setSuccessMsg("Friendly reminder emails sent to Candidate & Interviewer successfully.");
        loadNotifications();
      }
    } catch (err) {
      console.error("Failed to send reminder:", err);
    }
  };

  // Autocomplete suggestions based on selected candidate
  const handleCandidateSelection = (candId: string) => {
    setCandidateId(candId);
    const candidate = candidates.find(c => c.id === Number(candId));
    if (candidate) {
      setJobId(String(candidate.job_id));
      const job = jobs.find(j => j.id === candidate.job_id);
      const shortName = candidate.name.split(" ")[0];
      setTitle(`Technical Screening: ${shortName} x ${job ? job.title : "Sourcing"}`);
    }
  };

  // Google Calendar Template URL Generator
  const getGoogleCalendarUrl = (interview: Interview) => {
    const start = new Date(interview.datetime);
    const end = new Date(start.getTime() + (interview.duration || 60) * 60000);
    const formatTime = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    
    const titleEncoded = encodeURIComponent(interview.title);
    const dates = `${formatTime(start)}/${formatTime(end)}`;
    const details = encodeURIComponent(
      `Recruitment Interview managed by TalentSync AI.\n\n` +
      `Candidate: ${(interview as any).candidate_name}\n` +
      `Position: ${(interview as any).job_title}\n` +
      `Interviewer: ${interview.interviewer_name} (${interview.interviewer_email})\n` +
      `Platform: ${interview.platform.replace("_", " ").toUpperCase()}\n` +
      `${interview.meeting_link ? `Join Link: ${interview.meeting_link}\n` : ""}\n` +
      `Candidate Prep Notes:\n${interview.notes || "No extra prep notes."}`
    );
    const location = encodeURIComponent(interview.meeting_link || interview.platform || "");
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titleEncoded}&dates=${dates}&details=${details}&location=${location}`;
  };

  // ICS Direct Download Generation
  const downloadICSFile = (interview: Interview) => {
    const start = new Date(interview.datetime);
    const end = new Date(start.getTime() + (interview.duration || 60) * 60000);
    const formatTime = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PROID:-//TalentSync//Interview Scheduler//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:uid_interview_${interview.id}@talentsync.ai`,
      `DTSTAMP:${formatTime(new Date())}`,
      `DTSTART:${formatTime(start)}`,
      `DTEND:${formatTime(end)}`,
      `SUMMARY:${interview.title}`,
      `DESCRIPTION:Candidate: ${(interview as any).candidate_name}\\nPosition: ${(interview as any).job_title}\\nInterviewer: ${interview.interviewer_name}\\nMeeting Link: ${interview.meeting_link || "N/A"}`,
      `LOCATION:${interview.meeting_link || interview.platform}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");
    
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `interview_${interview.id}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render Calendar Grid Helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    // Add empty slots for days before the 1st
    const startOffset = firstDay.getDay();
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    
    // Add real days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const getInterviewsForDate = (date: Date) => {
    return interviews.filter(i => {
      const iDate = new Date(i.datetime);
      return iDate.getDate() === date.getDate() &&
             iDate.getMonth() === date.getMonth() &&
             iDate.getFullYear() === date.getFullYear();
    });
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  // Stats Counters
  const filteredInterviews = interviews.filter(i => 
    selectedJobId === "all" || String(i.job_id) === selectedJobId
  );

  const totalScheduled = filteredInterviews.filter(i => i.status === "scheduled").length;
  const totalCompleted = filteredInterviews.filter(i => i.status === "completed").length;
  const totalPendingFeedback = filteredInterviews.filter(i => i.status === "scheduled" && new Date(i.datetime) < new Date()).length;
  const totalCancelled = filteredInterviews.filter(i => i.status === "cancelled").length;

  return (
    <div className="space-y-8 relative">
      {/* Aurora visual glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5 relative z-10">
        <div>
          <span className="text-xs text-indigo-400 font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            Interview Suite Panel
          </span>
          <h2 className="text-2xl font-black text-white mt-1.5 tracking-tight">SaaS Interview Operations Hub</h2>
          <p className="text-xs text-neutral-400 mt-1">Coordinate panel rounds, log feedback, monitor calendars, and configure synced invite logs seamlessly.</p>
        </div>

        {/* Tab switch control */}
        <div className="flex items-center gap-1 bg-white/3 border border-white/10 p-1 rounded-2xl shadow-xl self-start md:self-auto backdrop-blur-md">
          {[
            { id: "dashboard", label: "Dashboard Hub" },
            { id: "calendar", label: "Recruiter Calendar" },
            { id: "scheduler", label: "Schedule Round" },
            { id: "notifications", label: "Email Alert Logs" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setError(""); setSuccessMsg(""); }}
              className={`px-4 py-2 text-xs font-extrabold rounded-xl cursor-pointer transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-white text-[#09090b] shadow-lg font-black"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error & Success Toasts */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-2xl flex items-center gap-2.5 font-semibold relative z-10"
          >
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 animate-pulse" />
            <span>{error}</span>
          </motion.div>
        )}

        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-2xl flex items-center gap-2.5 font-semibold relative z-10"
          >
            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DASHBOARD HUB TAB */}
      {activeTab === "dashboard" && (
        <div className="space-y-8 relative z-10">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "ACTIVE SCHEDULED", count: totalScheduled, desc: "Upcoming rounds", color: "text-indigo-400" },
              { label: "COMPLETED", count: totalCompleted, desc: "Scorecards logged", color: "text-emerald-400" },
              { label: "PENDING EVALUATION", count: totalPendingFeedback, desc: "Needs scorecard", color: "text-amber-400" },
              { label: "CANCELLED", count: totalCancelled, desc: "Rounds removed", color: "text-neutral-500" }
            ].map((stat, i) => (
              <div key={i} className="glass-panel p-5 rounded-2xl border border-white/5 shadow-lg relative overflow-hidden group hover:border-white/10 transition duration-300">
                <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest font-mono block">{stat.label}</span>
                <div className="flex items-baseline gap-2.5 mt-2">
                  <span className={`text-3xl font-black ${stat.color} tracking-tight`}>{stat.count}</span>
                  <span className="text-xs text-neutral-500 font-semibold">{stat.desc}</span>
                </div>
                <div className="absolute top-0 right-0 w-12 h-12 bg-white/1 rounded-full blur-xl group-hover:scale-150 transition-all duration-500" />
              </div>
            ))}
          </div>

          {/* Job Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/2 border border-white/5 rounded-2xl">
            <div className="flex items-center gap-2">
              <ListFilter className="h-4 w-4 text-indigo-400" />
              <span className="text-xs font-bold text-neutral-300">Filter Target Job Position:</span>
            </div>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="px-3 py-1.5 bg-[#09090b]/80 border border-white/10 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer max-w-xs w-full sm:w-auto"
            >
              <option value="all">All Job Positions</option>
              {jobs.map(j => (
                <option key={j.id} value={String(j.id)}>{j.title}</option>
              ))}
            </select>
          </div>

          {/* Quick Schedule Onboard Header */}
          {interviews.length === 0 && !loading && (
            <div className="glass-panel rounded-3xl p-10 text-center max-w-lg mx-auto space-y-6 shadow-2xl border border-white/5 relative overflow-hidden">
              <div className="p-4 bg-white/5 border border-white/10 text-neutral-400 rounded-full w-16 h-16 flex items-center justify-center mx-auto shadow-md">
                <Calendar className="h-8 w-8 text-indigo-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black text-white tracking-tight">No interviews scheduled yet</h3>
                <p className="text-xs text-neutral-450 leading-relaxed max-w-sm mx-auto">
                  Connect your job applicants, align calendars, and organize screening evaluations. You can quickly schedule an onboarding or technical panel round.
                </p>
              </div>
              <button
                onClick={() => setActiveTab("scheduler")}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold cursor-pointer transition shadow-lg shadow-indigo-600/15"
              >
                Schedule First Interview Round
              </button>
            </div>
          )}

          {/* Active Interviews Pipeline Grid (List & Mini-Calendar) */}
          {interviews.length > 0 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-indigo-400" />
                    <span>Active Interview Panel Runs</span>
                  </h3>
                  <p className="text-xs text-neutral-450 mt-0.5">Real-time status tracking of all active evaluation pipelines</p>
                </div>
                <button
                  onClick={() => setActiveTab("scheduler")}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-200 border border-white/10 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition duration-250"
                >
                  <Plus className="h-4 w-4 text-indigo-400" />
                  <span>New Schedule</span>
                </button>
              </div>

              {/* Grid split: Left lists, Right mini-calendar */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                {/* Left side: Pipeline Lists */}
                <div className="xl:col-span-2 space-y-4">
                  {filteredInterviews.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredInterviews.map((item) => {
                        const dateObj = new Date(item.datetime);
                        const isPast = dateObj < new Date();
                        const showScorecardButton = item.status === "scheduled";

                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-panel border border-white/5 hover:border-white/15 rounded-2xl p-5 shadow-xl relative flex flex-col justify-between gap-4 transition duration-300 bg-white/[0.01]"
                          >
                            {/* Top Row: Title, Date, Badges */}
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <span className="inline-block text-[9px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-2.5 py-0.5 uppercase tracking-wider font-mono">
                                    {(item as any).job_title}
                                  </span>
                                  <h4 className="font-extrabold text-white text-sm mt-2 tracking-tight truncate leading-tight">{item.title}</h4>
                                </div>

                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full font-mono shrink-0 uppercase tracking-wider border ${
                                  item.status === "completed" 
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : item.status === "cancelled"
                                    ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                    : isPast
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse"
                                    : "bg-neutral-500/10 text-neutral-300 border-neutral-500/20"
                                }`}>
                                  {item.status}
                                </span>
                              </div>

                              {/* Mid Row: Candidate Info, Interviewer Details */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                                <div className="flex items-center gap-2 text-neutral-300 font-semibold">
                                  <div className="p-1 bg-white/5 rounded-lg border border-white/5 shrink-0">
                                    <User className="h-3.5 w-3.5 text-indigo-400" />
                                  </div>
                                  <span className="truncate text-[11px]">Candidate: <b className="text-white">{(item as any).candidate_name}</b></span>
                                </div>
                                
                                <div className="flex items-center gap-2 text-neutral-300 font-semibold font-mono">
                                  <div className="p-1 bg-white/5 rounded-lg border border-white/5 shrink-0">
                                    <Clock className="h-3.5 w-3.5 text-indigo-400" />
                                  </div>
                                  <span className="truncate text-[10px]">{dateObj.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })} ({item.duration}m)</span>
                                </div>

                                <div className="flex items-center gap-2 text-neutral-300 font-semibold">
                                  <div className="p-1 bg-white/5 rounded-lg border border-white/5 shrink-0">
                                    <Briefcase className="h-3.5 w-3.5 text-indigo-400" />
                                  </div>
                                  <span className="truncate text-[11px]">Panelist: <b className="text-white">{item.interviewer_name}</b></span>
                                </div>

                                <div className="flex items-center gap-2 text-neutral-300 font-semibold font-mono">
                                  <div className="p-1 bg-white/5 rounded-lg border border-white/5 shrink-0">
                                    {item.platform === "google_meet" || item.platform === "microsoft_teams" ? (
                                      <Video className="h-3.5 w-3.5 text-indigo-400" />
                                    ) : item.platform === "phone" ? (
                                      <Phone className="h-3.5 w-3.5 text-indigo-400" />
                                    ) : (
                                      <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                                    )}
                                  </div>
                                  <span className="truncate capitalize text-[10px]">{item.platform.replace("_", " ")}</span>
                                </div>
                              </div>

                              {item.meeting_link && (
                                <div className="bg-[#09090b]/40 border border-white/5 p-2 rounded-xl flex items-center justify-between text-[11px] text-neutral-300 mt-2">
                                  <span className="truncate pr-4 font-semibold">Link: <b className="text-indigo-400 font-mono select-all">{item.meeting_link}</b></span>
                                  <a
                                    href={item.meeting_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-white bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg border border-white/10 transition flex items-center gap-1 shrink-0 font-bold"
                                  >
                                    <span>Join</span>
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              )}

                              {item.notes && (
                                <p className="text-[11px] text-neutral-300 italic bg-white/2 p-2 rounded-xl border border-white/5 mt-1 leading-relaxed line-clamp-2" title={item.notes}>
                                  " {item.notes} "
                                </p>
                              )}
                            </div>

                            {/* Bottom row: Action Buttons */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
                              {/* Sync Calendars */}
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={getGoogleCalendarUrl(item)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Add to Google Calendar"
                                  className="p-1.5 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 rounded-xl text-[9px] font-extrabold flex items-center gap-1 cursor-pointer transition"
                                >
                                  <Calendar className="h-3 w-3 text-indigo-400" />
                                  <span>Add Google</span>
                                </a>

                                <button
                                  onClick={() => downloadICSFile(item)}
                                  title="Download iCal ICS invite file"
                                  className="p-1.5 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 rounded-xl text-[9px] font-extrabold flex items-center gap-1 cursor-pointer transition"
                                >
                                  <Download className="h-3 w-3 text-indigo-400" />
                                  <span>Outlook / iCal</span>
                                </button>
                              </div>

                              {/* Reminders & Scorecard */}
                              <div className="flex items-center gap-1">
                                {item.status === "scheduled" && (
                                  <button
                                    onClick={() => handleSendReminder(item.id)}
                                    className="p-1.5 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 rounded-xl text-[9px] font-extrabold flex items-center gap-1 cursor-pointer transition"
                                  >
                                    <Bell className="h-3.5 w-3.5 text-amber-400" />
                                    <span>Remind</span>
                                  </button>
                                )}

                                {showScorecardButton && (
                                  <button
                                    onClick={() => setSelectedInterviewForScorecard(item)}
                                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-extrabold flex items-center gap-1 cursor-pointer transition shadow-lg shadow-indigo-600/15"
                                  >
                                    <Star className="h-3 w-3 text-amber-300 fill-amber-350" />
                                    <span>Log Scorecard</span>
                                  </button>
                                )}

                                {item.status === "completed" && item.scorecard && (
                                  <button
                                    onClick={() => setSelectedInterviewForScorecard(item)}
                                    className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-[9px] font-extrabold flex items-center gap-1 cursor-pointer transition"
                                  >
                                    <FileText className="h-3 w-3 text-indigo-400" />
                                    <span>View Scorecard</span>
                                  </button>
                                )}

                                {item.status === "scheduled" && (
                                  <button
                                    onClick={() => handleUpdateStatus(item.id, "cancelled")}
                                    className="p-1.5 hover:bg-rose-500/10 text-neutral-400 hover:text-rose-400 border border-transparent hover:border-rose-500/20 rounded-xl transition cursor-pointer"
                                    title="Cancel Interview"
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                  </button>
                                )}

                                <button
                                  onClick={() => handleDeleteInterview(item.id)}
                                  className="p-1.5 hover:bg-rose-500/10 text-neutral-400 hover:text-rose-400 border border-transparent hover:border-rose-500/20 rounded-xl transition cursor-pointer"
                                  title="Delete Interview"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="glass-panel p-10 text-center rounded-2xl border border-white/5 space-y-3">
                      <CalendarDays className="h-8 w-8 text-neutral-500 mx-auto animate-pulse" />
                      <p className="text-xs font-bold text-white">No active runs found</p>
                      <p className="text-[10px] text-neutral-550 max-w-xs mx-auto">There are no upcoming scheduled rounds matching this filtered position.</p>
                    </div>
                  )}
                </div>

                {/* Right side: Mini-Calendar Component */}
                <div className="xl:col-span-1 space-y-4">
                  <div className="glass-panel border border-white/5 rounded-2xl p-5 shadow-xl space-y-4 bg-white/[0.01]">
                    {/* Header Controls */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-indigo-400" />
                        <div>
                          <h4 className="text-xs font-black text-white tracking-tight">Mini-Calendar</h4>
                          <p className="text-[9px] text-neutral-400 font-mono font-bold uppercase tracking-wider">Position Slots</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setMiniDate(new Date(miniDate.getFullYear(), miniDate.getMonth() - 1, 1))}
                          className="p-1 hover:bg-white/5 text-neutral-300 hover:text-white rounded transition cursor-pointer"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[10px] font-black text-white font-mono px-2 py-0.5 bg-white/5 rounded border border-white/10">
                          {miniDate.toLocaleString("default", { month: "short", year: "numeric" })}
                        </span>
                        <button
                          type="button"
                          onClick={() => setMiniDate(new Date(miniDate.getFullYear(), miniDate.getMonth() + 1, 1))}
                          className="p-1 hover:bg-white/5 text-neutral-300 hover:text-white rounded transition cursor-pointer"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Weekdays Grid */}
                    <div className="grid grid-cols-7 gap-1 text-center font-mono text-[8px] font-black text-neutral-400 uppercase tracking-wider">
                      <span>Su</span>
                      <span>Mo</span>
                      <span>Tu</span>
                      <span>We</span>
                      <span>Th</span>
                      <span>Fr</span>
                      <span>Sa</span>
                    </div>

                    {/* Monthly Days Grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {getDaysInMonth(miniDate).map((day, idx) => {
                        if (day === null) {
                          return <div key={`mini-empty-${idx}`} className="aspect-square bg-transparent" />;
                        }

                        const isToday = new Date().toDateString() === day.toDateString();
                        const isSelected = selectedMiniDay?.toDateString() === day.toDateString();
                        
                        // Highlights upcoming interview slots scheduled for the selected job position
                        const daySlots = filteredInterviews.filter(i => {
                          const iDate = new Date(i.datetime);
                          return i.status === "scheduled" &&
                                 iDate.getDate() === day.getDate() &&
                                 iDate.getMonth() === day.getMonth() &&
                                 iDate.getFullYear() === day.getFullYear();
                        });
                        const hasSlots = daySlots.length > 0;

                        return (
                          <button
                            key={day.toISOString()}
                            type="button"
                            onClick={() => setSelectedMiniDay(day)}
                            className={`aspect-square text-[9px] font-bold font-mono rounded-lg flex flex-col items-center justify-center transition relative cursor-pointer ${
                              isSelected
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-black border border-indigo-500"
                                : isToday
                                ? "bg-white/10 text-white border border-indigo-500/30 font-black"
                                : hasSlots
                                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30"
                                : "text-neutral-400 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <span>{day.getDate()}</span>
                            {hasSlots && !isSelected && (
                              <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-indigo-450 shadow-md animate-pulse" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected Date slots listing */}
                    <div className="border-t border-white/5 pt-3 space-y-2.5">
                      <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono font-bold uppercase tracking-wider">
                        <span>SLOTS FOR {selectedMiniDay ? selectedMiniDay.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "SELECTED DATE"}</span>
                        <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] text-indigo-400 font-extrabold font-mono">
                          {selectedMiniDay ? filteredInterviews.filter(i => {
                            const iDate = new Date(i.datetime);
                            return i.status === "scheduled" &&
                                   iDate.getDate() === selectedMiniDay.getDate() &&
                                   iDate.getMonth() === selectedMiniDay.getMonth() &&
                                   iDate.getFullYear() === selectedMiniDay.getFullYear();
                          }).length : 0} SLOTS
                        </span>
                      </div>

                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {(() => {
                          if (!selectedMiniDay) {
                            return <p className="text-[10px] text-neutral-550 text-center py-2 font-medium italic">Select a date above.</p>;
                          }
                          
                          const daySlots = filteredInterviews.filter(i => {
                            const iDate = new Date(i.datetime);
                            return i.status === "scheduled" &&
                                   iDate.getDate() === selectedMiniDay.getDate() &&
                                   iDate.getMonth() === selectedMiniDay.getMonth() &&
                                   iDate.getFullYear() === selectedMiniDay.getFullYear();
                          });

                          if (daySlots.length === 0) {
                            return (
                              <p className="text-[10px] text-neutral-550 text-center py-3 font-semibold italic">
                                No scheduled slots on this day.
                              </p>
                            );
                          }

                          return daySlots.map((slot) => (
                            <div
                              key={slot.id}
                              className="p-2 rounded-xl bg-white/2 border border-white/5 text-[10px] text-neutral-300 space-y-1 hover:bg-white/5 transition duration-150"
                            >
                              <div className="flex items-center justify-between font-bold">
                                <span className="text-white truncate pr-2">{slot.title}</span>
                                <span className="text-indigo-400 shrink-0 font-mono font-bold">
                                  {new Date(slot.datetime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[9px] text-neutral-400 font-semibold uppercase tracking-wider font-mono">
                                <span className="truncate">Panel: {slot.interviewer_name}</span>
                                <span>•</span>
                                <span className="capitalize">{slot.platform.replace("_", " ")}</span>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RECRUITER CALENDAR TAB */}
      {activeTab === "calendar" && (
        <div className="glass-panel border border-white/5 rounded-2xl p-6 shadow-xl space-y-6 relative z-10">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h3 className="font-extrabold text-white text-base tracking-tight">Interactive Grid View</h3>
              <p className="text-[10px] text-neutral-450 font-mono uppercase tracking-wider font-bold">Sync scheduled panels into dynamic calendar slots</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4 text-neutral-300" />
              </button>
              <span className="text-xs font-black text-white font-mono tracking-tight px-3 py-1 bg-white/5 rounded-xl border border-white/10">
                {currentDate.toLocaleString("default", { month: "long", year: "numeric" })}
              </span>
              <button
                onClick={nextMonth}
                className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4 text-neutral-300" />
              </button>
            </div>
          </div>

          {/* Calendar Grid Header */}
          <div className="grid grid-cols-7 gap-1 text-center font-mono text-[9px] font-black text-neutral-400 tracking-wider uppercase bg-[#09090b]/40 p-2.5 rounded-xl border border-white/5">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {getDaysInMonth(currentDate).map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="bg-transparent border border-transparent min-h-[110px] rounded-2xl" />;
              }

              const isToday = new Date().toDateString() === day.toDateString();
              const dayInterviews = getInterviewsForDate(day);

              return (
                <div
                  key={day.toISOString()}
                  className={`border p-2.5 min-h-[110px] rounded-2xl flex flex-col justify-between transition duration-200 ${
                    isToday 
                      ? "bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-600/5" 
                      : "bg-white/2 border-white/5 hover:border-white/15 hover:bg-white/3"
                  }`}
                >
                  <span className={`text-[10px] font-black font-mono self-end ${
                    isToday ? "bg-indigo-600 text-white h-5.5 w-5.5 rounded-full flex items-center justify-center shadow-lg" : "text-neutral-300"
                  }`}>
                    {day.getDate()}
                  </span>

                  <div className="space-y-1.5 mt-2 flex-1 flex flex-col justify-end">
                    {dayInterviews.map((int) => (
                      <div
                        key={int.id}
                        onClick={() => {
                          setActiveTab("dashboard");
                          setSuccessMsg(`Showing details for scheduled interview "${int.title}" below.`);
                        }}
                        title={`${int.title} with ${(int as any).candidate_name}`}
                        className={`text-[8px] font-bold px-1.5 py-1 rounded-lg truncate cursor-pointer transition duration-150 border uppercase tracking-wide ${
                          int.status === "completed"
                            ? "bg-emerald-500/15 border-emerald-500/20 text-emerald-400"
                            : int.status === "cancelled"
                            ? "bg-neutral-800 border-neutral-700/55 text-neutral-400 line-through"
                            : "bg-indigo-500/15 border-indigo-500/20 text-indigo-400"
                        }`}
                      >
                        {new Date(int.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {int.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SCHEDULER TAB */}
      {activeTab === "scheduler" && (
        <div className="glass-panel border border-white/5 rounded-2xl p-6 shadow-xl max-w-2xl mx-auto relative z-10">
          <div className="border-b border-white/5 pb-4 mb-6">
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest font-mono block">STEP-BY-STEP SCHEDULER</span>
            <h3 className="font-extrabold text-white text-base mt-1.5 tracking-tight">Configure New Panel Interview Round</h3>
            <p className="text-xs text-neutral-400 mt-1">Specify details to coordinate calendar invitations, email alerts, and scorecard templates.</p>
          </div>

          <form onSubmit={handleScheduleInterview} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-indigo-400" />
                  <span>Select Job Applicant *</span>
                </label>
                <select
                  value={candidateId}
                  onChange={(e) => handleCandidateSelection(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#09090b]/60 border border-white/10 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer"
                  required
                >
                  <option value="" className="bg-[#09090b] text-neutral-400">-- Choose Candidate --</option>
                  {candidates.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#09090b] text-white">
                      {c.name} ({jobs.find(j => j.id === c.job_id)?.title || "Direct Pool"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 text-indigo-400" />
                  <span>Target Position Job *</span>
                </label>
                <select
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#09090b]/60 border border-white/10 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer"
                  required
                >
                  <option value="" className="bg-[#09090b] text-neutral-400">-- Select Job --</option>
                  {jobs.map(j => (
                    <option key={j.id} value={j.id} className="bg-[#09090b] text-white">
                      {j.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300">Interview Title / Subject *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Technical Screening Round: Alice x Senior Backend Developer"
                className="w-full px-3.5 py-2.5 bg-[#09090b]/60 border border-white/10 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 font-semibold placeholder-neutral-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300">Date & Start Time *</label>
                <input
                  type="datetime-local"
                  value={datetime}
                  onChange={(e) => setDatetime(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#09090b]/60 border border-white/10 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 font-mono font-bold cursor-pointer"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300">Duration (Minutes) *</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#09090b]/60 border border-white/10 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer"
                  required
                >
                  <option value="30" className="bg-[#09090b]">30 Minutes</option>
                  <option value="45" className="bg-[#09090b]">45 Minutes</option>
                  <option value="60" className="bg-[#09090b]">60 Minutes (1 Hour)</option>
                  <option value="90" className="bg-[#09090b]">90 Minutes</option>
                  <option value="120" className="bg-[#09090b]">120 Minutes (2 Hours)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 font-sans">Interviewer Panelist Name *</label>
                <input
                  type="text"
                  value={interviewerName}
                  onChange={(e) => setInterviewerName(e.target.value)}
                  placeholder="e.g. Sandra Bullock"
                  className="w-full px-3.5 py-2.5 bg-[#09090b]/60 border border-white/10 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 font-semibold placeholder-neutral-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 font-sans">Interviewer Email *</label>
                <input
                  type="email"
                  value={interviewerEmail}
                  onChange={(e) => setInterviewerEmail(e.target.value)}
                  placeholder="e.g. sandra.bullock@company.com"
                  className="w-full px-3.5 py-2.5 bg-[#09090b]/60 border border-white/10 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 font-mono font-semibold placeholder-neutral-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300">Meeting Platform *</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-[#09090b]/60 border border-white/10 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer"
                  required
                >
                  <option value="google_meet" className="bg-[#09090b]">Google Meet</option>
                  <option value="microsoft_teams" className="bg-[#09090b]">Microsoft Outlook Teams</option>
                  <option value="phone" className="bg-[#09090b]">Direct Phone Call</option>
                  <option value="in_person" className="bg-[#09090b]">In-Person Interview</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300">Meeting / Video Link</label>
                <input
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="e.g. https://meet.google.com/abc-defg-hij"
                  className="w-full px-3.5 py-2.5 bg-[#09090b]/60 border border-white/10 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 font-mono font-semibold placeholder-neutral-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300">Recruiter Notes / Interview Prep Briefing</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Details of the evaluation. Add specific questions to ask or technical skills to review..."
                className="w-full px-3.5 py-2.5 bg-[#09090b]/60 border border-white/10 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 font-semibold h-24 resize-none placeholder-neutral-500"
              />
            </div>

            <button
              type="submit"
              className="w-full px-4 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold cursor-pointer transition shadow-lg shadow-indigo-600/15 hover:scale-[1.01]"
            >
              Schedule Panel Round & Fire Invites
            </button>
          </form>
        </div>
      )}

      {/* EMAIL NOTIFICATIONS ALERT LOGS */}
      {activeTab === "notifications" && (
        <div className="glass-panel border border-white/5 rounded-2xl p-6 shadow-xl space-y-5 relative z-10">
          <div>
            <h3 className="font-extrabold text-white text-base tracking-tight">Automated Recipient Log Alerts</h3>
            <p className="text-xs text-neutral-450 mt-1">Audit log records of calendar invites, interview instructions, and reminder logs sent to candidates and panels.</p>
          </div>

          <div className="border-t border-white/5 pt-3 space-y-4">
            {notifications.length === 0 ? (
              <p className="text-center py-10 text-xs text-neutral-400 font-semibold italic">No notifications logged yet.</p>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} className="bg-white/2 hover:bg-white/3 border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition duration-200">
                  <div className="space-y-2.5 text-xs text-neutral-300 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[8px] font-black px-2 py-0.5 uppercase tracking-wider rounded-full font-mono border ${
                        notif.type === "scheduled"
                          ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                          : notif.type === "reminder"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}>
                        {notif.type}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">To: <b className="text-white select-all">{notif.recipient_email}</b></span>
                    </div>

                    <h4 className="font-extrabold text-white text-sm tracking-tight">{notif.subject}</h4>
                    <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-line bg-[#09090b]/40 p-4 border border-white/5 rounded-xl max-w-2xl font-semibold">
                      {notif.body}
                    </p>
                  </div>

                  <div className="text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2.5">
                    <span className="text-[10px] text-neutral-400 font-bold font-mono bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                      {new Date(notif.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wider">
                      ✓ SENT SUCCESS
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SCORECARD BUILDER DIALOG POPUP */}
      <AnimatePresence>
        {selectedInterviewForScorecard && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-[#09090b]/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#09090b] border border-white/10 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/3 to-transparent pointer-events-none" />

              {/* Scorecard Header */}
              <div className="p-5 border-b border-white/5 flex items-center justify-between relative z-10 bg-white/2">
                <div>
                  <h3 className="font-extrabold text-white text-base tracking-tight">
                    {selectedInterviewForScorecard.scorecard ? "Evaluation Scorecard Record" : "Evaluate Candidate Panel Round"}
                  </h3>
                  <p className="text-[9px] text-neutral-400 font-mono mt-1 font-bold uppercase tracking-wider">
                    Job: {(selectedInterviewForScorecard as any).job_title} • Candidate: {(selectedInterviewForScorecard as any).candidate_name}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedInterviewForScorecard(null)}
                  className="p-1.5 hover:bg-white/5 text-neutral-400 hover:text-white rounded-lg transition cursor-pointer text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Scorecard Content Form */}
              <form onSubmit={handleSubmitScorecard} className="p-6 space-y-5 relative z-10 max-h-[80vh] overflow-y-auto">
                
                {/* Visual scorecard read-only view if already submitted */}
                {selectedInterviewForScorecard.scorecard ? (
                  <div className="space-y-5 text-xs">
                    <div className="grid grid-cols-2 gap-3.5 bg-white/2 p-4 rounded-xl border border-white/5 font-mono">
                      {[
                        { title: "Overall Fit", val: selectedInterviewForScorecard.scorecard.overall_rating },
                        { title: "Technical skills", val: selectedInterviewForScorecard.scorecard.skills_rating },
                        { title: "Experience Level", val: selectedInterviewForScorecard.scorecard.experience_rating },
                        { title: "Culture fit", val: selectedInterviewForScorecard.scorecard.culture_fit_rating }
                      ].map((item, keyIdx) => (
                        <div key={keyIdx} className="space-y-1.5">
                          <span className="text-neutral-400 block text-[9px] font-black uppercase tracking-wider">{item.title}</span>
                          <div className="flex items-center gap-0.5 text-amber-400">
                            {Array.from({ length: item.val }).map((_, i) => (
                              <Star key={i} className="h-3.5 w-3.5 fill-current" />
                            ))}
                            {Array.from({ length: 5 - item.val }).map((_, i) => (
                              <Star key={i} className="h-3.5 w-3.5 text-neutral-700" />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[9px] font-black font-mono text-neutral-400 block uppercase tracking-wider">RECOMMENDATION</span>
                      <span className={`inline-block px-3 py-1 text-xs font-black uppercase tracking-wider rounded-full font-mono ${
                        selectedInterviewForScorecard.scorecard.recommendation === "strong_hire" || selectedInterviewForScorecard.scorecard.recommendation === "hire"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}>
                        {selectedInterviewForScorecard.scorecard.recommendation.replace("_", " ")}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <span className="text-[9px] font-black font-mono text-neutral-400 block uppercase tracking-wider">STRENGTHS OBSERVED</span>
                      <p className="bg-white/2 p-3.5 border border-white/5 rounded-xl text-neutral-200 italic font-semibold leading-relaxed">
                        {selectedInterviewForScorecard.scorecard.strengths || "None noted."}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[9px] font-black font-mono text-neutral-400 block uppercase tracking-wider">WEAKNESSES / RISK AREAS</span>
                      <p className="bg-white/2 p-3.5 border border-white/5 rounded-xl text-neutral-200 italic font-semibold leading-relaxed">
                        {selectedInterviewForScorecard.scorecard.weaknesses || "None noted."}
                      </p>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedInterviewForScorecard(null)}
                        className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold border border-white/10 cursor-pointer"
                      >
                        Close Scorecard
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Create Scorecard Form */
                  <div className="space-y-5">
                    <span className="text-[9px] text-indigo-400 font-black uppercase font-mono tracking-widest block">Rate Skills Fit</span>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Overall Fit rating */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-300 block">Overall Alignment</label>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setOverallRating(val)}
                              className="text-amber-400 hover:scale-110 transition cursor-pointer"
                            >
                              <Star className={`h-5 w-5 ${overallRating >= val ? "fill-current" : "text-neutral-700"}`} />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Technical skills */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-300 block">Technical Capability</label>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setSkillsRating(val)}
                              className="text-amber-400 hover:scale-110 transition cursor-pointer"
                            >
                              <Star className={`h-5 w-5 ${skillsRating >= val ? "fill-current" : "text-neutral-700"}`} />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Experience match */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-300 block">Experience Depth</label>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setExperienceRating(val)}
                              className="text-amber-400 hover:scale-110 transition cursor-pointer"
                            >
                              <Star className={`h-5 w-5 ${experienceRating >= val ? "fill-current" : "text-neutral-700"}`} />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Communication */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-300 block">Communication Skills</label>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setCommunicationRating(val)}
                              className="text-amber-400 hover:scale-110 transition cursor-pointer"
                            >
                              <Star className={`h-5 w-5 ${communicationRating >= val ? "fill-current" : "text-neutral-700"}`} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-300 block">Culture Fit & Motivation</label>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCultureFitRating(val)}
                            className="text-amber-400 hover:scale-110 transition cursor-pointer"
                          >
                            <Star className={`h-5 w-5 ${cultureFitRating >= val ? "fill-current" : "text-neutral-700"}`} />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-300 block">Decision / Recommendation *</label>
                      <select
                        value={recommendation}
                        onChange={(e) => setRecommendation(e.target.value as any)}
                        className="w-full px-3.5 py-2.5 bg-[#09090b]/60 border border-white/10 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer"
                        required
                      >
                        <option value="strong_hire" className="bg-[#09090b]">Strong Hire (Highly Recommend)</option>
                        <option value="hire" className="bg-[#09090b]">Hire (Recommended)</option>
                        <option value="hold" className="bg-[#09090b]">Hold (Unsure / Marginal)</option>
                        <option value="reject" className="bg-[#09090b]">Reject</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-300 block">Key Strengths observed</label>
                      <textarea
                        value={strengths}
                        onChange={(e) => setStrengths(e.target.value)}
                        placeholder="Detail candidate's strong points during this evaluation..."
                        className="w-full px-3.5 py-2.5 bg-[#09090b]/60 border border-white/10 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 font-semibold h-20 resize-none placeholder-neutral-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-300 block">Weaknesses & Risks observed</label>
                      <textarea
                        value={weaknesses}
                        onChange={(e) => setWeaknesses(e.target.value)}
                        placeholder="Detail candidate's potential risks, lack of skill, etc..."
                        className="w-full px-3.5 py-2.5 bg-[#09090b]/60 border border-white/10 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 font-semibold h-20 resize-none placeholder-neutral-500"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => setSelectedInterviewForScorecard(null)}
                        className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white rounded-xl border border-white/10 text-xs font-bold cursor-pointer transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-lg shadow-indigo-600/15 hover:scale-101"
                      >
                        Submit Evaluation Scorecard
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
