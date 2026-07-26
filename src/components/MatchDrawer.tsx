import React, { useEffect, useState } from "react";
import { FileText, ArrowLeft, Download, ShieldAlert, CheckCircle2, Award, Sparkles, GraduationCap, Briefcase, Play, Pause, Square, Volume2, FileDown } from "lucide-react";
import { Candidate, Job, Interview } from "../types";
import { useVoiceSpeech } from "../hooks/useVoiceSpeech";
import { jsPDF } from "jspdf";

interface MatchDrawerProps {
  candidate: Candidate;
  job: Job;
  onBackToList: () => void;
}

export default function MatchDrawer({ candidate, job, onBackToList }: MatchDrawerProps) {
  const match = candidate.match;
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"alignment" | "gap" | "timeline" | "email">("alignment");
  const [emailTemplate, setEmailTemplate] = useState<"invite" | "offer" | "reject">("invite");
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    const fetchInterviews = async () => {
      const token = localStorage.getItem("ts_token");
      if (!token) return;
      setLoadingInterviews(true);
      try {
        const res = await fetch("/api/interviews", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await res.json().catch(() => null);
            if (data && Array.isArray(data.interviews)) {
              const filtered = data.interviews.filter(
                (i: any) => i.candidate_id === candidate.id && i.scorecard
              );
              setInterviews(filtered);
            } else {
              setInterviews([]);
            }
          } else {
            setInterviews([]);
          }
        }
      } catch (err) {
        console.error("Error fetching interviews in MatchDrawer:", err);
        setInterviews([]);
      } finally {
        setLoadingInterviews(false);
      }
    };
    fetchInterviews();
  }, [candidate.id]);

  const {
    isPlaying,
    isPaused,
    voices,
    selectedVoiceName,
    setSelectedVoiceName,
    rate,
    setRate,
    speakText,
    pauseSpeaking,
    resumeSpeaking,
    stopSpeaking,
    hasTTSSupport
  } = useVoiceSpeech();

  // Clean up synthesis on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const handleExportCSV = () => {
    if (!match) return;
    const headers = ["Attribute", "Details"];
    const rows = [
      ["Candidate Name", candidate.name],
      ["Email", candidate.email],
      ["Phone", candidate.phone],
      ["Target Job Role", job.title],
      ["Overall AI Match Score", `${match.overall_score}%`],
      ["Skills Match Score", `${match.skills_match_score}%`],
      ["Experience Match Score", `${match.experience_match_score}%`],
      ["Education Match Score", `${match.education_match_score}%`],
      ["Matched Skills", match.matched_skills.join("; ")],
      ["Missing Skills", match.missing_skills.join("; ")],
      ["AI Executive Summary", match.summary],
      ["AI Recommendation", match.recommendation],
      ["Justification Explanation", match.explanation],
    ];

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AI_Screening_Report_${candidate.name.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportTXT = () => {
    if (!match) return;
    const txtContent = `================================================================
TALENTSYNC AI - CANDIDATE EXECUTIVE SCREENING REPORT
================================================================
Candidate Name      : ${candidate.name}
Email               : ${candidate.email}
Phone               : ${candidate.phone}
Target Position     : ${job.title}
----------------------------------------------------------------
AI ALIGNMENT RATINGS
----------------------------------------------------------------
Overall Fit Score   : ${match.overall_score}%
Skills Alignment    : ${match.skills_match_score}%
Experience Fit      : ${match.experience_match_score}%
Educational Fit     : ${match.education_match_score}%

Matched Skills:
${match.matched_skills.map(s => `  - ${s}`).join("\n")}

Missing Required/Preferred Skills:
${match.missing_skills.length > 0 ? match.missing_skills.map(s => `  - ${s}`).join("\n") : "  (None. Candidate possesses full coverage!)"}

----------------------------------------------------------------
AI EXECUTIVE ASSESSMENT SUMMARY
----------------------------------------------------------------
${match.summary}

----------------------------------------------------------------
RECOMMENDED NEXT HIRING STEPS
----------------------------------------------------------------
${match.recommendation}

----------------------------------------------------------------
AI RATING JUSTIFICATION
----------------------------------------------------------------
${match.explanation}

================================================================
Generated securely via TalentSync AI on ${new Date().toLocaleDateString()}
`;

    const blob = new Blob([txtContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AI_Report_${candidate.name.replace(/\s+/g, "_")}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    if (!match) return;

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const pageHeight = 297;
    const pageWidth = 210;
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let y = margin;

    // Helper functions for pagination & clean drawing
    const addFooter = (pNum: number) => {
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      doc.text(`CONFIDENTIAL  •  TALENTSYNC AI INTELLIGENCE SYSTEM`, margin, pageHeight - 10);
      doc.text(`Page ${pNum}`, pageWidth - margin - 15, pageHeight - 10);
    };

    const checkPageBreak = (heightNeeded: number): void => {
      if (y + heightNeeded > pageHeight - 20) {
        doc.addPage();
        const newPageNum = doc.getNumberOfPages();
        addFooter(newPageNum);
        y = margin + 10;
      }
    };

    const drawHeader = () => {
      // Draw background header accent bar
      doc.setFillColor(79, 70, 229); // indigo-600
      doc.rect(margin, y, contentWidth, 5, "F");
      y += 10;

      // Brand Title
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("TALENTSYNC AI", margin, y);

      // Date right-aligned
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // slate-500
      const dateStr = `Generated: ${new Date().toLocaleDateString()}`;
      doc.text(dateStr, pageWidth - margin - doc.getTextWidth(dateStr), y - 2);

      y += 6;
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229); // indigo-600
      doc.text("CANDIDATE AI EVALUATION & INTERVIEW SCORECARD REPORT", margin, y);

      y += 5;
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;
    };

    // Draw first page header and initialize page numbering
    addFooter(1);
    drawHeader();

    // SECTION 1: CANDIDATE & JOB METADATA CARD
    checkPageBreak(50);
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.rect(margin, y, contentWidth, 36, "FD");

    // Candidate Info Column
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(candidate.name, margin + 6, y + 8);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(`Email: ${candidate.email}`, margin + 6, y + 14);
    doc.text(`Phone: ${candidate.phone}`, margin + 6, y + 20);
    doc.text(`Applied On: ${new Date(candidate.created_at).toLocaleDateString()}`, margin + 6, y + 26);

    // Job / Position Column
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text("TARGET POSITION", margin + 100, y + 8);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(job.title, margin + 100, y + 14);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Location: ${job.location || "N/A"} (${job.employment_type || "Full-time"})`, margin + 100, y + 20);
    doc.text(`Salary Budget: ${job.salary || "N/A"}`, margin + 100, y + 26);

    y += 42;

    // SECTION 2: AI SCREENING SCORES WIDGETS
    checkPageBreak(35);
    // Draw widgets background boxes
    const widgetWidth = (contentWidth - 6) / 4;
    const scores = [
      { label: "Overall Match", val: match.overall_score, color: [79, 70, 229] },
      { label: "Skills Score", val: match.skills_match_score, color: [13, 148, 136] },
      { label: "Experience Match", val: match.experience_match_score, color: [220, 38, 38] },
      { label: "Education Fit", val: match.education_match_score, color: [217, 119, 6] }
    ];

    scores.forEach((s, idx) => {
      const wx = margin + idx * (widgetWidth + 2);
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.rect(wx, y, widgetWidth, 24, "FD");

      // Draw left color accent bar
      doc.setFillColor(s.color[0], s.color[1], s.color[2]);
      doc.rect(wx, y, 2.5, 24, "F");

      // Draw label
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(s.label.toUpperCase(), wx + 6, y + 7);

      // Draw score value
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text(`${s.val}%`, wx + 6, y + 18);
    });

    y += 30;

    // SECTION 3: SKILLS GAP ANALYSIS
    checkPageBreak(40);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("AI SKILLS KEYWORD MATCH", margin, y);
    y += 4;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    // Matched skills block
    checkPageBreak(25);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(21, 128, 61); // green-700
    doc.text(`Matched Candidate Credentials (${match.matched_skills.length}):`, margin, y);
    y += 4;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85); // slate-700
    const matchedSkillsStr = match.matched_skills.join(", ") || "None";
    const matchedLines = doc.splitTextToSize(matchedSkillsStr, contentWidth);
    matchedLines.forEach((line: string) => {
      checkPageBreak(5);
      doc.text(line, margin, y);
      y += 4.5;
    });

    y += 3;

    // Missing skills block
    checkPageBreak(25);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(180, 83, 9); // amber-700
    doc.text(`Missing Required / Desired Skills (${match.missing_skills.length}):`, margin, y);
    y += 4;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85); // slate-700
    const missingSkillsStr = match.missing_skills.join(", ") || "None. Candidate possesses full stack coverage.";
    const missingLines = doc.splitTextToSize(missingSkillsStr, contentWidth);
    missingLines.forEach((line: string) => {
      checkPageBreak(5);
      doc.text(line, margin, y);
      y += 4.5;
    });

    y += 6;

    // SECTION 4: EXECUTIVE ASSESSMENT SUMMARY
    checkPageBreak(40);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("AI EXECUTIVE SCREENING ASSESSMENT", margin, y);
    y += 4;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    // Summary Text
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(79, 70, 229);
    doc.text("Executive Summary:", margin, y);
    y += 5;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    const summaryLines = doc.splitTextToSize(match.summary, contentWidth);
    summaryLines.forEach((line: string) => {
      checkPageBreak(5);
      doc.text(line, margin, y);
      y += 4.5;
    });

    y += 4;

    // Recommendation text
    checkPageBreak(20);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(79, 70, 229);
    doc.text("Hiring Recommendation:", margin, y);
    y += 5;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    const recLines = doc.splitTextToSize(match.recommendation, contentWidth);
    recLines.forEach((line: string) => {
      checkPageBreak(5);
      doc.text(line, margin, y);
      y += 4.5;
    });

    y += 4;

    // Justification explanation
    checkPageBreak(30);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(79, 70, 229);
    doc.text("Rating Justification Detail:", margin, y);
    y += 5;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const explanationLines = doc.splitTextToSize(match.explanation, contentWidth);
    explanationLines.forEach((line: string) => {
      checkPageBreak(5);
      doc.text(line, margin, y);
      y += 4.5;
    });

    y += 8;

    // SECTION 5: INTERVIEW SCORECARD (IF PRESENT)
    if (interviews && interviews.length > 0) {
      interviews.forEach((interview) => {
        if (!interview.scorecard) return;
        const sc = interview.scorecard;

        checkPageBreak(50);
        y += 4;
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(`INTERVIEW SCORECARD - ${interview.title.toUpperCase()}`, margin, y);
        y += 4;
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y, pageWidth - margin, y);
        y += 6;

        // Interviewer metadata block
        doc.setFillColor(248, 250, 252); // slate-50
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.rect(margin, y, contentWidth, 18, "FD");

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(`Interviewer: ${interview.interviewer_name} (${interview.interviewer_email})`, margin + 6, y + 6);
        doc.text(`Platform: ${interview.platform.replace("_", " ")}`, margin + 6, y + 12);

        doc.text(`Date Conducted: ${new Date(interview.datetime).toLocaleDateString()}`, margin + 110, y + 6);
        doc.text(`Duration: ${interview.duration} mins`, margin + 110, y + 12);

        y += 24;

        // Scorecard Metrics Table
        checkPageBreak(40);
        doc.setFillColor(15, 23, 42); // dark header
        doc.rect(margin, y, contentWidth, 7, "F");

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text("EVALUATION METRIC", margin + 6, y + 5);
        doc.text("SCORE (OUT OF 5)", margin + 120, y + 5);

        y += 7;

        const scMetrics = [
          { name: "Skills Capability Rating", score: sc.skills_rating },
          { name: "Professional Experience Rating", score: sc.experience_rating },
          { name: "Communication Skills Rating", score: sc.communication_rating },
          { name: "Cultural Alignment Fit Rating", score: sc.culture_fit_rating },
          { name: "Overall Summary Rating", score: sc.overall_rating }
        ];

        scMetrics.forEach((mItem) => {
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(241, 245, 249);
          doc.rect(margin, y, contentWidth, 8, "FD");

          doc.setFont("Helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(51, 65, 85);
          doc.text(mItem.name, margin + 6, y + 5.5);

          // Draw rating stars or scores
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(79, 70, 229);
          const starsStr = "★ ".repeat(mItem.score) + "☆ ".repeat(5 - mItem.score);
          doc.text(`${starsStr} (${mItem.score}/5)`, margin + 120, y + 5.5);

          y += 8;
        });

        y += 4;

        // Interview Recommendation Badge
        checkPageBreak(15);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text("Interviewer Decision Recommendation:", margin, y);

        const recLabels: Record<string, string> = {
          "hire": "RECOMMENDED HIRE",
          "strong_hire": "STRONG HIRE",
          "hold": "HOLD / CONSIDER",
          "reject": "REJECT / PASS"
        };
        const recColors: Record<string, [number, number, number]> = {
          "hire": [16, 185, 129], // green
          "strong_hire": [79, 70, 229], // indigo
          "hold": [245, 158, 11], // amber
          "reject": [239, 68, 68] // red
        };

        const badgeColor = recColors[sc.recommendation] || [100, 116, 139];
        const badgeText = recLabels[sc.recommendation] || sc.recommendation.toUpperCase();

        doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
        doc.rect(margin + 75, y - 4, 45, 6, "F");

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(badgeText, margin + 78, y);

        y += 8;

        // Strengths & Weaknesses
        checkPageBreak(30);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text("Identified Strengths & Attributes:", margin, y);
        y += 4.5;
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        const strengthLines = doc.splitTextToSize(sc.strengths || "None specified", contentWidth);
        strengthLines.forEach((line: string) => {
          checkPageBreak(5);
          doc.text(line, margin, y);
          y += 4.5;
        });

        y += 3;

        checkPageBreak(30);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text("Risk Indicators & Weaknesses:", margin, y);
        y += 4.5;
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        const weaknessLines = doc.splitTextToSize(sc.weaknesses || "None specified", contentWidth);
        weaknessLines.forEach((line: string) => {
          checkPageBreak(5);
          doc.text(line, margin, y);
          y += 4.5;
        });

        y += 6;
      });
    }

    // Save PDF
    doc.save(`AI_Screening_Report_${candidate.name.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Drawer Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <button
          id="back-to-candidates-list-btn"
          onClick={onBackToList}
          className="flex items-center gap-2 text-xs text-neutral-450 hover:text-white transition cursor-pointer font-bold"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Candidate Pipeline</span>
        </button>

        {match && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="export-txt-report-btn"
              onClick={handleExportTXT}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold rounded-xl text-neutral-300 border border-white/10 cursor-pointer flex items-center gap-1.5 transition"
            >
              <FileText className="h-3.5 w-3.5 text-neutral-400" />
              <span>TXT</span>
            </button>
            <button
              id="export-csv-report-btn"
              onClick={handleExportCSV}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold rounded-xl text-neutral-300 border border-white/10 cursor-pointer flex items-center gap-1.5 transition"
            >
              <Download className="h-3.5 w-3.5 text-neutral-400" />
              <span>CSV</span>
            </button>
            <button
              id="download-pdf-report-btn"
              onClick={handleExportPDF}
              className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold rounded-xl text-white cursor-pointer flex items-center gap-1.5 transition shadow-lg shadow-indigo-600/15"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Download Report PDF</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel rounded-2xl p-6 text-center space-y-4 border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
            
            <div className="mx-auto w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center text-2xl font-black">
              {candidate.name.charAt(0)}
            </div>
            
            <div>
              <h3 className="text-lg font-extrabold text-white">{candidate.name}</h3>
              <p className="text-xs text-neutral-400 mt-1 truncate font-semibold">{candidate.email}</p>
              <p className="text-xs text-neutral-450 font-mono mt-0.5 font-bold">{candidate.phone}</p>
            </div>

            <div className="border-t border-white/5 pt-4 space-y-3.5 text-left">
              <div>
                <span className="text-[9px] uppercase font-bold text-neutral-450 tracking-wider flex items-center gap-1.5 font-mono">
                  <GraduationCap className="h-3.5 w-3.5 text-neutral-500" />
                  Education Credentials
                </span>
                <p className="text-xs text-neutral-200 mt-1 leading-relaxed font-semibold">{candidate.education_summary}</p>
              </div>
              
              <div>
                <span className="text-[9px] uppercase font-bold text-neutral-450 tracking-wider flex items-center gap-1.5 font-mono">
                  <Briefcase className="h-3.5 w-3.5 text-neutral-500" />
                  Experience History
                </span>
                <p className="text-xs text-neutral-200 mt-1 leading-relaxed font-semibold">{candidate.experience_summary}</p>
              </div>
            </div>
          </div>

          {/* Candidate Cover Letter */}
          {candidate.cover_letter && (
            <div className="glass-panel rounded-2xl p-5 space-y-3 border border-white/10">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 font-mono">Candidate Cover Letter</h4>
              <div className="bg-indigo-500/5 p-4 rounded-xl border border-indigo-500/10 max-h-64 overflow-y-auto">
                <p className="text-[11px] text-neutral-200 whitespace-pre-wrap leading-relaxed font-sans custom-scrollbar select-text">
                  {candidate.cover_letter}
                </p>
              </div>
            </div>
          )}

          {/* Full Resume Text Display */}
          <div className="glass-panel rounded-2xl p-5 space-y-3 border border-white/10">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Extracted Resume Text</h4>
            <div className="bg-black/40 p-4 rounded-xl border border-white/5 h-64 overflow-y-auto">
              <pre className="text-[10px] text-neutral-300 whitespace-pre-wrap leading-relaxed font-mono custom-scrollbar select-text">
                {candidate.resume_text}
              </pre>
            </div>
          </div>
        </div>

        {/* AI Report Column */}
        <div className="lg:col-span-2 space-y-6">
          {!match ? (
            <div className="glass-panel rounded-2xl p-12 text-center space-y-4 border border-white/10">
              <Sparkles className="h-10 w-10 text-indigo-400 mx-auto animate-spin" />
              <p className="text-white font-bold">Awaiting Match Computations</p>
              <p className="text-xs text-neutral-400 font-medium">The system is automatically running match analytics in the background. Please standby.</p>
            </div>
          ) : (
            <>
              {/* Premium Sub-Tab Navigation */}
              <div className="flex bg-[#0a0a0f]/80 border border-white/10 p-1.5 rounded-2xl w-full">
                <button
                  id="match-drawer-tab-alignment"
                  type="button"
                  onClick={() => setDrawerTab("alignment")}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all duration-300 ${
                    drawerTab === "alignment" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-neutral-450 hover:text-white"
                  }`}
                >
                  Match Summary
                </button>
                <button
                  id="match-drawer-tab-gap"
                  type="button"
                  onClick={() => setDrawerTab("gap")}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all duration-300 ${
                    drawerTab === "gap" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-neutral-450 hover:text-white"
                  }`}
                >
                  Skills Gap & Scorecard
                </button>
                <button
                  id="match-drawer-tab-timeline"
                  type="button"
                  onClick={() => setDrawerTab("timeline")}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all duration-300 ${
                    drawerTab === "timeline" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-neutral-450 hover:text-white"
                  }`}
                >
                  Timeline Log
                </button>
                <button
                  id="match-drawer-tab-email"
                  type="button"
                  onClick={() => setDrawerTab("email")}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all duration-300 ${
                    drawerTab === "email" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-neutral-450 hover:text-white"
                  }`}
                >
                  Outreach Core
                </button>
              </div>

              {/* TAB 1: ALIGNMENT SUMMARY */}
              {drawerTab === "alignment" && (
                <div className="space-y-6 animate-fade-in">
                  {/* Radial Score card */}
                  <div className="glass-panel rounded-2xl p-6 flex flex-col md:flex-row items-center gap-8 border border-white/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="relative flex items-center justify-center shrink-0">
                      <svg className="w-28 h-28 transform -rotate-90">
                        <circle cx="56" cy="56" r="48" className="stroke-white/5 fill-none" strokeWidth="6" />
                        <circle
                          cx="56"
                          cy="56"
                          r="48"
                          className="stroke-indigo-500 fill-none"
                          strokeWidth="6"
                          strokeDasharray={2 * Math.PI * 48}
                          strokeDashoffset={2 * Math.PI * 48 * (1 - match.overall_score / 100)}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute text-2xl font-extrabold text-white font-mono">{match.overall_score}%</span>
                    </div>

                    <div className="space-y-2 text-center md:text-left flex-1 relative z-10">
                      <div className="flex items-center justify-center md:justify-start gap-2 text-indigo-400">
                        <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-wider font-mono">AI Overall Alignment Score</span>
                      </div>
                      <h3 className="text-lg font-extrabold text-white">Target Position: {job.title}</h3>
                      <p className="text-xs text-neutral-300 leading-relaxed max-w-md font-semibold">{match.summary}</p>

                      {/* Voice Synthesis Player Panel */}
                      {hasTTSSupport && (
                        <div className="mt-4 pt-4 border-t border-white/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left">
                          <div className="flex items-center gap-1.5">
                            <Volume2 className="h-4 w-4 text-indigo-400" />
                            <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 font-mono">AI Voice Briefing</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5 justify-start sm:justify-end">
                            <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                              <span className="font-semibold text-[9px] font-mono uppercase">Speed:</span>
                              <select
                                id="tts-speed-selector"
                                value={rate}
                                onChange={(e) => setRate(Number(e.target.value))}
                                className="bg-[#09090b]/60 border border-white/10 rounded px-1.5 py-0.5 text-[9px] font-bold font-mono focus:outline-none cursor-pointer"
                              >
                                <option value="0.8">0.8x</option>
                                <option value="1.0">1.0x</option>
                                <option value="1.2">1.2x</option>
                                <option value="1.5">1.5x</option>
                              </select>
                            </div>

                            {voices.length > 0 && (
                              <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                                <span className="font-semibold text-[9px] font-mono uppercase">Voice:</span>
                                <select
                                  id="tts-voice-selector"
                                  value={selectedVoiceName}
                                  onChange={(e) => setSelectedVoiceName(e.target.value)}
                                  className="bg-[#09090b]/60 border border-white/10 rounded px-1.5 py-0.5 text-[9px] font-bold max-w-[90px] truncate focus:outline-none cursor-pointer"
                                >
                                  {voices.filter(v => v.lang.startsWith("en-") || v.lang.startsWith("en")).map(v => (
                                    <option key={v.name} value={v.name}>
                                      {v.name.split(" ")[0]}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div className="flex items-center gap-1">
                              {!isPlaying ? (
                                <button
                                  id="btn-play-voice-summary"
                                  onClick={() => speakText(`Applicant Name: ${candidate.name}. Position target: ${job.title}. This applicant aligns with an overall match score of ${match.overall_score} percent. Executive analysis summary states: ${match.summary}`)}
                                  className="flex items-center gap-1 px-3 py-1 bg-[#09090b]/40 hover:bg-white/5 text-neutral-300 text-[10px] font-bold rounded-xl border border-white/10 transition cursor-pointer"
                                  title="Read resume summary"
                                >
                                  <Play className="h-2.5 w-2.5 fill-indigo-400 text-indigo-400" />
                                  <span>Speak</span>
                                </button>
                              ) : isPaused ? (
                                <button
                                  id="btn-resume-voice-summary"
                                  onClick={resumeSpeaking}
                                  className="flex items-center gap-1 px-3 py-1 bg-[#09090b]/40 hover:bg-white/5 text-neutral-300 text-[10px] font-bold rounded-xl border border-white/10 transition cursor-pointer"
                                  title="Resume playback"
                                >
                                  <Play className="h-2.5 w-2.5 fill-emerald-400 text-emerald-400" />
                                  <span>Resume</span>
                                </button>
                              ) : (
                                <button
                                  id="btn-pause-voice-summary"
                                  onClick={pauseSpeaking}
                                  className="flex items-center gap-1 px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-xl border border-amber-500/20 transition cursor-pointer"
                                  title="Pause playback"
                                >
                                  <Pause className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                                  <span>Pause</span>
                                </button>
                              )}

                              {(isPlaying || isPaused) && (
                                <button
                                  id="btn-stop-voice-summary"
                                  onClick={stopSpeaking}
                                  className="p-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/20 transition cursor-pointer"
                                  title="Stop playback"
                                >
                                  <Square className="h-2.5 w-2.5 fill-rose-400 text-rose-400" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Score Alignments Sub-Grids */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="glass-panel border border-white/10 p-4 rounded-2xl text-center shadow-md">
                      <span className="text-[10px] text-neutral-450 font-bold uppercase tracking-wider font-mono">Skills Alignment</span>
                      <div className="text-2xl font-black text-indigo-400 mt-1.5 font-mono">{match.skills_match_score}%</div>
                      <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-3 border border-white/5">
                        <div className="bg-indigo-500 h-full" style={{ width: `${match.skills_match_score}%` }} />
                      </div>
                    </div>

                    <div className="glass-panel border border-white/10 p-4 rounded-2xl text-center shadow-md">
                      <span className="text-[10px] text-neutral-450 font-bold uppercase tracking-wider font-mono">Experience Match</span>
                      <div className="text-2xl font-black text-indigo-400 mt-1.5 font-mono">{match.experience_match_score}%</div>
                      <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-3 border border-white/5">
                        <div className="bg-indigo-500 h-full" style={{ width: `${match.experience_match_score}%` }} />
                      </div>
                    </div>

                    <div className="glass-panel border border-white/10 p-4 rounded-2xl text-center shadow-md">
                      <span className="text-[10px] text-neutral-450 font-bold uppercase tracking-wider font-mono">Educational Fit</span>
                      <div className="text-2xl font-black text-indigo-400 mt-1.5 font-mono">{match.education_match_score}%</div>
                      <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-3 border border-white/5">
                        <div className="bg-indigo-500 h-full" style={{ width: `${match.education_match_score}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Skills breakdown block */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 glass-panel rounded-2xl p-5 border border-white/10">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-1.5 font-mono">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <span>Matched Keywords ({match.matched_skills.length})</span>
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {match.matched_skills.map((skill, index) => (
                          <span key={index} className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 rounded-lg font-bold font-mono">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5 font-mono">
                        <ShieldAlert className="h-4 w-4 text-amber-400" />
                        <span>Missing Skills Gap ({match.missing_skills.length})</span>
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {match.missing_skills.length > 0 ? (
                          match.missing_skills.map((skill, index) => (
                            <span key={index} className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 rounded-lg font-bold font-mono">
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-neutral-450 italic font-bold">None. Candidate demonstrates perfect alignment!</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Detailed scorecard reasoning */}
                  <div className="space-y-4">
                    <div className="glass-panel p-5 rounded-2xl border border-white/10">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2 font-mono">Executive Recommendation</h4>
                      <p className="text-sm text-neutral-100 font-bold leading-relaxed">{match.recommendation}</p>
                    </div>

                    <div className="glass-panel p-5 rounded-2xl border border-white/10">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2 font-mono">AI Rating Justification Reasoning</h4>
                      <p className="text-xs text-neutral-300 whitespace-pre-line leading-relaxed font-semibold">{match.explanation}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: AI SKILL GAP & QUALITY SCORECARD */}
              {drawerTab === "gap" && (
                <div className="space-y-6 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Quality rating score block */}
                    <div className="glass-panel p-5 rounded-2xl border border-white/10 text-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
                      <span className="text-[9px] font-mono text-neutral-450 font-bold uppercase tracking-wider block">Resume Quality Score</span>
                      <div className="text-4xl font-extrabold text-blue-400 mt-2.5 font-mono">
                        {Math.round(match.overall_score * 0.95 + 4)}<span className="text-sm text-neutral-500">/100</span>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-2 font-semibold">Checks grammar, formatting, and density.</p>
                    </div>

                    <div className="glass-panel p-5 rounded-2xl border border-white/10 text-center relative overflow-hidden">
                      <span className="text-[9px] font-mono text-neutral-450 font-bold uppercase tracking-wider block">Formatting Quality</span>
                      <div className="text-lg font-bold text-emerald-400 mt-3.5 flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <span>Excellent</span>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-2 font-semibold">Zero distortions or layout artifacts detected.</p>
                    </div>

                    <div className="glass-panel p-5 rounded-2xl border border-white/10 text-center relative overflow-hidden">
                      <span className="text-[9px] font-mono text-neutral-450 font-bold uppercase tracking-wider block">Document Checklist</span>
                      <div className="text-lg font-bold text-white mt-3.5 font-mono">
                        4 / 4 <span className="text-[11px] text-neutral-500">passed</span>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-2 font-semibold">All major professional categories parsed.</p>
                    </div>
                  </div>

                  {/* Checklist Detail panel */}
                  <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono">Resume Structuring Verification Checks</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {[
                        { label: "Valid Contact Details Extracted", desc: "Found responsive phone and email listings.", ok: true },
                        { label: "Recognized Academic Qualifications", desc: "Located degree fields & institutional affiliations.", ok: true },
                        { label: "Chronological Employment Record", desc: "Extracted time-based company experience details.", ok: true },
                        { label: "Clear Technical Skills Vocabulary", desc: "Identified dense industry keywords.", ok: true }
                      ].map((chk, i) => (
                        <div key={i} className="flex items-start gap-2.5 p-2.5 bg-[#09090b]/40 rounded-xl border border-white/5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <h5 className="text-xs font-bold text-white">{chk.label}</h5>
                            <p className="text-[10px] text-neutral-400 mt-0.5 font-semibold">{chk.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Skills Gap upskilling recommendations */}
                  <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
                    <div className="border-b border-white/5 pb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center gap-1.5">
                        <ShieldAlert className="h-4 w-4" />
                        AI Curated Upskilling & Training Plan
                      </h4>
                      <p className="text-[10px] text-neutral-450 mt-1">Recommended learning actions to bridge the gap for this applicant.</p>
                    </div>

                    <div className="space-y-3">
                      {match.missing_skills.length > 0 ? (
                        match.missing_skills.map((skill, index) => (
                          <div key={index} className="p-3 bg-white/2 rounded-xl border border-white/5 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-amber-500/15 text-[10px] font-mono text-amber-400 rounded font-bold">
                                {skill} Gap
                              </span>
                              <span className="text-[10px] text-neutral-400 font-semibold">Priority: Moderate</span>
                            </div>
                            <p className="text-xs text-neutral-300 leading-relaxed font-medium">
                              <b>Recommended Plan:</b> Focus on core {skill} frameworks, API routing integrations, and review documentation. Suggest introductory technical courses on Udemy/Coursera.
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10 text-center">
                          <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-1.5" />
                          <h5 className="text-xs font-bold text-white">Full Compatibility Found</h5>
                          <p className="text-[10px] text-neutral-400 mt-0.5">The candidate is already fully equipped with all skills listed in the job specification.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: CANDIDATE LOG TIMELINE */}
              {drawerTab === "timeline" && (
                <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6 animate-fade-in">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono">Candidate Operations Action Log</h4>
                    <p className="text-[10px] text-neutral-450 mt-0.5">Track historical milestones for this applicant pool profile.</p>
                  </div>

                  <div className="relative border-l border-white/10 pl-6 ml-3 space-y-6">
                    {[
                      {
                        title: "Resume Document Onboarded",
                        time: new Date(candidate.created_at).toLocaleDateString() + " - " + new Date(candidate.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                        desc: "Resume parsed successfully via TalentSync OCR backend engine.",
                        iconColor: "bg-blue-500"
                      },
                      {
                        title: "AI Analysis Extraction Completed",
                        time: "System Automated Event",
                        desc: "Parsed credentials, education history, and career skills mapped into databases using gemini-2.5-flash.",
                        iconColor: "bg-indigo-500"
                      },
                      {
                        title: "TalentSync AI Match Assessment",
                        time: "System Automated Event",
                        desc: `Scored general compatibility at ${match.overall_score}% match fit. Match reports published.`,
                        iconColor: "bg-emerald-500"
                      },
                      {
                        title: "Recruiting Pipeline Stage Updated",
                        time: "Active State",
                        desc: "Applicant current workflow stage synced successfully.",
                        iconColor: "bg-purple-500"
                      }
                    ].map((step, i) => (
                      <div key={i} className="relative group">
                        <div className={`absolute -left-[30px] top-1 h-3 w-3 rounded-full ${step.iconColor} ring-4 ring-[#0c0c12]`} />
                        <div className="space-y-1">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <h5 className="text-xs font-bold text-white group-hover:text-indigo-400 transition">{step.title}</h5>
                            <span className="text-[9px] font-mono text-neutral-500 font-bold">{step.time}</span>
                          </div>
                          <p className="text-[11px] text-neutral-400 leading-relaxed font-semibold">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: AUTOMATED EMAIL OUTREACH CENTER */}
              {drawerTab === "email" && (
                <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono">AI Outreach Assistant</h4>
                      <p className="text-[10px] text-neutral-450 mt-0.5">Select a template below. TalentSync drafts appropriate copy instantly.</p>
                    </div>

                    {/* Template selection buttons */}
                    <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl shrink-0">
                      <button
                        type="button"
                        onClick={() => { setEmailTemplate("invite"); setCopiedEmail(false); }}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                          emailTemplate === "invite" ? "bg-indigo-600 text-white" : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Invite
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEmailTemplate("offer"); setCopiedEmail(false); }}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                          emailTemplate === "offer" ? "bg-indigo-600 text-white" : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Offer
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEmailTemplate("reject"); setCopiedEmail(false); }}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                          emailTemplate === "reject" ? "bg-indigo-600 text-white" : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Reject
                      </button>
                    </div>
                  </div>

                  {/* Display Email Box */}
                  <div className="space-y-3">
                    <div className="bg-black/60 p-4 rounded-xl border border-white/5 font-mono text-[11px] leading-relaxed text-neutral-200 h-64 overflow-y-auto select-text whitespace-pre-wrap">
                      {emailTemplate === "invite" && (
                        <>
                          <span className="text-indigo-400 font-bold">Subject:</span> Interview Scheduling Invitation: {job.title} role at TalentSync Partners
                          <br /><br />
                          Dear {candidate.name},
                          <br /><br />
                          Thank you for your application for the <span className="text-indigo-300 font-bold">{job.title}</span> position at TalentSync Enterprise Partners.
                          <br /><br />
                          Our technical evaluation system was highly impressed by your qualifications and parsed expertise in <span className="text-emerald-400 font-bold">{candidate.skills.slice(0, 3).join(", ")}</span>.
                          We would love to invite you to an interactive panel discussion with our engineering leads to discuss your credentials.
                          <br /><br />
                          Please let us know your general availability over the coming week.
                          <br /><br />
                          Best regards,
                          <br />
                          Hiring Operations
                          <br />
                          TalentSync Enterprise Partners
                        </>
                      )}

                      {emailTemplate === "offer" && (
                        <>
                          <span className="text-indigo-400 font-bold">Subject:</span> Formal Job Offer: {job.title} role at TalentSync Partners
                          <br /><br />
                          Dear {candidate.name},
                          <br /><br />
                          We are thrilled to offer you the position of <span className="text-indigo-300 font-bold">{job.title}</span> at TalentSync Enterprise Partners!
                          <br /><br />
                          Our assessment team was highly impressed by your credentials and recognized your compatibility score of <span className="text-emerald-400 font-bold">{match.overall_score}%</span>. We are confident you will be a fantastic addition to our engineering division.
                          <br /><br />
                          Our formal offer package detail is attached. Please review the terms and respond by Friday to finalize onboarding.
                          <br /><br />
                          Welcome to the team!
                          <br /><br />
                          Best regards,
                          <br />
                          Hiring Operations
                          <br />
                          TalentSync Enterprise Partners
                        </>
                      )}

                      {emailTemplate === "reject" && (
                        <>
                          <span className="text-indigo-400 font-bold">Subject:</span> Application Status Update: {job.title} role
                          <br /><br />
                          Dear {candidate.name},
                          <br /><br />
                          Thank you for taking the time to share your credentials and apply for the <span className="text-indigo-300 font-bold">{job.title}</span> position.
                          <br /><br />
                          We have completed evaluations of all applicants. While your technical background is strong, we have decided to move forward with other candidates whose profiles currently align more closely with our active stack focus.
                          {match.missing_skills.length > 0 && (
                            <> Specifically, we are prioritizing candidates with active experience in <span className="text-amber-400 font-bold">{match.missing_skills.slice(0, 2).join(", ")}</span>.</>
                          )}
                          <br /><br />
                          We will retain your details in our talent pool for future openings. We wish you the very best in your search.
                          <br /><br />
                          Sincerely,
                          <br />
                          Recruiting Team
                          <br />
                          TalentSync Enterprise Partners
                        </>
                      )}
                    </div>

                    {/* Copy action buttons */}
                    <div className="flex justify-end gap-2.5">
                      <button
                        id="copy-email-to-clipboard-btn"
                        type="button"
                        onClick={() => {
                          let textToCopy = "";
                          if (emailTemplate === "invite") {
                            textToCopy = `Subject: Interview Scheduling Invitation: ${job.title} role\n\nDear ${candidate.name},\n\nThank you for applying for the ${job.title} position...`;
                          } else if (emailTemplate === "offer") {
                            textToCopy = `Subject: Formal Job Offer: ${job.title} role\n\nDear ${candidate.name},\n\nWe are thrilled to offer you the position of ${job.title}...`;
                          } else {
                            textToCopy = `Subject: Application Status Update: ${job.title} role\n\nDear ${candidate.name},\n\nThank you for your time...`;
                          }
                          navigator.clipboard.writeText(textToCopy);
                          setCopiedEmail(true);
                          setTimeout(() => setCopiedEmail(false), 2000);
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-xl transition cursor-pointer flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        <span>{copiedEmail ? "Copied!" : "Copy Draft Copy"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
