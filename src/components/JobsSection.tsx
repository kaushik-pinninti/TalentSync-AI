import React, { useState } from "react";
import { Archive, Briefcase, Calendar, DollarSign, MapPin, Plus, Trash2, X, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "motion/react";
import { Job } from "../types";

interface JobsSectionProps {
  jobs: Job[];
  token: string;
  onRefreshJobs: () => void;
  onSelectJob: (job: Job) => void;
  selectedJob: Job | null;
}

export default function JobsSection({ jobs, token, onRefreshJobs, onSelectJob, selectedJob }: JobsSectionProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [experience, setExperience] = useState("");
  const [skills, setSkills] = useState("");
  const [education, setEducation] = useState("");
  const [salary, setSalary] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("Full-time");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // AI Generator specific states
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showAiOptions, setShowAiOptions] = useState(false);
  const [industry, setIndustry] = useState("Technology");
  const [companySize, setCompanySize] = useState("Mid-market");

  const handleAIGenerateSpec = async () => {
    if (!title || !experience) {
      setError("Please fill out at least Job Title and Required Experience before generating with AI.");
      return;
    }
    setAiGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/jobs/generate-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          experience,
          employmentType,
          skills,
          industry,
          location,
          companySize
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate job spec with AI");
      }

      if (data.generated) {
        const gen = data.generated;
        
        // Formulate Description from AI Output
        let formattedDesc = `JOB SUMMARY:\n${gen.summary}\n\n`;
        formattedDesc += `KEY RESPONSIBILITIES:\n${gen.responsibilities.map((r: string) => `• ${r}`).join("\n")}\n\n`;
        formattedDesc += `ROLE REQUIREMENTS:\n${gen.requirements.map((r: string) => `• ${r}`).join("\n")}\n\n`;
        if (gen.preferredSkills && gen.preferredSkills.length > 0) {
          formattedDesc += `PREFERRED QUALIFICATIONS:\n${gen.preferredSkills.map((r: string) => `• ${r}`).join("\n")}\n\n`;
        }
        formattedDesc += `BENEFITS & PERKS:\n${gen.benefits.map((b: string) => `• ${b}`).join("\n")}`;

        setDescription(formattedDesc);
        
        if (gen.salarySuggestion && !salary) {
          setSalary(gen.salarySuggestion);
        }
        
        // Suggest further skills if present
        if (gen.preferredSkills && gen.preferredSkills.length > 0) {
          const extractedSkills = gen.preferredSkills
            .map((s: string) => s.replace(/•\s*/, "").split(" ")[0])
            .filter((s: string) => s.length > 2 && s.length < 15)
            .slice(0, 3);
          
          if (extractedSkills.length > 0) {
            const currentSkills = skills ? skills.split(",").map(s => s.trim()) : [];
            const merged = Array.from(new Set([...currentSkills, ...extractedSkills])).filter(Boolean);
            setSkills(merged.join(", "));
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during AI spec generation.");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const skillsArr = skills.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          description,
          experience,
          skills: skillsArr,
          education,
          salary,
          location,
          employment_type: employmentType
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create job posting");
      }

      // Reset form & close
      setTitle("");
      setDescription("");
      setExperience("");
      setSkills("");
      setEducation("");
      setSalary("");
      setLocation("");
      setEmploymentType("Full-time");
      setShowCreateModal(false);
      onRefreshJobs();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJob = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this job posting? All applicants associated with this job will also be removed.")) return;
    
    try {
      const res = await fetch(`/api/jobs/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        onRefreshJobs();
        if (selectedJob?.id === id) {
          onSelectJob(null as any);
        }
      }
    } catch (err) {
      console.error("Delete job error:", err);
    }
  };

  const toggleArchiveJob = async (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = job.status === "active" ? "archived" : "active";
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        onRefreshJobs();
      }
    } catch (err) {
      console.error("Archive job error:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-neutral-900 dark:text-white tracking-tight">Job Offerings & Openings</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">Create postings and coordinate resume screenings</p>
        </div>
        <button
          id="create-new-job-btn"
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl text-sm font-semibold text-white flex items-center gap-2 cursor-pointer transition-all duration-300 shadow-lg shadow-indigo-600/15"
        >
          <Plus className="h-4 w-4" />
          <span>Post New Job Role</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Jobs list */}
        <div className="lg:col-span-2 space-y-4">
          {jobs.length === 0 ? (
            <div className="text-center py-12 glass-panel rounded-2xl">
              <Briefcase className="h-10 w-10 text-neutral-500 mx-auto mb-3 animate-pulse" />
              <p className="text-neutral-900 dark:text-neutral-200 font-bold">No job postings created yet</p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1.5 mb-4">Click "Post New Job Role" to start screening candidates</p>
            </div>
          ) : (
            jobs.map((job) => {
              const isSelected = selectedJob?.id === job.id;
              const isArchived = job.status === "archived";
              return (
                <div
                  id={`job-item-${job.id}`}
                  key={job.id}
                  onClick={() => onSelectJob(job)}
                  className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden group ${
                    isSelected
                      ? "bg-indigo-50/80 dark:bg-white/10 border-indigo-500/80 shadow-md shadow-indigo-500/5"
                      : "glass-panel border-neutral-200 dark:border-white/5 hover:border-neutral-300 dark:hover:border-white/15"
                  } ${isArchived ? "opacity-60" : ""}`}
                >
                  <div className="space-y-2 relative z-10">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-neutral-900 dark:text-white text-lg group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition duration-300">{job.title}</h3>
                      <span className="px-2.5 py-0.5 bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-[10px] text-neutral-700 dark:text-neutral-300 rounded-full font-mono uppercase font-semibold">
                        {job.employment_type}
                      </span>
                      {isArchived && (
                        <span className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-600 dark:text-amber-400 rounded-full font-semibold uppercase font-mono">
                          Archived
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-neutral-600 dark:text-neutral-400 flex-wrap">
                      <span className="flex items-center gap-1 font-medium">
                        <MapPin className="h-3.5 w-3.5 text-neutral-500" />
                        {job.location}
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <DollarSign className="h-3.5 w-3.5 text-neutral-500" />
                        {job.salary}
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="h-3.5 w-3.5 text-neutral-500" />
                        {new Date(job.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                      {job.skills.map((skill, index) => (
                        <span key={index} className="px-2.5 py-0.5 bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-xs text-neutral-700 dark:text-neutral-300 rounded-full font-semibold font-mono">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2 self-end md:self-center relative z-10">
                    <button
                      id={`archive-job-btn-${job.id}`}
                      onClick={(e) => toggleArchiveJob(job, e)}
                      title={isArchived ? "Unarchive Role" : "Archive Role"}
                      className="p-2 bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/15 border border-neutral-200 dark:border-white/10 rounded-xl text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition cursor-pointer"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                    <button
                      id={`delete-job-btn-${job.id}`}
                      onClick={(e) => handleDeleteJob(job.id, e)}
                      title="Delete Posting"
                      className="p-2 bg-neutral-100 dark:bg-white/5 hover:bg-red-500/20 border border-neutral-200 dark:border-white/10 rounded-xl text-neutral-700 dark:text-neutral-300 hover:text-red-500 dark:hover:text-red-400 transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Job Sidebar description details */}
        <div className="glass-panel rounded-2xl p-6 h-fit space-y-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          {selectedJob ? (
            <>
              <div className="border-b border-white/10 pb-4 relative z-10">
                <h3 className="font-extrabold text-white text-lg">{selectedJob.title}</h3>
                <span className="text-xs text-neutral-400 font-mono font-semibold">{selectedJob.employment_type} • {selectedJob.location}</span>
              </div>
              <div className="space-y-4 relative z-10">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 font-mono mb-1.5">Target Experience</h4>
                  <p className="text-sm text-neutral-200 font-medium">{selectedJob.experience}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 font-mono mb-1.5">Required Education</h4>
                  <p className="text-sm text-neutral-200 font-medium">{selectedJob.education}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 font-mono mb-1.5">Job Description</h4>
                  <p className="text-xs text-neutral-400 whitespace-pre-line leading-relaxed h-72 overflow-y-auto pr-1">
                    {selectedJob.description}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 relative z-10">
              <Briefcase className="h-8 w-8 text-neutral-500 mx-auto mb-2" />
              <p className="text-xs text-neutral-400 font-medium">Select a job posting on the left to inspect detailed specifications.</p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE JOB MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-[#0d0d12]/95 border border-white/15 rounded-2xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto custom-scrollbar"
          >
            <button
              id="close-create-job-modal-btn"
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 p-1.5 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-full transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-extrabold text-white mb-1">Create New Job Posting</h3>
            <p className="text-xs text-neutral-400 mb-4 font-medium">Specify recruitment requirements for resume scanning.</p>

            {/* AI Generator Integration Block */}
            <div className="mb-5 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex flex-col gap-3.5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
                <div>
                  <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider font-mono">Copilot Integration</span>
                  <h4 className="text-sm font-bold text-white mt-0.5 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    Write Spec with TalentSync AI
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                    Provide a Job Title and Experience, then click generate.
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    id="toggle-ai-gen-options-btn"
                    type="button"
                    onClick={() => setShowAiOptions(!showAiOptions)}
                    className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-350 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <span>Options</span>
                    {showAiOptions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  <button
                    id="ai-generate-job-spec-btn"
                    type="button"
                    onClick={handleAIGenerateSpec}
                    disabled={aiGenerating || !title || !experience}
                    className="px-4 py-2 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white rounded-xl flex items-center gap-2 cursor-pointer shrink-0 transition-all duration-300 shadow-md shadow-indigo-600/15"
                  >
                    {aiGenerating ? (
                      <>
                        <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 text-indigo-200 animate-pulse" />
                        <span>Generate with AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {showAiOptions && (
                <div className="pt-3 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10 animate-fade-in">
                  <div>
                    <label className="block text-[9px] font-bold text-neutral-400 mb-1.5 uppercase font-mono">Industry Focus</label>
                    <select
                      id="ai-industry-select"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full px-3.5 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                    >
                      <option value="Technology" className="bg-[#09090b]">Technology</option>
                      <option value="Finance & Banking" className="bg-[#09090b]">Finance & Banking</option>
                      <option value="Healthcare & Life Sciences" className="bg-[#09090b]">Healthcare & Life Sciences</option>
                      <option value="E-commerce & Retail" className="bg-[#09090b]">E-commerce & Retail</option>
                      <option value="Industrial & Energy" className="bg-[#09090b]">Industrial & Energy</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-neutral-400 mb-1.5 uppercase font-mono">Company Scale</label>
                    <select
                      id="ai-company-size-select"
                      value={companySize}
                      onChange={(e) => setCompanySize(e.target.value)}
                      className="w-full px-3.5 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                    >
                      <option value="Seed-stage Startup" className="bg-[#09090b]">Seed Startup (1-20)</option>
                      <option value="Growth-stage VC-backed" className="bg-[#09090b]">Growth VC (20-150)</option>
                      <option value="Mid-market Business" className="bg-[#09090b]">Mid-market (150-1000)</option>
                      <option value="Fortune 500 Enterprise" className="bg-[#09090b]">Global Enterprise (1000+)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateJob} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 mb-1.5 uppercase font-mono">Job Title</label>
                  <input
                    id="new-job-title"
                    type="text"
                    required
                    placeholder="Senior Full Stack Engineer"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:bg-[#09090b]/40 focus:border-indigo-500 transition-all duration-300"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 mb-1.5 uppercase font-mono">Employment Type</label>
                  <select
                    id="new-job-type"
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:bg-[#09090b]/40 focus:border-indigo-500 transition-all duration-300 cursor-pointer"
                  >
                    <option value="Full-time" className="bg-[#09090b]">Full-time</option>
                    <option value="Part-time" className="bg-[#09090b]">Part-time</option>
                    <option value="Contract" className="bg-[#09090b]">Contract</option>
                    <option value="Remote" className="bg-[#09090b]">Remote</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 mb-1.5 uppercase font-mono">Location</label>
                  <input
                    id="new-job-location"
                    type="text"
                    placeholder="San Francisco, CA / Remote"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:bg-[#09090b]/40 focus:border-indigo-500 transition-all duration-300"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 mb-1.5 uppercase font-mono">Salary Budget Range</label>
                  <input
                    id="new-job-salary"
                    type="text"
                    placeholder="$140,000 - $180,000 / year"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:bg-[#09090b]/40 focus:border-indigo-500 transition-all duration-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 mb-1.5 uppercase font-mono">Required Experience</label>
                  <input
                    id="new-job-experience"
                    type="text"
                    required
                    placeholder="5+ years of production experience"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:bg-[#09090b]/40 focus:border-indigo-500 transition-all duration-300"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 mb-1.5 uppercase font-mono">Target Education</label>
                  <input
                    id="new-job-education"
                    type="text"
                    required
                    placeholder="B.S. in Computer Science or equivalent experience"
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:bg-[#09090b]/40 focus:border-indigo-500 transition-all duration-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 mb-1.5 uppercase font-mono">Core Required Skills (Comma Separated)</label>
                <input
                  id="new-job-skills"
                  type="text"
                  required
                  placeholder="React, TypeScript, Node.js, PostgreSQL, AWS, Docker"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:bg-[#09090b]/40 focus:border-indigo-500 transition-all duration-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 mb-1.5 uppercase font-mono">Detailed Job Description</label>
                <textarea
                  id="new-job-desc"
                  rows={5}
                  required
                  placeholder="Provide responsibilities, day-to-day requirements, benefits, and tech stack alignment specifications..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:bg-[#09090b]/40 focus:border-indigo-500 transition-all duration-300 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  id="cancel-create-job-btn"
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2 bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  id="submit-create-job-btn"
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all duration-300 shadow-lg shadow-indigo-600/10"
                >
                  {loading ? (
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Publish Posting</span>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
