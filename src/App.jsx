import { useState, useEffect, useRef } from "react";
import Navbar from "./component/Navbar";
import PlasmaOrb from "./component/blob";
import Terminal from "./component/Terminal";
import MapTerminal from "./component/MapTerminal";
import StatusTerminal from "./component/StatusTerminal";
import SystemInfoTerminal from "./component/SystemInfoTerminal";
import Background from "./component/Background";
import "./App.css";

function App() {
  const [audioBlocked, setAudioBlocked] = useState(false);
  const pendingAudioRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [interimText, setInterimText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef(false);

  // Chat history for the LLM
  const chatHistoryRef = useRef([
    {
      role: "system",
      content: "You are Lyra, the voice AI assistant for Countrywide Logistics. Always speak in Hindi. If the customer speaks in English or another language, politely continue the conversation in Hindi unless they explicitly request another language. Speak naturally in short, conversational sentences suitable for speech. Your tone should be professional, calm, confident, and helpful. Assist customers with shipment tracking, pickup scheduling, delivery status, freight services, logistics solutions, transportation, branch information, pricing, and general customer support. IMPORTANT: If the user asks about vehicle tracking, vehicle location, or any vehicle-related status, you MUST use the track_vehicle tool to find the information. If the user does not provide a vehicle number, ask them for the vehicle number first before calling the tool. Accept the vehicle number in any format (full number or just the last 4 digits) and call the tool immediately. Do not ask the user to format or remove spaces. Once the tool returns the location data, speak the vehicle details clearly. Ask one question at a time whenever additional information is needed. Never guess shipment status or delivery dates. If information is unavailable, clearly explain that. Keep responses concise and focused. Avoid repeating information unless requested. If the customer greets you, introduce yourself by saying: नमस्कार! मैं लाइरा हूँ, कंट्रीवाइड लॉजिस्टिक्स की एआई सहायक। मैं आपकी किस प्रकार सहायता कर सकती हूँ? Do not use markdown, emojis, bullet points, stage directions, or asterisks. Output only the text that should be spoken."
    }
  ]);

  const [blobConfig, setBlobConfig] = useState(() => {
    const saved = localStorage.getItem('blobConfig');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved blob config", e);
      }
    }
    return {
      color: '#0044ff',
      size: 180,
      position: { right: 30, bottom: 30 },
      intensity: 1.5,
      speed: 1.0,
      noiseScale: 2.0,
      mouseInteraction: true,
      sensitivity: 2.2,
      isDraggingMode: false
    };
  });

  useEffect(() => {
    localStorage.setItem('blobConfig', JSON.stringify(blobConfig));
  }, [blobConfig]);

  // Audio recording refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const audioChunksRef = useRef([]);
  const isRecordingAudioRef = useRef(false);
  const streamRef = useRef(null);
  const audioPlayerRef = useRef(null);

  // VAD config
  const SILENCE_THRESHOLD = 60; // Volume threshold (0-255) - Increased to ignore background noise
  const SILENCE_DURATION = 1000; // ms of silence before sending

  useEffect(() => {
    let animationFrameId;

    const setupAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        streamRef.current = stream;

        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
        microphoneRef.current.connect(analyserRef.current);

        analyserRef.current.fftSize = 512;
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        mediaRecorderRef.current = new MediaRecorder(stream);

        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorderRef.current.onstop = async () => {
          if (audioChunksRef.current.length === 0) return;
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioChunksRef.current = [];

          // Only send to Whisper if we aren't currently speaking (to prevent self-transcription loop)
          if (!isSpeakingRef.current) {
            await handleAudioBlob(audioBlob);
          }
        };

        const checkSilence = () => {
          if (!analyserRef.current) return;

          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;

          // With echoCancellation enabled, any sound detected above threshold is likely the user (Barge-in)
          if (average > SILENCE_THRESHOLD) {

            // If Jarvis is talking, stop him!
            if (isSpeakingRef.current) {
              if (audioPlayerRef.current) {
                audioPlayerRef.current.pause();
                audioPlayerRef.current.currentTime = 0;
              }
              window.speechSynthesis.cancel();
              setIsSpeaking(false);
              isSpeakingRef.current = false;
            }

            // Start recording
            if (!isRecordingAudioRef.current && mediaRecorderRef.current.state === 'inactive') {
              try {
                mediaRecorderRef.current.start();
                isRecordingAudioRef.current = true;
                setIsRecording(true);
                setInterimText("Listening...");
              } catch (e) {
                console.error("Failed to start MediaRecorder", e);
              }
            }
            // Reset silence timer
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          } else {
            // Silence detected
            if (isRecordingAudioRef.current && !silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                  try {
                    mediaRecorderRef.current.stop();
                  } catch (e) { }
                }
                isRecordingAudioRef.current = false;
                setIsRecording(false);
                setInterimText("Processing audio...");
                silenceTimerRef.current = null;
              }, SILENCE_DURATION);
            }
          }

          animationFrameId = requestAnimationFrame(checkSilence);
        };

        checkSilence();
      } catch (err) {
        console.error("Could not setup audio:", err);
      }
    };

    setupAudio();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);

  const handleAudioBlob = async (blob) => {
    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      if (!apiKey) throw new Error("VITE_GROQ_API_KEY is not set");

      // 1. Transcribe with Whisper
      const formData = new FormData();
      formData.append("file", blob, "audio.webm");
      formData.append("model", "whisper-large-v3");
      formData.append("language", "hi");
      formData.append("prompt", "This is a conversation about logistics and vehicle tracking in Hindi. The user might say vehicle numbers like GJ 01 ET 1829, GJ 01 JT 5432. Please transcribe accurately.");

      const transcriptionResponse = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!transcriptionResponse.ok) {
        throw new Error(`Whisper API error! status: ${transcriptionResponse.status}`);
      }

      const transcriptionData = await transcriptionResponse.json();
      const transcribedText = transcriptionData.text.trim();
      const lowerText = transcribedText.toLowerCase();

      // Whisper large-v3 common hallucinations on silence/noise
      const isHallucination = [
        "later.", "later", 
        "thank you.", "thank you", 
        "thanks for watching.", "thanks for watching",
        "the end."
      ].includes(lowerText) || lowerText.includes("subtitles by") || lowerText.includes("amara.org");

      if (!transcribedText || isHallucination) {
        setInterimText("");
        return; // Ignore empty audio or hallucinations
      }

      // 2. Process text
      await handleUserText(transcribedText);

    } catch (error) {
      console.error("Error processing audio:", error);
      setInterimText("Error processing audio.");
      setTimeout(() => setInterimText(""), 3000);
    }
  };

  const addMessage = (role, text) => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role, text }]);
  };

  const speakText = async (text) => {
    setIsSpeaking(true);
    isSpeakingRef.current = true;

    // Stop recording while speaking to prevent self-transcription
    if (isRecordingAudioRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        isRecordingAudioRef.current = false;
        setIsRecording(false);
      } catch (e) { }
    }

    const ttsApiKey = import.meta.env.VITE_GOOGLE_TTS_API_KEY;
    if (!ttsApiKey) {
      console.error("VITE_GOOGLE_TTS_API_KEY is missing in .env");
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      return;
    }

    try {
      const isHindi = /[\u0900-\u097F]/.test(text);
      const isGujarati = /[\u0A80-\u0AFF]/.test(text);

      let languageCode = "en-US";
      let name = "en-US-Journey-F"; // Premium Google Voice

      if (isHindi) {
        languageCode = "hi-IN";
        name = "hi-IN-Neural2-A";
      } else if (isGujarati) {
        languageCode = "gu-IN";
        name = "gu-IN-Standard-A";
      }

      const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${ttsApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text: text },
          voice: { languageCode, name },
          audioConfig: { audioEncoding: "MP3" }
        })
      });

      if (!response.ok) {
        throw new Error(`Google TTS API Error: ${response.status}`);
      }

      const data = await response.json();
      const audioContent = data.audioContent;

      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }

      const audio = new Audio("data:audio/mp3;base64," + audioContent);
      audioPlayerRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
      };

      audio.onerror = () => {
        console.error("Failed to play audio");
        setIsSpeaking(false);
        isSpeakingRef.current = false;
      };

      try {
        await audio.play();
        setAudioBlocked(false);
      } catch (playError) {
        if (playError.name === "NotAllowedError") {
          console.warn("Audio autoplay blocked by browser. User interaction needed.");
          setAudioBlocked(true);
          pendingAudioRef.current = audio;
          // Set speaking state to false since we are waiting for click
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          return;
        } else {
          throw playError;
        }
      }

    } catch (error) {
      console.error("TTS failed:", error);

      // FALLBACK TO BROWSER TTS IF GOOGLE API FAILS
      console.warn("Falling back to browser TTS due to API error.");
      const utterance = new SpeechSynthesisUtterance(text);

      const isHindi = /[\u0900-\u097F]/.test(text);
      const isGujarati = /[\u0A80-\u0AFF]/.test(text);

      let targetLang = 'en';
      if (isHindi) targetLang = 'hi';
      else if (isGujarati) targetLang = 'gu';

      const voices = window.speechSynthesis.getVoices();
      const langVoices = voices.filter(v => v.lang.startsWith(targetLang));

      if (targetLang === 'en') {
        const preferredVoice = langVoices.find(v => v.name.includes("Daniel") || v.name.includes("Google US English") || v.name.includes("Samantha"));
        utterance.voice = preferredVoice || langVoices[0];
      } else {
        const preferredVoice = langVoices.find(v => v.name.includes("Google"));
        utterance.voice = preferredVoice || langVoices[0];
      }

      utterance.onend = () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
      };

      utterance.onerror = (e) => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
      };

      window.speechSynthesis.speak(utterance);
    }
  };

  const startRecording = () => {
    // Handled by VAD
  };

  const stopRecording = () => {
    // Handled by VAD
  };

  const handleUserText = async (text) => {
    addMessage("user", text);
    chatHistoryRef.current.push({ role: "user", content: text });

    setInterimText("Processing AI Response...");

    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      if (!apiKey) {
        throw new Error("VITE_GROQ_API_KEY is not set in .env");
      }

      const tools = [
        {
          type: "function",
          function: {
            name: "track_vehicle",
            description: "Get the current GPS location and address of a vehicle using its vehicle number.",
            parameters: {
              type: "object",
              properties: {
                vehicle_number: {
                  type: "string",
                  description: "The vehicle number or last 4 digits to track (e.g. GJ01JT5432 or 5432)."
                }
              },
              required: ["vehicle_number"]
            }
          }
        }
      ];

      let response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: chatHistoryRef.current,
          temperature: 0.7,
          max_tokens: 256,
          tools: tools,
          tool_choice: "auto"
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      let data = await response.json();
      let responseMessage = data.choices[0].message;

      // Handle Tool Calls if the AI decided to use the tracking tool
      if (responseMessage.tool_calls) {
        chatHistoryRef.current.push(responseMessage); // Add the assistant's tool call message
        
        for (const toolCall of responseMessage.tool_calls) {
          if (toolCall.function.name === "track_vehicle") {
            setInterimText("Tracking vehicle...");
            const args = JSON.parse(toolCall.function.arguments);
            let vehicleNum = args.vehicle_number ? args.vehicle_number.replace(/\s+/g, '').toUpperCase() : "";
            
            try {
              const locRes = await fetch('https://countrywidelogistics.in/api/v1/vehicle/gps/location');
              const locData = await locRes.json();
              let foundVehicle = null;
              
              if (locData.success && locData.data && locData.data.gps_list) {
                foundVehicle = locData.data.gps_list.find(v => 
                  v.vehicle_number.toUpperCase() === vehicleNum || 
                  v.vehicle_number.toUpperCase().endsWith(vehicleNum)
                );
              }
              
              if (foundVehicle) {
                // Dispatch event to make the map auto-focus on this vehicle
                window.dispatchEvent(new CustomEvent('focus-vehicle', { 
                  detail: { id: foundVehicle.vehicle_number } 
                }));
              }
              
              const toolResult = foundVehicle 
                ? `Vehicle ${vehicleNum} is currently at: ${foundVehicle.address}. Last updated: ${foundVehicle.last_received_at}`
                : `Could not find GPS data for vehicle ${vehicleNum}. Please verify the number.`;

              chatHistoryRef.current.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: toolResult
              });
            } catch (err) {
              chatHistoryRef.current.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: "Error accessing the GPS API."
              });
            }
          }
        }

        // Second call to get the final spoken response based on the tool's output
        setInterimText("Processing AI Response...");
        response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: chatHistoryRef.current,
            temperature: 0.7,
            max_tokens: 256,
            tools: tools
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        data = await response.json();
        responseMessage = data.choices[0].message;
      }

      let assistantText = responseMessage.content || "";
      
      // Safety filter: If the LLM still outputs raw tool call syntax in content, strip it or replace it
      if (assistantText.includes("function=track_vehicle")) {
         assistantText = "वाहन की जानकारी मिल गई है।"; // Fallback text
      }

      chatHistoryRef.current.push({ role: "assistant", content: assistantText });

      // Keep history from growing too large (keep system prompt + last 20 messages to preserve tool call chains)
      if (chatHistoryRef.current.length > 21) {
        chatHistoryRef.current = [chatHistoryRef.current[0], ...chatHistoryRef.current.slice(-20)];
      }

      setInterimText("");
      addMessage("assistant", assistantText);
      speakText(assistantText);

    } catch (error) {
      console.error("Error calling Groq API:", error);
      setInterimText("Error communicating with AI.");
      setTimeout(() => setInterimText(""), 3000);
    }
  };

  // Prevent context menu on orb right click
  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  return (
    <div
      className="w-full min-h-screen text-white font-sans overflow-x-hidden relative"
    >
      <Background />
      {audioBlocked && (
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
          <button
            onClick={() => {
              if (pendingAudioRef.current) {
                pendingAudioRef.current.play().catch(e => console.error("Still cannot play", e));
                setIsSpeaking(true);
                isSpeakingRef.current = true;
              }
              setAudioBlocked(false);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-red-500/80 hover:bg-red-500 text-white rounded-full font-bold shadow-[0_0_15px_rgba(239,68,68,0.5)] transition-all backdrop-blur-sm border border-red-400"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path></svg>
            Click to Enable Voice
          </button>
        </div>
      )}

      <Navbar setBlobConfig={setBlobConfig} blobConfig={blobConfig} />

      <Terminal messages={messages} interimText={interimText} />
      <MapTerminal />
      <StatusTerminal />
      <SystemInfoTerminal />

      {/* <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none z-10 opacity-50">
        <h1 className="text-4xl font-bold tracking-widest text-cyan-500 mb-2">J.A.R.V.I.S.</h1>
      </div> */}

      <PlasmaOrb
        isRecording={isRecording}
        isSpeaking={isSpeaking}
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        blobConfig={blobConfig}
        setBlobConfig={setBlobConfig}
      />
    </div>
  );
}

export default App;
