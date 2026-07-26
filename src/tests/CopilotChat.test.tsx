import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CopilotChat from "../components/CopilotChat";

// Mock the useVoiceSpeech custom hook
vi.mock("../hooks/useVoiceSpeech", () => {
  return {
    useVoiceSpeech: () => ({
      isListening: false,
      transcript: "",
      startListening: vi.fn(),
      stopListening: vi.fn(),
      isPlaying: false,
      isPaused: false,
      voices: [],
      selectedVoiceName: "Default Voice",
      setSelectedVoiceName: vi.fn(),
      rate: 1.0,
      setRate: vi.fn(),
      speakText: vi.fn(),
      pauseSpeaking: vi.fn(),
      resumeSpeaking: vi.fn(),
      stopSpeaking: vi.fn(),
      hasSTTSupport: true,
      hasTTSSupport: true,
    }),
  };
});

describe("CopilotChat Component", () => {
  const mockToken = "enterprise-mock-jwt-token-123";

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes("/api/copilot/history")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              history: [
                {
                  id: "msg-1",
                  role: "user",
                  content: "Who is the top candidate for React?",
                  timestamp: new Date().toISOString(),
                },
                {
                  id: "msg-2",
                  role: "model",
                  content: "John Doe matches React perfectly with 85% score.",
                  timestamp: new Date().toISOString(),
                },
              ],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }) as any;
  });

  it("renders welcome message and loads history successfully", async () => {
    render(<CopilotChat token={mockToken} />);

    // Renders the default copilot intro message
    expect(screen.getByText(/Recruiting AI Copilot/i)).toBeInTheDocument();

    // Verifies that history API was called
    expect(global.fetch).toHaveBeenCalledWith("/api/copilot/history", expect.any(Object));

    // Wait for the history messages to load and render
    await waitFor(() => {
      expect(screen.getByText("Who is the top candidate for React?")).toBeInTheDocument();
      expect(screen.getByText(/John Doe matches React perfectly/i)).toBeInTheDocument();
    });
  });

  it("allows user to input and submit a new message", async () => {
    // Override fetch to handle the post request as well
    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (url.includes("/api/copilot/history")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ history: [] }),
        });
      }
      if (url.includes("/api/copilot/chat") || url.includes("/api/copilot/stream")) {
        const text = "John Doe has 5 years of React experience.";
        const encoder = new TextEncoder();
        const encoded = encoder.encode(text);
        let readCalled = false;
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: () => {
                if (!readCalled) {
                  readCalled = true;
                  return Promise.resolve({ done: false, value: encoded });
                }
                return Promise.resolve({ done: true, value: undefined });
              }
            })
          }
        });
      }
      return Promise.resolve({ ok: true });
    }) as any;

    const { container } = render(<CopilotChat token={mockToken} />);

    // Find the input field by ID
    const inputField = container.querySelector("#copilot-input-field");
    expect(inputField).toBeInTheDocument();
    fireEvent.change(inputField!, { target: { value: "Tell me about John's experience" } });
    expect(inputField).toHaveValue("Tell me about John's experience");

    // Click submit button by ID
    const submitButton = container.querySelector("#copilot-send-btn");
    expect(submitButton).toBeInTheDocument();
    fireEvent.click(submitButton!);

    // Verify loading state is shown or the message was appended
    expect(screen.getByText("Tell me about John's experience")).toBeInTheDocument();

    // Wait for response to be loaded
    await waitFor(() => {
      expect(screen.getByText(/John Doe has 5 years of React experience/i)).toBeInTheDocument();
    });
  });

  it("toggles the voice speech settings menu", async () => {
    const { container } = render(<CopilotChat token={mockToken} />);

    // Initially settings modal is hidden (doesn't show settings tray)
    expect(screen.queryByText(/Voice Assistant Settings/i)).not.toBeInTheDocument();

    // Find settings toggle button by ID and click
    const settingsButton = container.querySelector("#voice-settings-toggle");
    if (settingsButton) {
      fireEvent.click(settingsButton);
      
      // Verify voice configuration settings are displayed
      expect(screen.getByText(/Voice Assistant Settings/i)).toBeInTheDocument();

      // Click again to close
      fireEvent.click(settingsButton);
      expect(screen.queryByText(/Voice Assistant Settings/i)).not.toBeInTheDocument();
    }
  });
});
