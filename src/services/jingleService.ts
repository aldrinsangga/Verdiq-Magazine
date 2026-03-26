import { GoogleGenAI, Modality } from "@google/genai";
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const JINGLE_CACHE_KEY = 'verdiq_podcast_jingle_v2';
const JINGLE_DOC_ID = 'podcast_jingle_v2';

const getAI = async () => {
  const API_URL = (import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL !== 'undefined') 
    ? import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') 
    : '';
    
  // 1. Prioritize user-selected API key (usually the paid one)
  // In AI Studio Build, the selected key is injected into process.env.API_KEY
  let apiKey = (typeof process !== 'undefined' ? process.env.API_KEY : null) || 
               (import.meta.env.VITE_API_KEY) || 
               (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : null);
  
  // Check for selected API key from AI Studio dialog explicitly
  if (typeof window !== 'undefined' && (window as any).aistudio?.hasSelectedApiKey) {
    try {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (hasKey) {
        // If the platform has a key selected, we should ensure we are using the latest one.
        // The platform injects it into process.env.API_KEY automatically.
        apiKey = (typeof process !== 'undefined' ? process.env.API_KEY : apiKey) || apiKey;
      }
    } catch (e) {
      console.warn("[Auth] Failed to check for selected API key", e);
    }
  }
  
  if (!apiKey) {
    try {
      const res = await fetch(`${API_URL}/api/config`);
      if (res.ok) {
        const data = await res.json();
        apiKey = data.geminiApiKey;
      }
    } catch (e) {
      console.error("Failed to fetch runtime config", e);
    }
  }
  
  return new GoogleGenAI({ apiKey: apiKey || "" });
};

// Helper to decode base64 to AudioBuffer
const decodeAudio = async (base64: string, audioContext: AudioContext): Promise<AudioBuffer> => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return await audioContext.decodeAudioData(bytes.buffer);
};

export const getPodcastJingle = async (audioContext: AudioContext): Promise<AudioBuffer> => {
  // 1. Check local cache first (fastest)
  const cachedJingle = localStorage.getItem(JINGLE_CACHE_KEY);
  if (cachedJingle) {
    try {
      return await decodeAudio(cachedJingle, audioContext);
    } catch (e) {
      console.error("Failed to decode cached jingle, checking database...", e);
      localStorage.removeItem(JINGLE_CACHE_KEY);
    }
  }

  // 2. Check Database (Firestore)
  if (db) {
    try {
      const jingleDoc = await getDoc(doc(db, 'assets', JINGLE_DOC_ID));
      if (jingleDoc.exists()) {
        const data = jingleDoc.data();
        if (data.data) {
          console.log("[Jingle] Found jingle in database, caching locally...");
          localStorage.setItem(JINGLE_CACHE_KEY, data.data);
          return await decodeAudio(data.data, audioContext);
        }
      }
    } catch (e) {
      console.error("Failed to fetch jingle from database", e);
    }
  }

  console.log("[Jingle] Generating new podcast jingle...");
  const ai = await getAI();

  try {
    // 2. Synthesize a more complex audio effect (Modern Chime)
    const synthDuration = 5;
    const synthOfflineCtx = new OfflineAudioContext(1, synthDuration * audioContext.sampleRate, audioContext.sampleRate);
    
    // Create a layered chime effect
    const frequencies = [440, 554.37, 659.25, 880]; // A Major chord
    
    frequencies.forEach((freq, index) => {
      const osc = synthOfflineCtx.createOscillator();
      const gain = synthOfflineCtx.createGain();
      
      osc.type = index % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, 0);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, 0.5);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, 3);
      
      gain.gain.setValueAtTime(0, 0);
      gain.gain.linearRampToValueAtTime(0.2 / frequencies.length, 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, synthDuration);
      
      osc.connect(gain);
      gain.connect(synthOfflineCtx.destination);
      
      osc.start(index * 0.1); // Staggered start
      osc.stop(synthDuration);
    });
    
    // Add a low sweep for depth
    const sweepOsc = synthOfflineCtx.createOscillator();
    const sweepGain = synthOfflineCtx.createGain();
    sweepOsc.type = 'sine';
    sweepOsc.frequency.setValueAtTime(100, 0);
    sweepOsc.frequency.exponentialRampToValueAtTime(50, 2);
    sweepGain.gain.setValueAtTime(0, 0);
    sweepGain.gain.linearRampToValueAtTime(0.1, 0.5);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, 3);
    sweepOsc.connect(sweepGain);
    sweepGain.connect(synthOfflineCtx.destination);
    sweepOsc.start(0);
    sweepOsc.stop(3);
    
    const musicBuffer = await synthOfflineCtx.startRendering();

    // 3. Generate Voice (Gemini TTS)
    const voicePromise = ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: 'The Verdiq Sessions' }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Charon' }, // Large, deep voice
          },
        },
      },
    });

    const voiceResponse = await voicePromise;
    const voiceBase64 = voiceResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!voiceBase64) {
      throw new Error("Failed to generate voice component for jingle");
    }

    // 4. Mix components
    // Convert raw PCM from Gemini (24kHz, 16-bit) to Float32 for AudioBuffer
    const voicePcmBuffer = Uint8Array.from(atob(voiceBase64), c => c.charCodeAt(0));
    const voiceFloatData = new Float32Array(voicePcmBuffer.length / 2);
    const voiceDataView = new DataView(voicePcmBuffer.buffer);
    for (let i = 0; i < voiceFloatData.length; i++) {
      voiceFloatData[i] = voiceDataView.getInt16(i * 2, true) / 32768;
    }
    const voiceBuffer = audioContext.createBuffer(1, voiceFloatData.length, 24000);
    voiceBuffer.getChannelData(0).set(voiceFloatData);

    // Mix using OfflineAudioContext
    const duration = Math.max(musicBuffer.duration, voiceBuffer.duration);
    const offlineCtx = new OfflineAudioContext(1, duration * audioContext.sampleRate, audioContext.sampleRate);

    const musicSource = offlineCtx.createBufferSource();
    musicSource.buffer = musicBuffer;
    musicSource.connect(offlineCtx.destination);
    musicSource.start(0);

    const voiceSource = offlineCtx.createBufferSource();
    voiceSource.buffer = voiceBuffer;
    
    const voiceGain = offlineCtx.createGain();
    voiceGain.gain.value = 1.5; // Make voice prominent
    voiceSource.connect(voiceGain);
    voiceGain.connect(offlineCtx.destination);

    voiceSource.start(0.5); // Start voice slightly after music starts

    const renderedBuffer = await offlineCtx.startRendering();
    
    // 5. Save to Database and Cache
    if (db) {
      const base64 = encodeWAV(renderedBuffer);
      try {
        await setDoc(doc(db, 'assets', JINGLE_DOC_ID), {
          id: JINGLE_DOC_ID,
          name: 'Podcast Jingle',
          data: base64,
          mimeType: 'audio/wav',
          updatedAt: new Date().toISOString()
        });
        console.log("[Jingle] Saved jingle to database.");
        localStorage.setItem(JINGLE_CACHE_KEY, base64);
      } catch (e) {
        console.error("Failed to save jingle to database", e);
      }
    }

    return renderedBuffer;
  } catch (error) {
    console.error("[Jingle] Jingle generation failed completely", error);
    throw error;
  }
};

