import { useState, useEffect, useRef } from "react";

export interface SpeechVoiceOption {
  name: string;
  lang: string;
  voice: SpeechSynthesisVoice;
}

export function useVoiceSpeech() {
  // Speech Recognition States
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recognitionError, setRecognitionError] = useState("");
  
  // Speech Synthesis States
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechVoiceOption[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");
  const [rate, setRate] = useState<number>(1.0); // Speed: 0.5 to 2
  const [pitch, setPitch] = useState<number>(1.0); // Pitch: 0.5 to 2
  const [currentlySpokenText, setCurrentlySpokenText] = useState("");

  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize Speech Synthesis & load available voices
  useEffect(() => {
    if (typeof window !== "undefined") {
      synthesisRef.current = window.speechSynthesis;
      
      const loadVoices = () => {
        if (!synthesisRef.current) return;
        const systemVoices = synthesisRef.current.getVoices();
        const options = systemVoices.map(v => ({
          name: v.name,
          lang: v.lang,
          voice: v
        }));
        setVoices(options);
        
        // Default to an English voice if available, or first available
        const defaultVoice = options.find(v => v.lang.startsWith("en-") && v.name.toLowerCase().includes("natural")) ||
                             options.find(v => v.lang.startsWith("en-")) ||
                             options[0];
        if (defaultVoice) {
          setSelectedVoiceName(defaultVoice.name);
        }
      };

      loadVoices();
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false; // Stop after a pause
        rec.interimResults = false; // Only final transcripts
        rec.lang = "en-US";

        rec.onstart = () => {
          setIsListening(true);
          setRecognitionError("");
        };

        rec.onresult = (event: any) => {
          const resultText = event.results[0][0].transcript;
          setTranscript(resultText);
        };

        rec.onerror = (event: any) => {
          console.error("Speech Recognition Error:", event.error);
          setRecognitionError(event.error === "not-allowed" ? "Microphone permission denied" : `Speech error: ${event.error}`);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  // Trigger Speech-to-Text
  const startListening = () => {
    if (!recognitionRef.current) {
      setRecognitionError("Speech Recognition is not supported or initialized in this browser.");
      return;
    }
    
    // Stop ongoing speech synthesis first to prevent cross-audio interference
    stopSpeaking();
    
    try {
      setTranscript("");
      recognitionRef.current.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Trigger Text-to-Speech
  const speakText = (text: string, onEndCallback?: () => void) => {
    if (!synthesisRef.current) {
      console.warn("Speech Synthesis is not supported in this browser.");
      return;
    }

    // Cancel active synthesis first
    synthesisRef.current.cancel();
    setIsPlaying(false);
    setIsPaused(false);

    if (!text.trim()) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;
    setCurrentlySpokenText(text);

    // Set parameters
    utterance.rate = rate;
    utterance.pitch = pitch;

    if (selectedVoiceName) {
      const selected = voices.find(v => v.name === selectedVoiceName);
      if (selected) {
        utterance.voice = selected.voice;
      }
    }

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentlySpokenText("");
      if (onEndCallback) onEndCallback();
    };

    utterance.onerror = (e) => {
      console.error("Speech synthesis error:", e);
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentlySpokenText("");
    };

    synthesisRef.current.speak(utterance);
  };

  const pauseSpeaking = () => {
    if (synthesisRef.current && isPlaying && !isPaused) {
      synthesisRef.current.pause();
      setIsPaused(true);
    }
  };

  const resumeSpeaking = () => {
    if (synthesisRef.current && isPaused) {
      synthesisRef.current.resume();
      setIsPaused(false);
    }
  };

  const stopSpeaking = () => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentlySpokenText("");
    }
  };

  return {
    // STT API
    isListening,
    transcript,
    setTranscript,
    recognitionError,
    startListening,
    stopListening,
    hasSTTSupport: typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition),

    // TTS API
    isPlaying,
    isPaused,
    voices,
    selectedVoiceName,
    setSelectedVoiceName,
    rate,
    setRate,
    pitch,
    setPitch,
    currentlySpokenText,
    speakText,
    pauseSpeaking,
    resumeSpeaking,
    stopSpeaking,
    hasTTSSupport: typeof window !== "undefined" && !!(window.speechSynthesis)
  };
}
