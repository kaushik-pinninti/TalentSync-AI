import React, { useState, useEffect } from "react";
import { 
  Briefcase, MapPin, DollarSign, Calendar, UploadCloud, CheckCircle2, 
  ArrowLeft, RefreshCw, Sparkles, Send, ShieldAlert, FileText, 
  User, Mail, Phone, ExternalLink, GraduationCap, Award, Check, Moon, Sun
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CareersPortalProps {
  onBackToLogin: () => void;
  theme: "light" | "dark";
  recruiterMode?: boolean;
}

interface Job {
  id: number;
  title: string;
  company: string;
  description: string;
  experience: string;
  skills: string[];
  education: string;
  salary: string;
  location: string;
  employment_type: string;
  created_at: string;
}

export default function CareersPortal({ onBackToLogin, theme, recruiterMode = false }: CareersPortalProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("All");
  const [selectedType, setSelectedType] = useState("All");

  // Form Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  
  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<any | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Fetch public job openings
  const fetchJobs = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/public/jobs");
      if (!res.ok) {
        throw new Error("Failed to load active job openings");
      }
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err: any) {
      setError(err.message || "An error occurred while fetching jobs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setResumeFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setResumeText(text);
    };
    reader.onerror = () => {
      setError("Failed to read the selected file. Please make sure it's a readable text/markdown/doc file.");
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;
    if (!resumeText) {
      setError("Please upload your resume file to proceed.");
      return;
    }
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError("Please fill out your name, email, and phone number.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/public/jobs/${selectedJob.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          coverLetter,
          fileName: resumeFile?.name || `${name.replace(/\s+/g, "_")}_resume.txt`,
          textContent: resumeText
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit application");
      }

      setSubmitSuccess(data.candidate);
      // Reset form
      setName("");
      setEmail("");
      setPhone("");
      setCoverLetter("");
      setResumeFile(null);
      setResumeText("");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please check your details and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter lists
  const locations = ["All", ...Array.from(new Set(jobs.map(j => j.location)))];
  const types = ["All", ...Array.from(new Set(jobs.map(j => j.employment_type)))];

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = 
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesLocation = selectedLocation === "All" || job.location === selectedLocation;
    const matchesType = selectedType === "All" || job.employment_type === selectedType;

    return matchesSearch && matchesLocation && matchesType;
  });

  return (
    <div className="min-h-screen bg-[var(--apple-bg-canvas)] text-[var(--apple-text-primary)] transition-colors duration-350 flex flex-col selection:bg-indigo-500/30 overflow-x-hidden relative">
      {/* Aurora Ambient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[30%] -left-[20%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-tr from-blue-600/15 to-purple-600/5 blur-[130px] opacity-60" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-indigo-600/15 to-cyan-600/5 blur-[120px] opacity-60" />
      </div>

      {/* Header */}
      <header id="careers-portal-header" className="border-b border-neutral-200 dark:border-white/5 bg-[var(--apple-bg-nav)] backdrop-blur-md sticky top-0 z-50 transition-colors">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              id="back-to-portal-login-btn"
              onClick={onBackToLogin}
              className="p-2 hover:bg-neutral-200/50 dark:hover:bg-white/5 rounded-xl text-neutral-500 dark:text-neutral-400 hover:text-[var(--apple-text-primary)] transition cursor-pointer"
              title={recruiterMode ? "Back to Dashboard" : "Back to Recruiter Login"}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-full font-mono">
                  {recruiterMode ? "Recruiter Preview" : "Careers"}
                </span>
              </div>
              <h1 className="text-lg font-extrabold text-[var(--apple-text-primary)]">TalentSync Career Portal</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium hidden md:inline-block">
              {recruiterMode ? "Reviewing Candidate Flow" : "Explore Open Opportunities"}
            </span>
            <button
              id="careers-back-auth-btn"
              onClick={onBackToLogin}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
            >
              {recruiterMode ? "Exit Preview" : "Recruiter Login"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 z-10 relative">
        <AnimatePresence mode="wait">
          {submitSuccess ? (
            /* Success screen with live Match Score feedback */
            <motion.div
              key="apply-success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-xl mx-auto glass-panel p-8 text-center space-y-6"
            >
              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20 shadow-md">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-[var(--apple-text-primary)]">Application Submitted!</h2>
                <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-2">
                  Thank you, <b>{submitSuccess.name}</b>. Your application for <b>{selectedJob?.title}</b> was successfully submitted and processed.
                </p>
              </div>

              {/* Match Feedback Badge */}
              <div className="p-5 bg-indigo-500/5 dark:bg-white/5 rounded-2xl border border-indigo-500/15 dark:border-white/5 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-neutral-500 dark:text-neutral-400">
                  <span>TalentSync AI Screening Status</span>
                  <span className="text-emerald-500 dark:text-emerald-400 font-bold">Successfully Scanned</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center font-bold text-lg border border-indigo-500/15">
                    {submitSuccess.match_score}%
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="text-xs font-bold text-[var(--apple-text-primary)]">Instant Match Analysis Complete</h3>
                    <p className="text-[11px] text-neutral-400 leading-relaxed mt-0.5">
                      Your resume and cover letter have been securely index-matched for recruiter review using Gemini. No further action is required!
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 justify-center pt-2">
                <button
                  id="apply-success-back-jobs-btn"
                  onClick={() => {
                    setSubmitSuccess(null);
                    setSelectedJob(null);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-neutral-200 hover:bg-neutral-300 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-bold rounded-xl transition cursor-pointer text-center"
                >
                  Browse Other Jobs
                </button>
                <button
                  id="apply-success-back-login-btn"
                  onClick={onBackToLogin}
                  className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition cursor-pointer text-center"
                >
                  {recruiterMode ? "Back to Recruiter Dashboard" : "Go to Sign In"}
                </button>
              </div>
            </motion.div>
          ) : selectedJob ? (
            /* Selected Job and Application Form */
            <motion.div
              key="job-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-5 gap-8"
            >
              {/* Left Column: Job Spec Details */}
              <div className="lg:col-span-2 space-y-6">
                <button
                  id="back-to-listings-btn"
                  onClick={() => setSelectedJob(null)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 hover:bg-neutral-200/50 dark:hover:bg-white/5 rounded-xl text-xs font-bold text-neutral-500 dark:text-neutral-400 hover:text-[var(--apple-text-primary)] transition cursor-pointer border border-neutral-200 dark:border-white/5 bg-[var(--apple-bg-nav)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Listings</span>
                </button>

                <div className="glass-panel p-6 space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                  
                  <div>
                    <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-mono font-bold uppercase tracking-wider block">
                      {selectedJob.company}
                    </span>
                    <h2 className="text-xl font-extrabold text-[var(--apple-text-primary)] mt-1">
                      {selectedJob.title}
                    </h2>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-neutral-200/60 dark:bg-white/5 px-2.5 py-1 rounded-lg text-neutral-600 dark:text-neutral-400">
                        <MapPin className="h-3 w-3" /> {selectedJob.location}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-neutral-200/60 dark:bg-white/5 px-2.5 py-1 rounded-lg text-neutral-600 dark:text-neutral-400">
                        <Briefcase className="h-3 w-3" /> {selectedJob.employment_type}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-neutral-200/60 dark:bg-white/5 px-2.5 py-1 rounded-lg text-neutral-600 dark:text-neutral-400">
                        <DollarSign className="h-3 w-3" /> {selectedJob.salary}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-neutral-200 dark:border-white/5 pt-4 space-y-4 text-xs font-medium">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400 flex items-center gap-1"><Award className="h-3.5 w-3.5" /> Required Experience:</span>
                      <span className="text-[var(--apple-text-primary)]">{selectedJob.experience}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400 flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" /> Required Education:</span>
                      <span className="text-[var(--apple-text-primary)]">{selectedJob.education}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Key Target Skills</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedJob.skills.map((skill, idx) => (
                        <span key={idx} className="text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 px-2 py-0.5 rounded-md border border-indigo-500/10">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-neutral-200 dark:border-white/5 pt-4">
                    <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Role Description</h3>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto pr-1">
                      {selectedJob.description}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Application Form */}
              <div className="lg:col-span-3">
                <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-6">
                  <div>
                    <h2 className="text-base font-extrabold text-[var(--apple-text-primary)]">Submit Application</h2>
                    <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                      Attach your resume and an optional cover letter. TalentSync AI will process your application organically to highlight your strengths.
                    </p>
                  </div>

                  {error && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Personal Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                        <User className="h-3 w-3" /> Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full px-3 py-2 bg-neutral-200/50 dark:bg-white/5 border border-neutral-300 dark:border-white/5 focus:border-indigo-500 rounded-xl text-xs text-[var(--apple-text-primary)] outline-none transition"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                        <Mail className="h-3 w-3" /> Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="john.doe@example.com"
                        className="w-full px-3 py-2 bg-neutral-200/50 dark:bg-white/5 border border-neutral-300 dark:border-white/5 focus:border-indigo-500 rounded-xl text-xs text-[var(--apple-text-primary)] outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Phone Number
                    </label>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 019-2834"
                      className="w-full px-3 py-2 bg-neutral-200/50 dark:bg-white/5 border border-neutral-300 dark:border-white/5 focus:border-indigo-500 rounded-xl text-xs text-[var(--apple-text-primary)] outline-none transition"
                    />
                  </div>

                  {/* Organic Cover Letter Area */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                      Cover Letter <span className="text-neutral-500 lowercase font-medium">(optional, helps organic sorting)</span>
                    </label>
                    <textarea
                      rows={5}
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      placeholder="Tell us why you are a great fit for this role, and highlight any organic experience that might not be on your resume..."
                      className="w-full px-3 py-2.5 bg-neutral-200/50 dark:bg-white/5 border border-neutral-300 dark:border-white/5 focus:border-indigo-500 rounded-xl text-xs text-[var(--apple-text-primary)] outline-none transition resize-none leading-relaxed"
                    />
                  </div>

                  {/* Resume Upload Zone */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                      Resume Upload <span className="text-rose-400">*</span>
                    </label>
                    
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      className={`relative rounded-xl border border-dashed p-6 transition-all text-center flex flex-col items-center justify-center cursor-pointer ${
                        dragActive 
                          ? "border-indigo-500 bg-indigo-500/5" 
                          : resumeFile 
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-neutral-300 dark:border-white/10 hover:border-indigo-500 hover:bg-neutral-200/20 dark:hover:bg-white/5"
                      }`}
                    >
                      <input
                        type="file"
                        id="portal-resume-upload-input"
                        onChange={handleFileChange}
                        accept=".txt,.md,.pdf,.doc,.docx"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      
                      {resumeFile ? (
                        <div className="space-y-2 pointer-events-none">
                          <div className="inline-flex items-center justify-center p-2.5 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
                            <FileText className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[var(--apple-text-primary)] truncate max-w-xs">{resumeFile.name}</p>
                            <p className="text-[10px] text-neutral-400 mt-0.5">{(resumeFile.size / 1024).toFixed(1)} KB &bull; Loaded successfully</p>
                          </div>
                          <span className="text-[10px] text-indigo-400 hover:underline font-semibold cursor-pointer">Click or drag to replace file</span>
                        </div>
                      ) : (
                        <div className="space-y-2 pointer-events-none">
                          <div className="inline-flex items-center justify-center p-2.5 bg-neutral-200/50 dark:bg-white/5 text-neutral-500 rounded-xl">
                            <UploadCloud className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[var(--apple-text-primary)]">Drag & Drop Resume File</p>
                            <p className="text-[10px] text-neutral-400 mt-0.5">Supports PDF, DOCX, TXT, MD files (Parsed as plain text)</p>
                          </div>
                          <span className="text-[10px] text-indigo-400 font-semibold underline">Browse Files</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      id="apply-cancel-btn"
                      type="button"
                      disabled={submitting}
                      onClick={() => setSelectedJob(null)}
                      className="w-1/3 py-3 bg-neutral-200 hover:bg-neutral-300 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-bold rounded-xl transition cursor-pointer text-[var(--apple-text-primary)]"
                    >
                      Cancel
                    </button>
                    <button
                      id="apply-submit-btn"
                      type="submit"
                      disabled={submitting || !resumeText}
                      className="w-2/3 py-3 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-600/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>AI Scanning Application...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          <span>Onboard & Apply via AI</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          ) : (
            /* Jobs Listing view */
            <motion.div
              key="jobs-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Portal Intro */}
              <div className="text-center max-w-2xl mx-auto space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 text-[10px] font-bold font-mono rounded-full uppercase tracking-wider">
                  <Sparkles className="h-3 w-3 animate-pulse" /> Active Openings
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight text-[var(--apple-text-primary)]">Explore Open Opportunities</h2>
                <p className="text-xs text-neutral-400 leading-relaxed font-medium">
                  We use TalentSync AI to parse resumes and understand cover letters organically. Highlight your genuine strengths, interests, and potential.
                </p>
              </div>

              {/* Filtering Controls */}
              <div className="glass-panel p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="w-full md:w-1/2 relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search roles, skills, or departments..."
                    className="w-full pl-9 pr-4 py-2 bg-neutral-200/40 dark:bg-white/5 border border-neutral-300 dark:border-white/5 focus:border-indigo-500 rounded-xl text-xs text-[var(--apple-text-primary)] outline-none transition font-medium"
                  />
                </div>

                <div className="w-full md:w-auto flex flex-wrap sm:flex-nowrap gap-3 items-center">
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <span className="text-[10px] font-mono font-bold uppercase text-neutral-400 tracking-wider">Location:</span>
                    <select
                      id="careers-filter-location"
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      className="bg-neutral-200/50 dark:bg-white/5 border border-neutral-300 dark:border-white/5 rounded-xl px-3 py-1.5 text-xs text-[var(--apple-text-primary)] outline-none focus:border-indigo-500 transition cursor-pointer font-medium"
                    >
                      {locations.map((loc, idx) => (
                        <option key={idx} value={loc} className="dark:bg-neutral-900 text-[var(--apple-text-primary)]">{loc}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <span className="text-[10px] font-mono font-bold uppercase text-neutral-400 tracking-wider">Type:</span>
                    <select
                      id="careers-filter-type"
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="bg-neutral-200/50 dark:bg-white/5 border border-neutral-300 dark:border-white/5 rounded-xl px-3 py-1.5 text-xs text-[var(--apple-text-primary)] outline-none focus:border-indigo-500 transition cursor-pointer font-medium"
                    >
                      {types.map((t, idx) => (
                        <option key={idx} value={t} className="dark:bg-neutral-900 text-[var(--apple-text-primary)]">{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Jobs List Grid */}
              {loading ? (
                <div className="text-center py-12 space-y-3">
                  <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mx-auto" />
                  <p className="text-xs text-neutral-400 font-mono">Fetching latest roles...</p>
                </div>
              ) : error ? (
                <div className="p-6 text-center border border-rose-500/10 bg-rose-500/5 text-rose-300 rounded-2xl max-w-md mx-auto space-y-2">
                  <ShieldAlert className="h-8 w-8 text-rose-400 mx-auto" />
                  <p className="text-xs font-bold">Failed to load openings</p>
                  <p className="text-[11px] text-neutral-400">{error}</p>
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="text-center py-16 glass-panel space-y-2 max-w-md mx-auto">
                  <Briefcase className="h-8 w-8 text-neutral-500 mx-auto" />
                  <p className="text-xs font-bold text-[var(--apple-text-primary)]">No matching openings found</p>
                  <p className="text-[11px] text-neutral-400">Try adjusting your keywords, location, or employment filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredJobs.map((job) => (
                    <motion.div
                      key={job.id}
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-panel p-5 flex flex-col justify-between hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5 transition duration-300 group relative"
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide font-mono block">
                              {job.company}
                            </span>
                            <h3 className="text-base font-bold text-[var(--apple-text-primary)] mt-0.5 group-hover:text-indigo-400 transition-colors">
                              {job.title}
                            </h3>
                          </div>
                          <span className="text-[10px] font-semibold bg-neutral-200/50 dark:bg-white/5 px-2 py-0.5 rounded-lg text-neutral-500 dark:text-neutral-400 uppercase font-mono tracking-wider shrink-0 border border-neutral-300 dark:border-white/5">
                            {job.employment_type}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-neutral-400 font-medium">
                          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.location}</span>
                          <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> {job.salary}</span>
                        </div>

                        <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                          {job.description}
                        </p>

                        <div className="flex flex-wrap gap-1">
                          {job.skills.slice(0, 4).map((skill, idx) => (
                            <span key={idx} className="text-[9px] font-mono bg-neutral-200/50 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 px-1.5 py-0.5 rounded-md border border-neutral-300 dark:border-white/5">
                              {skill}
                            </span>
                          ))}
                          {job.skills.length > 4 && (
                            <span className="text-[9px] font-mono text-neutral-500 px-1.5 py-0.5">
                              +{job.skills.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="border-t border-neutral-200 dark:border-white/5 mt-5 pt-4 flex items-center justify-between">
                        <span className="text-[9px] text-neutral-500 dark:text-neutral-400 font-mono">
                          Posted {new Date(job.created_at).toLocaleDateString()}
                        </span>
                        <button
                          id={`view-and-apply-job-${job.id}`}
                          onClick={() => {
                            setSelectedJob(job);
                            setError("");
                          }}
                          className="px-4 py-1.5 bg-neutral-200 hover:bg-indigo-600 dark:bg-white/5 dark:hover:bg-indigo-650 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1 border border-neutral-300 dark:border-white/5"
                        >
                          <span>Apply Now</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
