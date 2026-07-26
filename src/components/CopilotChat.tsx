import React, { useState, useRef, useEffect } from "react";
import { Bot, Send, Sparkles, User, ChevronRight, Mic, MicOff, Square, Volume2, VolumeX, Settings, MessageSquare, Radio, Headphones, RefreshCw } from "lucide-react";
import { ChatMessage } from "../types";
import { useVoiceSpeech } from "../hooks/useVoiceSpeech";

interface CopilotChatProps {
  token: string;
}

export default function CopilotChat({ token }: CopilotChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-msg",
      role: "model",
      content: "Hello! I am your AI Recruiter Copilot. I have full context on your published jobs and candidates. You can ask me to:\n\n- Find the best candidates for any role\n- Compare Alice and Bob\n- Identify React/Node skills in your pipeline\n- Draft custom interview briefs\n\nHow can I support your recruiting workflow today?",
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [isSiriMode, setIsSiriMode] = useState(false);
  const [handsFreeActive, setHandsFreeActive] = useState(true);

  const {
    isListening,
    transcript,
    setTranscript,
    startListening,
    stopListening,
    isPlaying,
    voices,
    selectedVoiceName,
    setSelectedVoiceName,
    rate,
    setRate,
    speakText,
    stopSpeaking,
    hasSTTSupport,
    hasTTSSupport
  } = useVoiceSpeech();

  // Sync transcript to chat input
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Handle auto-submitting in Siri Mode when speech recognition stops
  const prevListeningRef = useRef(isListening);
  useEffect(() => {
    if (isSiriMode && prevListeningRef.current && !isListening && transcript.trim()) {
      handleSendMessage(transcript);
      setTranscript("");
    }
    prevListeningRef.current = isListening;
  }, [isListening, transcript, isSiriMode]);

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const toggleSiriMode = () => {
    const nextState = !isSiriMode;
    setIsSiriMode(nextState);
    if (nextState) {
      setAutoSpeak(true);
      stopSpeaking();
      setTimeout(() => {
        speakText("Siri Recruiting Assistant is active. Tap the orb or say something to begin.");
      }, 300);
    } else {
      stopSpeaking();
    }
  };
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Load chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch("/api/copilot/history", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.history && data.history.length > 0) {
            const mapped: ChatMessage[] = data.history.map((h: any) => ({
              id: `msg-${h.id}`,
              role: h.role,
              content: h.content,
              timestamp: h.created_at || new Date().toISOString()
            }));
            setMessages(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      }
    };
    loadHistory();
  }, [token]);

  // Clear chat history
  const handleClearHistory = async () => {
    if (window.confirm("Are you sure you want to clear your conversation history? This cannot be undone.")) {
      try {
        const res = await fetch("/api/copilot/history", {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          setMessages([
            {
              id: "welcome-msg",
              role: "model",
              content: "Hello! I am your AI Recruiter Copilot. I have full context on your published jobs and candidates. You can ask me to:\n\n- Find the best candidates for any role\n- Compare Alice and Bob\n- Identify React/Node skills in your pipeline\n- Draft custom interview briefs\n\nHow can I support your recruiting workflow today?",
              timestamp: new Date().toISOString()
            }
          ]);
        }
      } catch (err) {
        console.error("Failed to clear chat history:", err);
      }
    }
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      // Build history payload omitting current message & welcome text
      const history = updatedMessages
          .filter(m => m.id !== "welcome-msg")
          .map((m) => ({
            role: m.role,
            content: m.content
          }));

      const res = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          message: textToSend,
          history
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to contact AI Copilot");
      }

      // Read response body stream chunk-by-chunk
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("No reader stream returned from the server.");
      }

      const decoder = new TextDecoder();
      let aiContent = "";
      const aiMsgId = `ai-${Date.now()}`;

      // Create placeholder AI message in list
      setMessages((prev) => [
        ...prev,
        {
          id: aiMsgId,
          role: "model",
          content: "",
          timestamp: new Date().toISOString()
        }
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunkText = decoder.decode(value, { stream: true });
        aiContent += chunkText;

        // Update the active streaming message content in real-time
        setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, content: aiContent } : m))
        );
      }

      // If autoSpeak is enabled or Siri mode is active, read the finalized content aloud
      if ((autoSpeak || isSiriMode) && aiContent) {
        speakText(aiContent, () => {
          if (isSiriMode && handsFreeActive) {
            setTimeout(() => {
              startListening();
            }, 600);
          }
        });
      }

    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "model",
          content: `⚠️ Failed to get a reply: ${err.message || "Please check your network and try again."}`,
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  const quickPrompts = [
    "Who is the best backend developer?",
    "Find candidates with React & SQL",
    "Compare Alice and Bob",
    "Draft interview briefs for AI Engineer"
  ];

  // Render wave bars
  const renderWaveBars = () => {
    const barCount = 12;
    return (
      <div className="flex items-center gap-1.5 h-12 justify-center py-2">
        {Array.from({ length: barCount }).map((_, i) => {
          let heightClass = "h-1";
          let colorClass = "bg-neutral-600";
          let animationDelay = `${i * 100}ms`;

          if (isListening) {
            // Cyan waves
            heightClass = i % 2 === 0 ? "h-6" : "h-10";
            colorClass = "bg-cyan-400";
          } else if (isPlaying) {
            // Indigo/pink waves
            heightClass = i % 3 === 0 ? "h-8" : i % 3 === 1 ? "h-5" : "h-12";
            colorClass = "bg-indigo-400";
          } else if (loading) {
            // Amber waves
            heightClass = "h-3";
            colorClass = "bg-amber-400 animate-bounce";
          } else {
            // Idle dots
            heightClass = "h-1.5";
            colorClass = "bg-neutral-600";
          }

          return (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-300 ${colorClass} ${heightClass}`}
              style={{
                animation: isListening || isPlaying ? "pulse 1.2s infinite ease-in-out" : loading ? "bounce 1s infinite ease-in-out" : "none",
                animationDelay: (isListening || isPlaying || loading) ? animationDelay : "0ms"
              }}
            />
          );
        })}
      </div>
    );
  };

  if (isSiriMode) {
    // Determine the active assistant state
    let assistantState = "idle";
    let statusLabel = "Tap orb to talk";
    let statusDesc = "Ask about jobs, candidates, or draft briefs";
    let statusColor = "text-neutral-400";

    if (isListening) {
      assistantState = "listening";
      statusLabel = "Listening...";
      statusDesc = "I'm listening to your voice. Speak clearly.";
      statusColor = "text-cyan-400";
    } else if (loading) {
      assistantState = "thinking";
      statusLabel = "Thinking...";
      statusDesc = "Querying pipeline database and context...";
      statusColor = "text-amber-400 animate-pulse";
    } else if (isPlaying) {
      assistantState = "speaking";
      statusLabel = "Speaking...";
      statusDesc = "Reading out recruiting context response.";
      statusColor = "text-indigo-400";
    }

    // Get the latest query and reply to display
    const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
    const lastAIMessage = [...messages].reverse().find(m => m.role === "model" && m.id !== "welcome-msg");

    return (
      <div className="glass-panel h-[600px] flex flex-col overflow-hidden shadow-2xl border border-white/10 animate-fade-in bg-[#09090b]/95 relative">
        
        {/* Glowing Ambient Background Lights */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full blur-[120px] transition-all duration-1000 -z-10 opacity-20 pointer-events-none ${
          isListening 
            ? "bg-cyan-500" 
            : isPlaying 
            ? "bg-purple-600" 
            : loading 
            ? "bg-amber-500" 
            : "bg-indigo-600"
        }`} />

        {/* Header Bar */}
        <div className="p-4 border-b border-white/10 bg-white/2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl transition duration-500 ${
              isListening ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/25" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/25"
            }`}>
              <Radio className={`h-4 w-4 ${isListening || isPlaying ? "animate-pulse" : ""}`} />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm tracking-tight flex items-center gap-1.5">
                <span>Siri Assistant Mode</span>
                <span className="text-[8px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 font-black font-mono uppercase tracking-wider rounded border border-indigo-500/30">Beta Voice</span>
              </h3>
              <p className="text-[10px] text-neutral-450 font-mono">Hands-free Conversational Recruiting</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleSiriMode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black border border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 transition cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
              <span>Classic Chat</span>
            </button>
          </div>
        </div>

        {/* Center Assistant Hub */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 relative">
          
          {/* Circular Voice Orb */}
          <div className="relative group">
            {/* Pulsing rings */}
            {(isListening || isPlaying) && (
              <>
                <div className={`absolute inset-0 rounded-full animate-ping opacity-25 scale-125 transition-all duration-500 ${
                  isListening ? "bg-cyan-400" : "bg-indigo-400"
                }`} />
                <div className={`absolute inset-0 rounded-full animate-ping opacity-10 scale-150 transition-all duration-700 ${
                  isListening ? "bg-cyan-500" : "bg-purple-500"
                }`} />
              </>
            )}

            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              className={`h-36 w-36 rounded-full flex flex-col items-center justify-center transition-all duration-500 relative overflow-hidden shadow-2xl ${
                isListening
                  ? "bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-600 scale-105 shadow-[0_0_60px_rgba(34,211,238,0.4)] border border-cyan-300"
                  : isPlaying
                  ? "bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 scale-105 shadow-[0_0_60px_rgba(168,85,247,0.4)] border border-purple-300"
                  : loading
                  ? "bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-600 shadow-[0_0_40px_rgba(245,158,11,0.2)] border border-amber-300"
                  : "bg-gradient-to-tr from-neutral-800 via-neutral-900 to-black hover:from-neutral-750 hover:via-neutral-850 hover:to-neutral-950 border border-white/15 hover:border-white/25 cursor-pointer"
              }`}
              title="Click orb to trigger Siri microphone"
            >
              {/* Spinning/pulsing graphic overlay */}
              {loading && <div className="absolute inset-0 border-2 border-dashed border-white/20 rounded-full animate-spin" />}

              {/* Inner Icon */}
              <div className="z-15 text-white flex flex-col items-center gap-1">
                {isListening ? (
                  <Mic className="h-10 w-10 text-white animate-bounce" />
                ) : isPlaying ? (
                  <Volume2 className="h-10 w-10 text-white animate-pulse" />
                ) : loading ? (
                  <Bot className="h-10 w-10 text-white animate-pulse" />
                ) : (
                  <Mic className="h-10 w-10 text-neutral-350 group-hover:text-white transition duration-300" />
                )}
              </div>
            </button>
          </div>

          {/* Dynamic Spectrum Wavebars */}
          {renderWaveBars()}

          {/* Status Indicators */}
          <div className="text-center space-y-1.5 max-w-sm">
            <span className={`font-mono text-xs font-black uppercase tracking-widest ${statusColor}`}>
              {statusLabel}
            </span>
            <p className="text-[11px] text-neutral-400 font-medium">
              {statusDesc}
            </p>
          </div>

          {/* Interactive Screen Transcript Display */}
          <div className="w-full max-w-md bg-white/2 border border-white/5 rounded-2xl p-4 space-y-3 min-h-[100px] flex flex-col justify-center text-center">
            {lastUserMessage || lastAIMessage ? (
              <div className="space-y-2">
                {lastUserMessage && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold font-mono text-cyan-400 uppercase tracking-wider">You asked:</span>
                    <p className="text-xs text-white font-semibold italic line-clamp-2">"{lastUserMessage.content}"</p>
                  </div>
                )}
                {lastAIMessage && (
                  <div className="space-y-1 border-t border-white/5 pt-2 mt-2">
                    <span className="text-[9px] font-bold font-mono text-indigo-400 uppercase tracking-wider">Assistant Response:</span>
                    <p className="text-xs text-neutral-300 font-medium line-clamp-3 leading-relaxed">{lastAIMessage.content}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1 py-2">
                <p className="text-xs text-neutral-400 font-semibold italic">"Who are the top backend engineers in the pipeline?"</p>
                <p className="text-[10px] text-neutral-500 font-medium">Try speaking this prompt out loud to test Siri mode.</p>
              </div>
            )}
          </div>
        </div>

        {/* Hands-Free Settings Footer Panel */}
        <div className="p-4 border-t border-white/10 bg-white/2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Hands Free Mode Control */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={handsFreeActive} 
                onChange={(e) => {
                  setHandsFreeActive(e.target.checked);
                  if (e.target.checked) {
                    speakText("Continuous hands-free conversation enabled.");
                  }
                }}
                className="sr-only peer" 
              />
              <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-400 after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white peer-checked:after:border-transparent"></div>
              <span className="ml-2.5 text-[11px] font-bold text-neutral-300">Continuous Hands-Free (Siri Loop)</span>
            </label>
          </div>

          {/* Voices / settings shortcut */}
          <div className="flex items-center gap-3">
            {/* Quick voice selector for hands-free mode */}
            {voices.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5 text-neutral-400" />
                <select
                  value={selectedVoiceName}
                  onChange={(e) => setSelectedVoiceName(e.target.value)}
                  className="bg-[#09090b]/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] text-neutral-250 focus:outline-none cursor-pointer font-bold focus:border-indigo-500"
                >
                  {voices.filter(v => v.lang.startsWith("en-") || v.lang.startsWith("en")).map(v => (
                    <option key={v.name} value={v.name}>
                      {v.name.replace("Microsoft", "").replace("Google", "").trim()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isPlaying && (
              <button
                onClick={stopSpeaking}
                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-xl text-[10px] font-bold cursor-pointer transition flex items-center gap-1 shrink-0"
              >
                <Square className="h-2.5 w-2.5 fill-rose-500 text-rose-500" />
                <span>Mute</span>
              </button>
            )}
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="glass-panel h-[600px] flex flex-col overflow-hidden shadow-2xl border border-white/10 animate-fade-in">
      {/* Header bar */}
      <div className="p-4 border-b border-white/10 bg-white/2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 rounded-xl">
            <Sparkles className="h-4 w-4 shrink-0" />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-sm tracking-tight">Recruiting AI Copilot</h3>
            <p className="text-[10px] text-neutral-450 font-mono">Grounded Talent Screening Companion</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Siri Mode Toggle Button */}
          <button
            id="siri-mode-toggle-btn"
            onClick={toggleSiriMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black border border-indigo-500/15 bg-white/5 text-indigo-400 hover:bg-white/10 transition cursor-pointer"
            title="Switch to Google-Siri voice assistant overlay"
          >
            <Radio className="h-3.5 w-3.5 animate-pulse text-indigo-400" />
            <span>Siri Mode</span>
          </button>
          {/* Voice Assistant Auto-Speak Option */}
          {hasTTSSupport && (
            <button
              id="voice-auto-speak-toggle"
              type="button"
              onClick={() => {
                setAutoSpeak(!autoSpeak);
                if (!autoSpeak) {
                  speakText("Voice Assistant activated. Answers will be read aloud.");
                } else {
                  stopSpeaking();
                }
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-bold border transition cursor-pointer ${
                autoSpeak 
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10" 
                  : "bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10"
              }`}
              title="Speak responses automatically"
              aria-label={autoSpeak ? "Disable auto speak responses" : "Enable auto speak responses"}
            >
              {autoSpeak ? <Volume2 className="h-3.5 w-3.5 text-white animate-pulse" /> : <VolumeX className="h-3.5 w-3.5 text-neutral-450" />}
              <span className="hidden xs:inline">{autoSpeak ? "Voice Assistant ON" : "Voice Assistant OFF"}</span>
            </button>
          )}

          {/* Voice config settings toggle */}
          {hasTTSSupport && (
            <button
              id="voice-settings-toggle"
              type="button"
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                showVoiceSettings 
                  ? "bg-white/15 text-white border-white/20" 
                  : "bg-white/5 text-neutral-450 border-white/10 hover:bg-white/10 hover:text-white"
              }`}
              title="Voice settings"
              aria-label="Toggle voice settings panel"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          )}

          {messages.length > 1 && (
            <button
              id="clear-chat-history-btn"
              onClick={handleClearHistory}
              className="text-[10px] bg-white/5 hover:bg-white/10 text-neutral-300 px-3.5 py-2 rounded-xl border border-white/10 cursor-pointer font-bold transition"
            >
              Clear Chat
            </button>
          )}
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>

      {/* Voice configuration tray */}
      {showVoiceSettings && hasTTSSupport && (
        <div className="bg-white/2 border-b border-white/10 p-3.5 flex flex-wrap gap-4 items-center justify-between text-xs text-neutral-200">
          <div className="flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-wider text-neutral-450 font-mono">
            <Volume2 className="h-3.5 w-3.5 text-neutral-300 shrink-0" />
            <span>Voice Assistant Settings</span>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {/* Speed Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-neutral-450 font-semibold">Speed:</span>
              <select
                id="tts-speed-selector"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="bg-[#09090b]/60 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-neutral-200 focus:outline-none cursor-pointer font-semibold focus:border-indigo-500"
              >
                <option value="0.8">0.8x</option>
                <option value="1.0">1.0x (Normal)</option>
                <option value="1.2">1.2x</option>
                <option value="1.5">1.5x</option>
              </select>
            </div>

            {/* Voices Dropdown */}
            {voices.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-neutral-450 font-semibold">Narrator:</span>
                <select
                  id="tts-voice-selector"
                  value={selectedVoiceName}
                  onChange={(e) => setSelectedVoiceName(e.target.value)}
                  className="bg-[#09090b]/60 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-neutral-200 max-w-[130px] truncate focus:outline-none cursor-pointer font-semibold focus:border-indigo-500"
                >
                  {voices.filter(v => v.lang.startsWith("en-") || v.lang.startsWith("en")).map(v => (
                    <option key={v.name} value={v.name}>
                      {v.name.replace("Microsoft", "").replace("Google", "").trim()}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Mute button */}
            {isPlaying && (
              <button
                onClick={stopSpeaking}
                className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-lg text-[9px] font-bold cursor-pointer transition flex items-center gap-1"
              >
                <Square className="h-2 w-2 fill-rose-500 text-rose-500" />
                <span>Stop TTS</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages block */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-transparent custom-scrollbar">
        {messages.map((msg) => {
          const isAI = msg.role === "model";
          return (
            <div key={msg.id} className={`flex gap-3 ${isAI ? "justify-start" : "justify-end"}`}>
              {isAI && (
                <div className="h-8 w-8 bg-[#09090b]/40 border border-white/10 text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div className="flex items-center gap-2 max-w-[80%]">
                <div className={`p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                  isAI
                    ? "bg-white/5 text-neutral-250 border border-white/5"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 border border-indigo-500/15 text-white font-semibold shadow-lg shadow-indigo-600/10"
                }`}>
                  {msg.content}
                </div>

                {isAI && hasTTSSupport && (
                  <button
                    onClick={() => speakText(msg.content)}
                    className="p-1.5 hover:bg-white/10 rounded-full text-neutral-500 hover:text-white transition cursor-pointer shrink-0"
                    title="Speak response"
                    aria-label="Speak response aloud"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {!isAI && (
                <div className="h-8 w-8 bg-white/5 border border-white/10 text-neutral-300 rounded-xl flex items-center justify-center shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}

        {loading && !messages[messages.length - 1]?.content && (
          <div className="flex gap-3 justify-start animate-pulse">
            <div className="h-8 w-8 bg-[#09090b]/40 border border-white/10 text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <div className="p-3 bg-white/5 border border-white/5 rounded-2xl text-xs text-neutral-450 flex items-center gap-2 font-semibold">
              <span className="h-1.5 w-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              <span className="font-mono text-[9px] pl-1">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Suggested prompts pills */}
      <div className="px-4 py-2.5 flex items-center gap-2 overflow-x-auto border-t border-white/10 bg-white/2 custom-scrollbar">
        <span className="text-[9px] uppercase font-bold text-neutral-400 shrink-0 font-mono">Suggested:</span>
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(prompt)}
            className="px-3 py-1.5 bg-[#09090b]/40 border border-white/10 hover:bg-white/5 text-neutral-300 rounded-xl text-[10px] whitespace-nowrap cursor-pointer transition flex items-center gap-0.5 font-bold"
          >
            <span>{prompt}</span>
            <ChevronRight className="h-3 w-3 text-neutral-500" />
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleFormSubmit} className="p-4 border-t border-white/10 bg-transparent flex items-center gap-2.5">
        <input
          id="copilot-input-field"
          type="text"
          placeholder={isListening ? "Listening..." : "Ask Copilot or click Mic to dictate..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-4 py-3 bg-white/5 hover:bg-[#09090b]/40 border border-white/10 focus:border-indigo-500 focus:bg-[#09090b]/60 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none transition-all duration-300"
        />
        {hasSTTSupport && (
          <button
            id="voice-copilot-mic-btn"
            type="button"
            onClick={isListening ? stopListening : startListening}
            className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-center shrink-0 ${
              isListening
                ? "bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse shadow-md shadow-rose-500/10"
                : "bg-white/5 text-neutral-400 border-white/10 hover:bg-white/10 hover:text-white"
            }`}
            title={isListening ? "Stop listening" : "Talk to Recruiter Assistant (Speech-to-Text)"}
            aria-label={isListening ? "Stop speaking" : "Speak question"}
          >
            {isListening ? <MicOff className="h-4 w-4 text-rose-450" /> : <Mic className="h-4 w-4" />}
          </button>
        )}
        <button
          id="copilot-send-btn"
          type="submit"
          disabled={!input.trim() || loading}
          className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border border-indigo-500/15 text-white rounded-xl transition shadow-lg shadow-indigo-600/10 cursor-pointer disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
