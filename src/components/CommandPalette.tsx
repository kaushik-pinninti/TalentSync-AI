import React, { useState, useEffect, useRef } from "react";
import { Search, Compass, Briefcase, User, Calendar, Settings, Bot, CornerDownLeft, Sparkles, X, Terminal } from "lucide-react";
import { Candidate } from "../types";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: Candidate[];
  onNavigate: (view: "dashboard" | "jobs" | "candidates" | "copilot" | "interviews" | "settings" | "notifications" | "documents") => void;
  onSelectCandidate: (candidate: Candidate) => void;
}

export default function CommandPalette({ isOpen, onClose, candidates, onNavigate, onSelectCandidate }: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Define static command options
  const staticCommands = [
    { id: "nav-dashboard", label: "Jump to Dashboard Hub", category: "Navigation", icon: Compass, action: () => onNavigate("dashboard") },
    { id: "nav-jobs", label: "Jump to Job Positions", category: "Navigation", icon: Briefcase, action: () => onNavigate("jobs") },
    { id: "nav-candidates", label: "Jump to Applicant Pools", category: "Navigation", icon: User, action: () => onNavigate("candidates") },
    { id: "nav-copilot", label: "Jump to AI Copilot Chat", category: "Navigation", icon: Bot, action: () => onNavigate("copilot") },
    { id: "nav-interviews", label: "Jump to Interview Suite", category: "Navigation", icon: Calendar, action: () => onNavigate("interviews") },
    { id: "nav-settings", label: "Jump to Diagnostic Settings", category: "Navigation", icon: Settings, action: () => onNavigate("settings") },
  ];

  // Map dynamic candidates based on search
  const candidateCommands = candidates.map(c => ({
    id: `cand-${c.id}`,
    label: `Inspect ${c.name} (AI Match Report)`,
    category: "Applicants",
    icon: Sparkles,
    action: () => {
      onNavigate("candidates");
      onSelectCandidate(c);
    }
  }));

  // Combine and filter commands
  const allCommands = [...staticCommands, ...candidateCommands];
  const filteredCommands = allCommands.filter(cmd =>
    cmd.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cmd.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Limit search results to keep layout pristine
  const visibleCommands = filteredCommands.slice(0, 10);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % visibleCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + visibleCommands.length) % visibleCommands.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (visibleCommands[selectedIndex]) {
          visibleCommands[selectedIndex].action();
          onClose();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, selectedIndex, visibleCommands, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-[#030303]/80 backdrop-blur-md">
      <div
        ref={containerRef}
        className="w-full max-w-xl bg-[#09090c]/90 border border-white/10 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden backdrop-blur-xl relative"
      >
        {/* Glow header banner */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

        {/* Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
          <Search className="h-5 w-5 text-neutral-450 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search an applicant profile..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-0 font-sans"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/10 bg-[#16161c] text-[9px] font-bold font-mono text-neutral-400">
            ESC
          </kbd>
        </div>

        {/* Action Options List */}
        <div className="max-h-[340px] overflow-y-auto p-2 space-y-1 scrollbar-thin">
          {visibleCommands.length > 0 ? (
            visibleCommands.map((cmd, index) => {
              const Icon = cmd.icon;
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  id={`cmd-item-${index}`}
                  type="button"
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                    isSelected ? "bg-indigo-600/20 border border-indigo-500/20 text-white" : "border border-transparent text-neutral-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-indigo-400" : "text-neutral-500"}`} />
                    <span className="text-xs font-semibold truncate">{cmd.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-neutral-400">
                      {cmd.category}
                    </span>
                    {isSelected && (
                      <CornerDownLeft className="h-3.5 w-3.5 text-neutral-500" />
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-8 text-center text-neutral-400 space-y-2">
              <Terminal className="h-8 w-8 text-neutral-500 mx-auto animate-pulse" />
              <p className="text-xs font-bold text-white">No command guidelines matched</p>
              <p className="text-[10px] text-neutral-500 font-medium">Verify spelling or filter tags.</p>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2 bg-[#060609]/60 border-t border-white/5 flex items-center justify-between text-[10px] text-neutral-500 font-semibold font-mono">
          <div className="flex items-center gap-2">
            <span>↑↓ Navigation</span>
            <span>•</span>
            <span>Enter Selection</span>
          </div>
          <span className="text-[9px] uppercase tracking-widest font-black text-neutral-400">TalentSync Core Command v1.1</span>
        </div>
      </div>
    </div>
  );
}