// Helper to encode AudioBuffer to WAV base64 (re-using from geminiService)
export const encodeWAV = (buffer: AudioBuffer): string => {
  const sampleRate = buffer.sampleRate;
  const numChannels = 1;
  const bitsPerSample = 16;
  const pcmData = buffer.getChannelData(0);
  const numSamples = pcmData.length;
  const dataSize = numSamples * 2;
  
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);
  
  view.setUint8(0, 'R'.charCodeAt(0));
  view.setUint8(1, 'I'.charCodeAt(0));
  view.setUint8(2, 'F'.charCodeAt(0));
  view.setUint8(3, 'F'.charCodeAt(0));
  view.setUint32(4, 36 + dataSize, true);
  view.setUint8(8, 'W'.charCodeAt(0));
  view.setUint8(9, 'A'.charCodeAt(0));
  view.setUint8(10, 'V'.charCodeAt(0));
  view.setUint8(11, 'E'.charCodeAt(0));
  view.setUint8(12, 'f'.charCodeAt(0));
  view.setUint8(13, 'm'.charCodeAt(0));
  view.setUint8(14, 't'.charCodeAt(0));
  view.setUint8(15, ' '.charCodeAt(0));
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true);
  view.setUint16(32, numChannels * bitsPerSample / 8, true);
  view.setUint16(34, bitsPerSample, true);
  view.setUint8(36, 'd'.charCodeAt(0));
  view.setUint8(37, 'a'.charCodeAt(0));
  view.setUint8(38, 't'.charCodeAt(0));
  view.setUint8(39, 'a'.charCodeAt(0));
  view.setUint32(40, dataSize, true);
  
  const wavBuffer = new Uint8Array(44 + dataSize);
  wavBuffer.set(new Uint8Array(wavHeader), 0);
  
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, pcmData[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    const offset = 44 + i * 2;
    wavBuffer[offset] = val & 0xFF;
    wavBuffer[offset + 1] = (val >> 8) & 0xFF;
  }
  
  let binary = '';
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < wavBuffer.length; i += CHUNK_SIZE) {
    const chunk = wavBuffer.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return btoa(binary);
};

export const saveJingleToCache = (buffer: AudioBuffer) => {
  const base64 = encodeWAV(buffer);
  localStorage.setItem(JINGLE_CACHE_KEY, base64);
};
