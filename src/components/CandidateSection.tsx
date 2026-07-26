import React, { useState, useEffect } from "react";
import { Award, FileText, Filter, GraduationCap, Phone, Search, Sparkles, UploadCloud, User, X, Mic, MicOff, Boxes, Layers, Cpu, ShieldAlert, Brain, LayoutGrid, SlidersHorizontal, ArrowUpDown, ChevronRight, Check, RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import { Candidate, Job } from "../types";
import { useVoiceSpeech } from "../hooks/useVoiceSpeech";

export const GROWTH_SECTORS = [
  {
    name: "AI & Agents",
    icon: "Sparkles",
    color: "from-cyan-500/10 to-blue-500/10 border-cyan-500/20 text-cyan-400",
    activeColor: "bg-cyan-500/20 border-cyan-400 text-cyan-300 ring-2 ring-cyan-500/30",
    hoverColor: "hover:border-cyan-400/50 hover:bg-cyan-500/5",
    skills: [
      "generative ai", "llms", "ai agents", "langchain", "prompt engineering", "vector databases", "rag", 
      "neural networks", "transformers", "pytorch", "tensorflow", "openai", "gemini", "anthropic", "llama"
    ]
  },
  {
    name: "Web3 & Decentralized",
    icon: "Boxes",
    color: "from-purple-500/10 to-indigo-500/10 border-purple-500/20 text-purple-400",
    activeColor: "bg-purple-500/20 border-purple-400 text-purple-300 ring-2 ring-purple-500/30",
    hoverColor: "hover:border-purple-400/50 hover:bg-purple-500/5",
    skills: [
      "web3", "solidity", "smart contracts", "rust", "ethereum", "blockchain", "cryptography", "defi", "zkp"
    ]
  },
  {
    name: "Next-Gen Infrastructure",
    icon: "Layers",
    color: "from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-400",
    activeColor: "bg-emerald-500/20 border-emerald-400 text-emerald-300 ring-2 ring-emerald-500/30",
    hoverColor: "hover:border-emerald-400/50 hover:bg-emerald-500/5",
    skills: [
      "kubernetes", "terraform", "iac", "edge computing", "wasm", "serverless", "grpc", "service mesh", "docker"
    ]
  },
  {
    name: "Quantum & HPC",
    icon: "Cpu",
    color: "from-pink-500/10 to-rose-500/10 border-pink-500/20 text-pink-400",
    activeColor: "bg-pink-500/20 border-pink-400 text-pink-300 ring-2 ring-pink-500/30",
    hoverColor: "hover:border-pink-400/50 hover:bg-pink-500/5",
    skills: [
      "quantum computing", "qiskit", "cuda", "hpc", "parallel computing", "fpga"
    ]
  },
  {
    name: "AI Security & Trust",
    icon: "ShieldAlert",
    color: "from-amber-500/10 to-orange-500/10 border-amber-500/20 text-amber-400",
    activeColor: "bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-500/30",
    hoverColor: "hover:border-amber-400/50 hover:bg-amber-500/5",
    skills: [
      "ai safety", "devsecops", "zero trust", "security ai", "threat intelligence", "cybersecurity"
    ]
  }
];

export const renderSectorIcon = (iconName: string) => {
  switch (iconName) {
    case "Sparkles": return <Sparkles className="h-4 w-4 text-cyan-400" />;
    case "Boxes": return <Boxes className="h-4 w-4 text-purple-400" />;
    case "Layers": return <Layers className="h-4 w-4 text-emerald-400" />;
    case "Cpu": return <Cpu className="h-4 w-4 text-pink-400" />;
    case "ShieldAlert": return <ShieldAlert className="h-4 w-4 text-amber-400" />;
    default: return <Sparkles className="h-4 w-4 text-neutral-400" />;
  }
};

interface CandidateSectionProps {
  candidates: Candidate[];
  jobs: Job[];
  selectedJob: Job | null;
  token: string;
  onRefreshCandidates: () => void;
  onSelectCandidateForDetails: (candidate: Candidate) => void;
}

export default function CandidateSection({
  candidates,
  jobs,
  selectedJob,
  token,
  onRefreshCandidates,
  onSelectCandidateForDetails
}: CandidateSectionProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Paste Fallback Box state
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pastedName, setPastedName] = useState("");
  const [pastedText, setPastedText] = useState("");

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [minMatchScore, setMinMatchScore] = useState(0);

  // Future Tech Growth & Section Role Filter states
  const [selectedGrowthSector, setSelectedGrowthSector] = useState<string | null>(null);
  const [selectedRoleCategory, setSelectedRoleCategory] = useState<string | null>(null);
  const [selectedStageFilter, setSelectedStageFilter] = useState<string | null>(null);
  const [enhancingCandidateId, setEnhancingCandidateId] = useState<number | null>(null);

  // New sub-view and comparison states
  const [activeSubView, setActiveSubView] = useState<"list" | "pipeline" | "compare">("list");
  const [compareIds, setCompareIds] = useState<number[]>([]);

  // Persistent candidate stage mapping
  const getCandidateStage = (candId: number, candMatch: any) => {
    return localStorage.getItem(`ts_candidate_stage_${candId}`) || (candMatch ? "screened" : "applied");
  };

  const updateCandidateStage = (candId: number, stage: string) => {
    localStorage.setItem(`ts_candidate_stage_${candId}`, stage);
    // Sync with backend feedback
    fetch(`/api/candidates/${candId}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ feedback: `Stage updated to: ${stage}` })
    }).catch(err => console.warn("Failed syncing stage on server db", err));
    
    // Refresh parent context
    onRefreshCandidates();
  };

  const toggleCompare = (candId: number) => {
    setCompareIds((prev) => {
      if (prev.includes(candId)) {
        return prev.filter((id) => id !== candId);
      }
      if (prev.length >= 4) {
        alert("You can compare a maximum of 4 candidates side-by-side.");
        return prev;
      }
      return [...prev, candId];
    });
  };

  const getStageLabel = (stageKey: string) => {
    switch (stageKey) {
      case "applied": return "Applied";
      case "screened": return "Screened";
      case "shortlisted": return "Shortlisted";
      case "interviewing": return "Interviewing";
      case "offer": return "Offer Made";
      case "hired": return "Hired";
      default: return "Applied";
    }
  };

  const { isListening, transcript, startListening, stopListening, hasSTTSupport } = useVoiceSpeech();

  useEffect(() => {
    if (transcript) {
      setSearchQuery(transcript);
    }
  }, [transcript]);

  // Helper to check if a candidate matches a Growth Sector's skills
  const isCandidateInSector = (candSkills: string[], sectorName: string) => {
    const sector = GROWTH_SECTORS.find(s => s.name === sectorName);
    if (!sector) return false;
    const normalized = (candSkills || []).map(s => s.toLowerCase());
    return normalized.some(skill => 
      sector.skills.some(sectorSkill => 
        skill.includes(sectorSkill) || sectorSkill.includes(skill)
      )
    );
  };

  // Helper to determine candidate job title
  const getJobTitleForCandidate = (candJobId: number) => {
    const job = jobs.find(j => j.id === candJobId);
    return job ? job.title : "General";
  };

  // Helper to determine role category dynamically based on skills and job title
  const getCandidateRoleCategory = (candSkills: string[], jobTitle: string) => {
    const normalizedSkills = (candSkills || []).map(s => s.toLowerCase());
    const title = (jobTitle || "").toLowerCase();
    
    if (normalizedSkills.some(s => ["react", "frontend", "vue", "angular", "css", "html", "tailwind"].includes(s)) || title.includes("frontend") || title.includes("web designer")) {
      return "Frontend";
    }
    if (normalizedSkills.some(s => ["node", "express", "django", "spring", "flask", "backend", "sql", "postgresql", "mongodb"].includes(s)) || title.includes("backend") || title.includes("database")) {
      return "Backend";
    }
    if (normalizedSkills.some(s => ["generative ai", "llms", "ai agents", "langchain", "prompt engineering", "pytorch", "tensorflow", "neural", "transformers"].includes(s)) || title.includes("ai") || title.includes("ml") || title.includes("learning") || title.includes("nlp")) {
      return "AI & Machine Learning";
    }
    if (normalizedSkills.some(s => ["kubernetes", "docker", "terraform", "aws", "ci/cd", "devops", "cloud"].includes(s)) || title.includes("devops") || title.includes("cloud") || title.includes("infrastructure")) {
      return "Cloud & DevOps";
    }
    if (normalizedSkills.some(s => ["security", "zero trust", "cyber", "cryptography", "blockchain", "solidity"].includes(s)) || title.includes("security") || title.includes("cryptography")) {
      return "Security & Web3";
    }
    return "General Fullstack";
  };

  // Enhance Candidate Skills to add Future Technologies
  const handleEnhanceSkills = async (candId: number, skillsToAdd: string[]) => {
    setEnhancingCandidateId(candId);
    setError("");
    setSuccess("");
    try {
      const cand = candidates.find(c => c.id === candId);
      if (!cand) return;
      const combinedSkills = Array.from(new Set([...cand.skills, ...skillsToAdd]));
      
      const res = await fetch(`/api/candidates/${candId}/skills`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ skills: combinedSkills })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to enhance candidate skills");
      }

      setSuccess(`AI successfully enhanced ${cand.name}'s resume skills with: ${skillsToAdd.slice(0, 3).join(", ")}!`);
      onRefreshCandidates();
    } catch (err: any) {
      setError(err.message || "An error occurred during skills enhancement");
    } finally {
      setEnhancingCandidateId(null);
    }
  };

  // Filter candidates based on selected job first, then search query
  const jobCandidates = selectedJob
    ? candidates.filter((c) => c.job_id === selectedJob.id)
    : candidates;

  const filteredCandidates = jobCandidates.filter((cand) => {
    const matchesSearch =
      cand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cand.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cand.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const score = cand.match?.overall_score || 0;
    const matchesScore = score >= minMatchScore;

    const matchesSector = !selectedGrowthSector || isCandidateInSector(cand.skills, selectedGrowthSector);
    const candJobTitle = getJobTitleForCandidate(cand.job_id);
    const matchesRole = !selectedRoleCategory || getCandidateRoleCategory(cand.skills, candJobTitle) === selectedRoleCategory;
    const currentStage = getCandidateStage(cand.id, cand.match);
    const matchesStage = !selectedStageFilter || currentStage === selectedStageFilter;

    return matchesSearch && matchesScore && matchesSector && matchesRole && matchesStage;
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processTextAndUpload = async (name: string, text: string) => {
    if (!selectedJob) {
      setError("Please select a job role first before parsing a resume.");
      return;
    }
    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/jobs/${selectedJob.id}/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: name.endsWith(".txt") || name.endsWith(".pdf") ? name : `${name}.txt`,
          textContent: text
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to parse and onboard resume");
      }

      setSuccess(`Onboarded candidate "${data.candidate.name}" successfully!`);
      setPastedName("");
      setPastedText("");
      setShowPasteBox(false);
      onRefreshCandidates();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await handleFile(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    // Read local file as text for extraction
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      await processTextAndUpload(file.name, text);
    };
    reader.onerror = () => {
      setError("Failed to read the selected file.");
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Target Job Indicator Header */}
      <div className="glass-panel p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider font-mono">Active Funnel Filter</span>
          <h2 className="text-lg font-extrabold text-white mt-1">
            {selectedJob ? `Screening for: ${selectedJob.title}` : "All Registered Candidates"}
          </h2>
          <p className="text-xs text-neutral-400 mt-1 font-medium leading-relaxed">
            {selectedJob 
              ? `${jobCandidates.length} applicants currently registered under this role.`
              : "Showing applicants across all active openings."}
          </p>
        </div>

        {!selectedJob && (
          <div className="px-3.5 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-xl font-bold font-mono relative z-10">
            Please select a Job Posting to unlock resume uploads
          </div>
        )}
      </div>

      {selectedJob && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
          {/* Drag & Drop Upload Zone */}
          <div
            id="drag-drop-upload-zone"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center flex flex-col items-center justify-center min-h-[220px] transition-all duration-300 relative overflow-hidden group ${
              dragActive
                ? "border-indigo-500 bg-indigo-600/5"
                : "border-white/10 hover:border-white/20 glass-panel"
            }`}
          >
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            <input
              id="file-upload-input"
              type="file"
              accept=".txt,.pdf,.docx,.doc"
              onChange={handleFileChange}
              className="hidden"
            />
            
            <UploadCloud className="h-10 w-10 text-indigo-400 mb-3 group-hover:scale-110 transition duration-300" />
            <p className="text-white font-bold text-sm">Drag and drop resume here</p>
            <p className="text-xs text-neutral-400 mt-1 mb-4 font-medium">Accepts PDF, TXT, DOCX files</p>
            
            <div className="flex flex-wrap items-center justify-center gap-3 relative z-10">
              <label
                id="select-file-label"
                htmlFor="file-upload-input"
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl text-xs font-bold text-white cursor-pointer transition-all duration-300 shadow-md shadow-indigo-600/10"
              >
                Select File
              </label>
              <button
                id="toggle-raw-paste-btn"
                type="button"
                onClick={() => setShowPasteBox(!showPasteBox)}
                className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-neutral-300 transition"
              >
                Paste Raw Text
              </button>
            </div>
          </div>

          {/* Copy Paste Textbox Panel */}
          {showPasteBox && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel p-6 space-y-4 relative overflow-hidden flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">Paste Plain Resume Content</h4>
                <button
                  id="close-paste-box-btn"
                  onClick={() => setShowPasteBox(false)}
                  className="p-1 bg-white/5 hover:bg-white/10 rounded-full text-neutral-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <input
                id="pasted-candidate-name"
                type="text"
                required
                placeholder="Candidate Full Name (e.g. Jane Doe)"
                value={pastedName}
                onChange={(e) => setPastedName(e.target.value)}
                className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:bg-[#09090b]/40 transition"
              />

              <textarea
                id="pasted-resume-text"
                rows={3}
                required
                placeholder="Paste full raw text copy of the candidate's resume here..."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:bg-[#09090b]/40 transition resize-none font-mono"
              />

              <button
                id="submit-pasted-resume-btn"
                onClick={() => processTextAndUpload(pastedName || "Pasted Candidate", pastedText)}
                disabled={uploading || !pastedText}
                className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold rounded-xl text-white cursor-pointer disabled:opacity-50 transition shadow-lg shadow-indigo-600/15"
              >
                {uploading ? "AI Parsing Resume..." : "Onboard & Scan via Gemini"}
              </button>
            </motion.div>
          )}

          {/* Messages block */}
          {(error || success || uploading) && (
            <div className="md:col-span-2 space-y-2">
              {uploading && (
                <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs rounded-xl flex items-center gap-3 font-semibold">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Analyzing, extracting, and matching candidate profile utilizing <b>gemini-2.5-flash</b>. This will take a moment...</span>
                </div>
              )}
              {error && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-semibold">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2 font-semibold animate-fade-in">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  <span>{success}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* FILTER & CANDIDATE LIST */}
      <div className="space-y-4">
        {/* Search controls & View Mode Selector */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-[#0d0d12]/90 border border-white/10 p-4 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
            <input
              id="candidate-search-query"
              type="text"
              placeholder="Search by candidate name, email, or parsed tech skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-10 py-2.5 bg-[#09090b]/60 border border-white/10 rounded-xl text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-indigo-500 focus:bg-[#09090b] transition"
            />
            {hasSTTSupport && (
              <button
                id="voice-search-candidate-btn"
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`absolute right-2.5 top-1.5 p-1.5 rounded-xl transition cursor-pointer flex items-center justify-center ${
                  isListening 
                    ? "bg-rose-500/20 text-rose-400 animate-pulse border border-rose-500/30 shadow-md shadow-rose-500/10" 
                    : "bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border border-white/5"
                }`}
                title={isListening ? "Stop Listening" : "Search via Voice"}
              >
                {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 relative z-10">
            {/* Fit Filter dropdown */}
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-neutral-400" />
              <select
                id="candidate-min-score-select"
                value={minMatchScore}
                onChange={(e) => setMinMatchScore(Number(e.target.value))}
                className="px-3 py-2 bg-[#09090b]/60 border border-white/10 text-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs cursor-pointer focus:bg-[#09090b]"
              >
                <option value={0} className="bg-[#09090b] text-white">All Match Scores</option>
                <option value={85} className="bg-[#09090b] text-white">Excellent Fit (≥85%)</option>
                <option value={70} className="bg-[#09090b] text-white">Strong Fit (≥70%)</option>
                <option value={50} className="bg-[#09090b] text-white">Average Fit (≥50%)</option>
              </select>
            </div>

            {/* Sub-view switcher */}
            <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl">
              <button
                id="tab-view-list"
                type="button"
                onClick={() => setActiveSubView("list")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  activeSubView === "list" ? "bg-indigo-600 text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                Funnel List
              </button>
              <button
                id="tab-view-pipeline"
                type="button"
                onClick={() => setActiveSubView("pipeline")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  activeSubView === "pipeline" ? "bg-indigo-600 text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                Pipeline Kanban
              </button>
              <button
                id="tab-view-compare"
                type="button"
                onClick={() => setActiveSubView("compare")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  activeSubView === "compare" ? "bg-indigo-600 text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                Compare ({compareIds.length}/4)
              </button>
            </div>
          </div>
        </div>

        {/* FUTURE TECHNOLOGY GROWTH & SECTION ROLE FILTERS PANEL */}
        <div className="bg-[#0b0b10] border border-white/10 rounded-2xl p-5 space-y-5 relative overflow-hidden">
          {/* Subtle grid pattern / flare overlay */}
          <div className="absolute top-0 left-0 w-full h-full bg-grid-white/[0.01] pointer-events-none" />
          <div className="absolute -top-16 -left-16 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white tracking-tight">Future Tech Growth Filters</h3>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">Filter candidates utilizing next-generation skills in modern technological growth fields.</p>
            </div>
            
            {/* Reset Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {(selectedGrowthSector || selectedRoleCategory || selectedStageFilter || minMatchScore > 0 || searchQuery) && (
                <button
                  id="reset-all-filters-btn"
                  onClick={() => {
                    setSelectedGrowthSector(null);
                    setSelectedRoleCategory(null);
                    setSelectedStageFilter(null);
                    setMinMatchScore(0);
                    setSearchQuery("");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-850 border border-white/5 text-neutral-300 hover:text-white rounded-xl text-xs transition cursor-pointer font-medium"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Clear All Filters</span>
                </button>
              )}
            </div>
          </div>

          {/* 1. Growth Sectors Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 relative z-10">
            {GROWTH_SECTORS.map((sector) => {
              const matchingCount = jobCandidates.filter(c => isCandidateInSector(c.skills, sector.name)).length;
              const isActive = selectedGrowthSector === sector.name;

              return (
                <button
                  key={sector.name}
                  id={`growth-sector-filter-${sector.name.replace(/\s+/g, "-").toLowerCase()}`}
                  onClick={() => setSelectedGrowthSector(isActive ? null : sector.name)}
                  className={`flex flex-col text-left p-3 rounded-xl border text-xs transition-all duration-300 relative overflow-hidden group cursor-pointer ${
                    isActive 
                      ? `${sector.activeColor} shadow-lg shadow-[#000]/40` 
                      : `bg-[#0e0e15] border-white/5 hover:border-white/10 ${sector.hoverColor}`
                  }`}
                >
                  {/* Icon + Count Row */}
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 group-hover:scale-110 transition duration-300">
                      {renderSectorIcon(sector.icon)}
                    </div>
                    {matchingCount > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold ${
                        isActive ? "bg-white/15 text-white" : "bg-white/5 text-neutral-400"
                      }`}>
                        {matchingCount}
                      </span>
                    )}
                  </div>

                  {/* Title & unique growth skills */}
                  <div className="font-bold text-neutral-200 group-hover:text-white transition">{sector.name}</div>
                  <div className="text-[10px] text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
                    {sector.skills.slice(0, 4).join(", ")}...
                  </div>

                  {/* Tiny selection check dot */}
                  {isActive && (
                    <div className="absolute top-2 right-2 flex items-center justify-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* 2. Section Role & Stage Filters row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-white/5 relative z-10">
            {/* Section Role Filter */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <LayoutGrid className="h-3.5 w-3.5 text-neutral-500" />
                <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">Filter by Role Sector</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["All Roles", "AI & Machine Learning", "Backend", "Frontend", "Cloud & DevOps", "Security & Web3"].map((role) => {
                  const roleKey = role === "All Roles" ? null : role;
                  const isActive = selectedRoleCategory === roleKey;
                  const count = roleKey 
                    ? jobCandidates.filter(c => getCandidateRoleCategory(c.skills, getJobTitleForCandidate(c.job_id)) === roleKey).length
                    : jobCandidates.length;

                  return (
                    <button
                      key={role}
                      id={`role-filter-${role.replace(/\s+/g, "-").toLowerCase()}`}
                      onClick={() => setSelectedRoleCategory(roleKey)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 cursor-pointer ${
                        isActive
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                          : "bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-neutral-200 border border-white/5"
                      }`}
                    >
                      {role} <span className="opacity-65 text-[10px] font-mono ml-0.5">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Funnel Section Stage Filter */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <SlidersHorizontal className="h-3.5 w-3.5 text-neutral-500" />
                <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">Filter by Section Stage</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "All Stages", key: null },
                  { label: "Applied", key: "applied" },
                  { label: "Screened", key: "screened" },
                  { label: "Shortlisted", key: "shortlisted" },
                  { label: "Interviewing", key: "interviewing" },
                  { label: "Offer Made", key: "offer" },
                  { label: "Hired", key: "hired" }
                ].map((stage) => {
                  const isActive = selectedStageFilter === stage.key;
                  const count = stage.key
                    ? jobCandidates.filter(c => getCandidateStage(c.id, c.match) === stage.key).length
                    : jobCandidates.length;

                  return (
                    <button
                      key={stage.label}
                      id={`stage-filter-${stage.label.replace(/\s+/g, "-").toLowerCase()}`}
                      onClick={() => setSelectedStageFilter(stage.key)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 cursor-pointer ${
                        isActive
                          ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                          : "bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-neutral-200 border border-white/5"
                      }`}
                    >
                      {stage.label} <span className="opacity-65 text-[10px] font-mono ml-0.5">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* FUNNEL LIST VIEW */}
        {activeSubView === "list" && (
          <div className="glass-panel rounded-2xl overflow-hidden shadow-xl animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-neutral-400 font-bold bg-white/2">
                    <th className="py-4 px-4 w-12 text-center">Compare</th>
                    <th className="py-4 px-5">Candidate Name & Stage</th>
                    <th className="py-4 px-5">Contact details</th>
                    <th className="py-4 px-5">Core parsed skills</th>
                    <th className="py-4 px-5">AI Fit Score</th>
                    <th className="py-4 px-5 text-right">Inspection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-neutral-450 text-xs font-semibold">
                        No candidates found matching the active filters or job requirements.
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((cand) => {
                      const match = cand.match;
                      const score = match?.overall_score || 0;
                      const stage = getCandidateStage(cand.id, match);
                      const isCompareChecked = compareIds.includes(cand.id);
                      
                      let scoreBadge = "bg-white/5 text-neutral-300 border-white/10";
                      let barColor = "bg-neutral-500";
                      if (score >= 85) {
                        scoreBadge = "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
                        barColor = "bg-emerald-500";
                      } else if (score >= 70) {
                        scoreBadge = "bg-blue-500/15 text-blue-400 border-blue-500/20";
                        barColor = "bg-blue-500";
                      } else if (score > 0) {
                        scoreBadge = "bg-amber-500/15 text-amber-400 border-amber-500/20";
                        barColor = "bg-amber-500";
                      }

                      return (
                        <tr key={cand.id} className="hover:bg-white/5 transition duration-150 group">
                          {/* Checkbox for Compare */}
                          <td className="py-4 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isCompareChecked}
                              onChange={() => toggleCompare(cand.id)}
                              className="h-3.5 w-3.5 accent-indigo-500 rounded border-white/10 bg-[#09090b]/40 cursor-pointer"
                              title="Select candidate for side-by-side comparison"
                            />
                          </td>

                          {/* Name and Degree */}
                          <td className="py-4 px-5">
                            <div className="font-bold text-white text-sm flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-neutral-400" />
                              <span>{cand.name}</span>
                            </div>
                            <div className="text-xs text-neutral-400 mt-1 flex items-center gap-1.5 font-semibold">
                              <GraduationCap className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                              <span className="truncate max-w-[200px]">{cand.education_summary}</span>
                            </div>
                            {/* Current Stage Tag */}
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-mono text-indigo-400 rounded">
                                Stage: {getStageLabel(stage)}
                              </span>
                              <select
                                value={stage}
                                onChange={(e) => updateCandidateStage(cand.id, e.target.value)}
                                className="bg-[#09090b]/80 text-[9px] text-neutral-400 border border-white/5 rounded px-1 cursor-pointer focus:outline-none"
                              >
                                <option value="applied">Applied</option>
                                <option value="screened">Screened</option>
                                <option value="shortlisted">Shortlisted</option>
                                <option value="interviewing">Interviewing</option>
                                <option value="offer">Offer</option>
                                <option value="hired">Hired</option>
                              </select>
                            </div>
                          </td>

                          {/* Contact info */}
                          <td className="py-4 px-5 space-y-1">
                            <div className="text-xs text-neutral-200 font-semibold">{cand.email}</div>
                            <div className="text-[10px] text-neutral-450 flex items-center gap-1 font-mono">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span>{cand.phone}</span>
                            </div>
                          </td>

                          {/* Core Skills parsed */}
                          <td className="py-4 px-5">
                            <div className="space-y-2">
                              {/* Future Technology / Growth Sector Badges */}
                              {(() => {
                                const matchedSectors = [];
                                if (isCandidateInSector(cand.skills, "AI & Agents")) matchedSectors.push("AI & Agents");
                                if (isCandidateInSector(cand.skills, "Web3 & Decentralized")) matchedSectors.push("Web3 & Decentralized");
                                if (isCandidateInSector(cand.skills, "Next-Gen Infrastructure")) matchedSectors.push("Next-Gen Infrastructure");
                                if (isCandidateInSector(cand.skills, "Quantum & HPC")) matchedSectors.push("Quantum & HPC");
                                if (isCandidateInSector(cand.skills, "AI Security & Trust")) matchedSectors.push("AI Security & Trust");

                                return matchedSectors.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 mb-1.5">
                                    {matchedSectors.map((sectorName) => {
                                      const sec = GROWTH_SECTORS.find(s => s.name === sectorName);
                                      return (
                                        <span key={sectorName} className="px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-[9px] text-indigo-400 font-bold rounded uppercase tracking-wider font-mono shrink-0 flex items-center gap-1 shadow-sm">
                                          {sec ? renderSectorIcon(sec.icon) : null}
                                          {sectorName}
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : null;
                              })()}

                              {/* Standard skills */}
                              <div className="flex flex-wrap gap-1 max-w-[280px]">
                                {cand.skills.slice(0, 5).map((skill, index) => (
                                  <span key={index} className="px-2 py-0.5 bg-white/5 border border-white/10 text-[10px] text-neutral-300 rounded-md font-mono font-semibold">
                                    {skill}
                                  </span>
                                ))}
                                {cand.skills.length > 5 && (
                                  <span className="text-[10px] text-neutral-450 self-center pl-1 font-mono font-bold">
                                    +{cand.skills.length - 5}
                                  </span>
                                )}
                              </div>

                              {/* Interactive future-tech injector for demo & real sandbox capabilities */}
                              {(() => {
                                const matchedSectors = [];
                                if (isCandidateInSector(cand.skills, "AI & Agents")) matchedSectors.push("AI & Agents");
                                if (isCandidateInSector(cand.skills, "Web3 & Decentralized")) matchedSectors.push("Web3 & Decentralized");
                                if (isCandidateInSector(cand.skills, "Next-Gen Infrastructure")) matchedSectors.push("Next-Gen Infrastructure");
                                if (isCandidateInSector(cand.skills, "Quantum & HPC")) matchedSectors.push("Quantum & HPC");
                                if (isCandidateInSector(cand.skills, "AI Security & Trust")) matchedSectors.push("AI Security & Trust");

                                return matchedSectors.length === 0 ? (
                                  <div className="mt-2 p-1.5 bg-[#0a0a0f] border border-[#ffffff08] rounded-lg max-w-[280px]">
                                    <div className="text-[9px] text-neutral-400 mb-1 flex items-center gap-1 font-semibold">
                                      <Sparkles className="h-2.5 w-2.5 text-indigo-400" />
                                      <span>Simulate resume tech growth:</span>
                                    </div>
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <button
                                        onClick={() => handleEnhanceSkills(cand.id, ["Generative AI", "LLMs", "RAG", "AI Agents", "LangChain"])}
                                        disabled={enhancingCandidateId !== null}
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 transition cursor-pointer disabled:opacity-50"
                                      >
                                        + AI Tech
                                      </button>
                                      <button
                                        onClick={() => handleEnhanceSkills(cand.id, ["Web3", "Solidity", "Rust", "Smart Contracts", "Cryptography"])}
                                        disabled={enhancingCandidateId !== null}
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 transition cursor-pointer disabled:opacity-50"
                                      >
                                        + Web3
                                      </button>
                                      <button
                                        onClick={() => handleEnhanceSkills(cand.id, ["Kubernetes", "Terraform", "Edge Computing", "Serverless"])}
                                        disabled={enhancingCandidateId !== null}
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition cursor-pointer disabled:opacity-50"
                                      >
                                        + Cloud
                                      </button>
                                    </div>
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </td>

                          {/* AI Match rating */}
                          <td className="py-4 px-5">
                            {match ? (
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 border text-[10px] font-bold rounded-full font-mono ${scoreBadge}`}>
                                  {score}%
                                </span>
                                <div className="hidden sm:block w-16 bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5">
                                  <div className={`h-full ${barColor}`} style={{ width: `${score}%` }} />
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-neutral-450 font-mono italic font-medium">Awaiting match...</span>
                            )}
                          </td>

                          {/* Inspection CTA */}
                          <td className="py-4 px-5 text-right">
                            <button
                              id={`inspect-candidate-btn-${cand.id}`}
                              onClick={() => onSelectCandidateForDetails(cand)}
                              className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold rounded-xl text-neutral-200 hover:text-white transition cursor-pointer flex items-center gap-1.5 ml-auto animate-fade-in"
                            >
                              <Award className="h-3.5 w-3.5 text-neutral-450" />
                              <span>Report Details</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PIPELINE KANBAN VIEW */}
        {activeSubView === "pipeline" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5 animate-fade-in items-start overflow-x-auto pb-4">
            {["applied", "screened", "shortlisted", "interviewing", "offer", "hired"].map((stageKey) => {
              const stageCandidates = filteredCandidates.filter(
                (c) => getCandidateStage(c.id, c.match) === stageKey
              );

              return (
                <div key={stageKey} className="bg-white/3 border border-white/5 p-3 rounded-2xl flex flex-col gap-3 min-w-[170px]">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-300 font-mono">
                      {getStageLabel(stageKey)}
                    </h4>
                    <span className="px-1.5 py-0.5 bg-white/5 text-[9px] font-mono text-neutral-400 rounded-md">
                      {stageCandidates.length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 min-h-[300px]">
                    {stageCandidates.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-white/5 rounded-xl flex items-center justify-center">
                        <p className="text-[10px] text-neutral-500 italic font-mono">Empty Column</p>
                      </div>
                    ) : (
                      stageCandidates.map((cand) => {
                        const score = cand.match?.overall_score || 0;
                        return (
                          <div
                            key={cand.id}
                            className="bg-[#0c0c10]/95 border border-white/10 p-3 rounded-xl hover:border-indigo-500/40 transition-all duration-300 relative group"
                          >
                            <div className="flex items-start justify-between gap-1.5 mb-1.5">
                              <h5 className="font-bold text-white text-xs truncate leading-snug">{cand.name}</h5>
                              {cand.match && (
                                <span className={`text-[9px] font-mono font-bold px-1 rounded ${
                                  score >= 85 ? "text-emerald-400 bg-emerald-500/10" : "text-indigo-400 bg-indigo-500/10"
                                }`}>
                                  {score}%
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-neutral-450 truncate">{cand.email}</p>

                            {/* Growth Sector indicator dots */}
                            {(() => {
                              const matchedSectors = [];
                              if (isCandidateInSector(cand.skills, "AI & Agents")) matchedSectors.push("AI & Agents");
                              if (isCandidateInSector(cand.skills, "Web3 & Decentralized")) matchedSectors.push("Web3 & Decentralized");
                              if (isCandidateInSector(cand.skills, "Next-Gen Infrastructure")) matchedSectors.push("Next-Gen Infrastructure");
                              if (isCandidateInSector(cand.skills, "Quantum & HPC")) matchedSectors.push("Quantum & HPC");
                              if (isCandidateInSector(cand.skills, "AI Security & Trust")) matchedSectors.push("AI Security & Trust");

                              return matchedSectors.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {matchedSectors.map(s => (
                                    <span key={s} className="px-1 py-0.5 bg-indigo-500/10 text-[8px] text-indigo-400 border border-indigo-500/10 rounded font-mono uppercase tracking-wider font-bold shrink-0">
                                      {s.split(" ")[0]}
                                    </span>
                                  ))}
                                </div>
                              ) : null;
                            })()}
                            
                            <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-2">
                              <select
                                value={stageKey}
                                onChange={(e) => updateCandidateStage(cand.id, e.target.value)}
                                className="bg-[#09090b]/80 border border-white/10 text-[9px] text-neutral-400 rounded px-1.5 py-0.5 cursor-pointer max-w-[85px] truncate"
                              >
                                <option value="applied">Applied</option>
                                <option value="screened">Screened</option>
                                <option value="shortlisted">Shortlist</option>
                                <option value="interviewing">Interview</option>
                                <option value="offer">Offer</option>
                                <option value="hired">Hired</option>
                              </select>
                              
                              <button
                                type="button"
                                onClick={() => onSelectCandidateForDetails(cand)}
                                className="p-1 hover:bg-white/5 rounded text-neutral-300 hover:text-white transition"
                                title="Open Candidate Report Detail"
                              >
                                <Award className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CANDIDATE COMPARISON DESK */}
        {activeSubView === "compare" && (
          <div className="space-y-4 animate-fade-in">
            {compareIds.length === 0 ? (
              <div className="text-center py-16 glass-panel rounded-2xl border border-dashed border-white/10">
                <Sparkles className="h-10 w-10 text-indigo-400 mx-auto mb-3 animate-pulse" />
                <h4 className="text-white font-bold text-sm">No candidates selected for comparison</h4>
                <p className="text-xs text-neutral-450 mt-1.5 max-w-sm mx-auto leading-relaxed">
                  Go to <b>Funnel List</b> or <b>Pipeline Kanban</b> and select checkboxes next to candidate profiles to compare up to 4 applicants side-by-side.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveSubView("list")}
                  className="mt-4 px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-neutral-300 transition cursor-pointer"
                >
                  Return to Funnel List
                </button>
              </div>
            ) : (
              <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                {/* Horizontal scroll support for comparison metrics */}
                <div className="overflow-x-auto">
                  <div className="flex divide-x divide-white/10 min-w-[700px]">
                    
                    {/* Header Row Metrics list labels */}
                    <div className="w-56 shrink-0 bg-[#0d0d12]/60 p-5 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 font-mono">Comparison Matrix</span>
                        <h4 className="text-sm font-extrabold text-white mt-1">Hiring Evaluation Desk</h4>
                        <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">Side-by-side screening data metrics generated by Gemini.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCompareIds([])}
                        className="text-left text-[10px] text-red-400 font-bold hover:underline"
                      >
                        Clear Comparison Slots
                      </button>
                    </div>

                    {/* Columns for chosen candidates */}
                    {compareIds.map((candId) => {
                      const cand = filteredCandidates.find((c) => c.id === candId);
                      if (!cand) return null;
                      const score = cand.match?.overall_score || 0;

                      return (
                        <div key={cand.id} className="flex-1 min-w-[200px] p-5 space-y-5 bg-[#09090b]/10 hover:bg-[#0c0c10]/20 transition duration-200">
                          {/* Profile Intro */}
                          <div className="border-b border-white/5 pb-4">
                            <h5 className="font-bold text-white text-sm">{cand.name}</h5>
                            <p className="text-[10px] text-neutral-400 truncate mt-0.5">{cand.email}</p>
                            <span className="inline-block px-2 py-0.5 bg-indigo-500/10 text-[9px] font-mono text-indigo-400 rounded mt-1.5">
                              Stage: {getStageLabel(getCandidateStage(cand.id, cand.match))}
                            </span>
                          </div>

                          {/* Fit score dial representation */}
                          <div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 font-mono block">AI Fit Score</span>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={`text-base font-extrabold px-2.5 py-0.5 rounded-lg font-mono ${
                                score >= 85 ? "text-emerald-400 bg-emerald-500/10" : "text-indigo-400 bg-indigo-500/10"
                              }`}>
                                {score ? `${score}%` : "Pending"}
                              </span>
                              <span className="text-[10px] text-neutral-450 font-medium">overall compatibility</span>
                            </div>
                          </div>

                          {/* Skills summary */}
                          <div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 font-mono block mb-1.5">Matched Core Skills</span>
                            <div className="flex flex-wrap gap-1">
                              {cand.skills.slice(0, 4).map((s, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-white/5 border border-white/10 text-[9px] text-neutral-200 rounded font-mono">
                                  {s}
                                </span>
                              ))}
                              {cand.skills.length > 4 && (
                                <span className="text-[9px] text-neutral-500 font-mono self-center">+{cand.skills.length - 4} more</span>
                              )}
                            </div>
                          </div>

                          {/* Academic Info */}
                          <div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 font-mono block">Academic Background</span>
                            <p className="text-xs text-neutral-300 mt-1 font-semibold leading-relaxed line-clamp-2" title={cand.education_summary}>
                              {cand.education_summary || "Not verified"}
                            </p>
                          </div>

                          {/* Career Summary */}
                          <div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 font-mono block">Experience Summary</span>
                            <p className="text-xs text-neutral-450 mt-1 leading-relaxed line-clamp-3">
                              {cand.experience_summary || "No career summary parsed."}
                            </p>
                          </div>

                          {/* Custom Recommendation overview */}
                          {cand.match && (
                            <div className="bg-white/2 p-3 border border-white/5 rounded-xl">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 font-mono block">AI Evaluation</span>
                              <p className="text-[11px] text-neutral-200 mt-1 font-medium leading-relaxed italic line-clamp-3">
                                "{cand.match.summary}"
                              </p>
                            </div>
                          )}

                          {/* CTA Detail check */}
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => onSelectCandidateForDetails(cand)}
                              className="w-full py-1.5 bg-[#09090b] hover:bg-indigo-600 border border-white/10 rounded-xl text-[11px] font-bold text-white transition-all cursor-pointer text-center"
                            >
                              Check Full Match Report
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
