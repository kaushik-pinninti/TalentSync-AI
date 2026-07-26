import { useState } from "react";
import { Award, BrainCircuit, Code, HelpCircle, Layers, Milestone, Plus, RefreshCw, Sparkles, UserCheck, Loader2, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { Candidate, InterviewQuestionItem, Job } from "../types";

interface InterviewSuiteProps {
  candidate: Candidate;
  job: Job;
  token: string;
}

export default function InterviewSuite({ candidate, job, token }: InterviewSuiteProps) {
  const [questions, setQuestions] = useState<InterviewQuestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("all");
  const [activeDifficultyFilter, setActiveDifficultyFilter] = useState("all");

  const fetchOrCreateInterviewSuite = async (forceRegen = false) => {
    setLoading(true);
    setError("");
    try {
      const url = `/api/candidates/${candidate.id}/questions`;
      const method = forceRegen ? "POST" : "GET"; // POST forces regeneration
      
      const res = await fetch(url, {
        method,
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate interview plan");
      }

      setQuestions(data.interviewPlan?.questions || []);
    } catch (err: any) {
      setError(err.message || "Failed to compile interview questions.");
    } finally {
      setLoading(false);
    }
  };

  // Trigger load on component mount or button action
  const handleLoadPlan = () => {
    fetchOrCreateInterviewSuite(false);
  };

  const handleRegeneratePlan = () => {
    if (confirm("Are you sure you want to regenerate the interview plan? This will leverage Gemini to draft completely new questions.")) {
      fetchOrCreateInterviewSuite(true);
    }
  };

  const filteredQuestions = questions.filter((q) => {
    const matchesCat = activeCategoryFilter === "all" || q.type === activeCategoryFilter;
    const matchesDiff = activeDifficultyFilter === "all" || q.difficulty === activeDifficultyFilter;
    return matchesCat && matchesDiff;
  });

  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-6 space-y-6 relative overflow-hidden shadow-2xl">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-5 relative z-10">
        <div>
          <span className="text-xs text-indigo-400 font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
            <BrainCircuit className="h-4 w-4" />
            AI Interview Panel Planner
          </span>
          <h2 className="text-lg font-black text-white mt-1.5 tracking-tight">
            Questions prepared for: <span className="text-indigo-450">{candidate.name}</span>
          </h2>
          <p className="text-xs text-neutral-450 mt-1">
            Evaluating capability alignment against the <span className="text-white font-semibold">{job.title}</span> role specifications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {questions.length > 0 ? (
            <button
              id="regenerate-questions-btn"
              onClick={handleRegeneratePlan}
              disabled={loading}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-indigo-400 ${loading ? "animate-spin" : ""}`} />
              <span>Regenerate Panel</span>
            </button>
          ) : (
            <button
              id="initialize-questions-btn"
              onClick={handleLoadPlan}
              disabled={loading}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition shadow-lg shadow-indigo-600/15 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
              )}
              <span>{loading ? "AI Planning..." : "Generate AI Interview Panel"}</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-semibold relative z-10">
          {error}
        </div>
      )}

      {loading && questions.length === 0 && (
        <div className="py-16 text-center space-y-4 relative z-10 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
          <p className="text-xs text-neutral-400 font-mono font-semibold">Analyzing candidate skills alignment & formulating tailored questions via Gemini...</p>
        </div>
      )}

      {questions.length === 0 && !loading && (
        <div className="py-12 text-center max-w-md mx-auto space-y-4 relative z-10">
          <div className="p-4 bg-white/5 border border-white/10 text-indigo-400 rounded-full w-14 h-14 flex items-center justify-center mx-auto shadow-md">
            <HelpCircle className="h-7 w-7" />
          </div>
          <h3 className="font-extrabold text-white text-base tracking-tight">Generate Tailored Interview Questions</h3>
          <p className="text-xs text-neutral-450 leading-relaxed">
            TalentSync AI will scan the candidate's resume keywords alongside your job specifications, generating unique technical, behavioral, and architectural screening questionnaires.
          </p>
          <button
            id="initial-generate-questions-btn"
            onClick={handleLoadPlan}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold rounded-xl text-white flex items-center gap-1.5 mx-auto cursor-pointer shadow-md shadow-indigo-600/15"
          >
            <Sparkles className="h-4 w-4" />
            <span>Generate Interview Plan</span>
          </button>
        </div>
      )}

      {questions.length > 0 && (
        <div className="space-y-6 relative z-10">
          {/* Filters Deck */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/3 p-3.5 rounded-2xl border border-white/5">
            {/* Category tabs */}
            <div className="flex flex-wrap gap-1">
              {[
                { id: "all", label: "All Categories" },
                { id: "technical", label: "Technical" },
                { id: "behavioral", label: "Behavioral" },
                { id: "coding", label: "Coding Scenario" },
                { id: "system_design", label: "System Design" },
                { id: "project", label: "Candidate-Project" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategoryFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                    activeCategoryFilter === tab.id
                      ? "bg-white/10 text-white border-white/15 shadow-md"
                      : "bg-transparent hover:bg-white/5 text-neutral-400 hover:text-white border-transparent"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Difficulty filter */}
            <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
              <Layers className="h-3.5 w-3.5 text-neutral-450" />
              <select
                id="difficulty-filter-select"
                value={activeDifficultyFilter}
                onChange={(e) => setActiveDifficultyFilter(e.target.value)}
                className="bg-[#09090b]/60 border border-white/10 px-3 py-1.5 text-xs text-white font-bold rounded-xl focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Questions list */}
          <div className="space-y-4">
            {filteredQuestions.length === 0 ? (
              <p className="text-center py-10 text-xs text-neutral-400 font-semibold italic">No questions match the selected filters.</p>
            ) : (
              filteredQuestions.map((q, index) => {
                let diffBadge = "bg-white/5 text-neutral-300 border-white/10";
                if (q.difficulty === "hard") {
                  diffBadge = "bg-rose-500/10 text-rose-400 border-rose-500/20";
                } else if (q.difficulty === "medium") {
                  diffBadge = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                } else if (q.difficulty === "easy") {
                  diffBadge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                }

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white/2 border border-white/5 rounded-2xl p-5 hover:border-white/10 hover:bg-white/3 transition duration-300 space-y-3.5"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-[9px] text-indigo-400 font-bold uppercase tracking-wider rounded-full font-mono">
                          {q.type.replace("_", " ")}
                        </span>
                        <span className={`px-2.5 py-0.5 border text-[9px] font-bold uppercase tracking-wider rounded-full font-mono ${diffBadge}`}>
                          {q.difficulty}
                        </span>
                      </div>
                      
                      <span className="text-[10px] text-neutral-500 font-extrabold font-mono uppercase tracking-wider">Question {index + 1}</span>
                    </div>

                    <h4 className="text-sm font-bold text-white leading-relaxed">
                      {q.question}
                    </h4>

                    <div className="bg-[#09090b]/40 p-4 rounded-xl border border-white/5 space-y-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5" />
                        Expected Answer & Evaluation Points
                      </span>
                      <p className="text-xs text-neutral-300 leading-relaxed font-semibold">
                        {q.expected_answer}
                      </p>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
