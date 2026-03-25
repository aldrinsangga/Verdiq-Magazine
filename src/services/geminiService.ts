import { GoogleGenAI, Type, Modality } from "@google/genai";
import { getAuthHeaders } from '../authClient';

const API_URL = (import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL !== 'undefined') 
  ? import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') 
  : '';

// Initialize Gemini API
// Note: process.env.GEMINI_API_KEY is injected by the platform
let runtimeApiKey: string | null = null;

const getAI = async () => {
  if (runtimeApiKey) return new GoogleGenAI({ apiKey: runtimeApiKey });

  // 1. Try build-time injected key
  let apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  
  // 2. If missing, try to fetch from server (runtime environment)
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

  if (!apiKey) {
    console.error("GEMINI_API_KEY is not defined in the environment.");
  } else {
    runtimeApiKey = apiKey;
  }
  
  return new GoogleGenAI({ apiKey: apiKey || "" });
};

// Basic prompt injection protection
const sanitizeInput = (text: string | null | undefined): string => {
  if (!text) return "";
  // Remove potential prompt injection keywords and excessive whitespace
  return text
    .replace(/ignore previous instructions/gi, "[REDACTED]")
    .replace(/system instruction/gi, "[REDACTED]")
    .replace(/you are a/gi, "[REDACTED]")
    .replace(/\s+/g, " ")
    .trim();
};

const checkQuota = async () => {
  try {
    const headers = await getAuthHeaders();
    if (!headers.Authorization) {
      console.warn("[Quota] No auth headers found, skipping preflight check");
      return { success: true };
    }

    // Use ai/preflight as the preflight check
    const res = await fetch(`${API_URL}/api/ai/preflight`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
    
    if (res.status === 429) {
      const data = await res.json();
      const error = new Error(data.message || "AI Quota Exceeded");
      (error as any).type = 'QUOTA';
      (error as any).quotaType = data.type;
      (error as any).instruction = data.instruction;
      throw error;
    }
    
    if (!res.ok) {
      console.warn("Quota check failed but continuing:", res.status);
    }
    
    return { success: true };
  } catch (e: any) {
    console.error("[Quota] Error during preflight check:", e);
    throw e;
  }
};

async function generateWithRetryAndFallback(
  ai: GoogleGenAI,
  primaryModel: string,
  fallbackModels: string[],
  params: any,
  maxRetries = 3
) {
  const modelsToTry = [primaryModel, ...fallbackModels];
  let lastError: any = null;
  
  for (const model of modelsToTry) {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        console.log(`[Gemini] Attempting generation with model: ${model} (Attempt ${retries + 1}/${maxRetries})`);
        return await ai.models.generateContent({
          ...params,
          model: model
        });
      } catch (error: any) {
        lastError = error;
        const errorMessage = error?.message || String(error);
        const isQuotaOrRateLimit = errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED');
        const isServerError = errorMessage.includes('500') || errorMessage.includes('503') || errorMessage.includes('502');
        
        if (isQuotaOrRateLimit || isServerError) {
          retries++;
          if (retries >= maxRetries) {
            console.warn(`[Gemini] Model ${model} failed after ${maxRetries} retries. Moving to next fallback if available.`);
            break; // Break the while loop, go to the next model in the for loop
          }
          // Exponential backoff: 1s, 2s, 4s...
          const delay = Math.pow(2, retries - 1) * 1000 + Math.random() * 1000;
          console.log(`[Gemini] Retrying model ${model} in ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // For 403 (Permission Denied) or 404 (Not Found), we should try the next model
          console.warn(`[Gemini] Non-retryable error with model ${model}:`, errorMessage, `. Moving to next fallback if available.`);
          break; // Break the while loop, go to the next model
        }
      }
    }
  }
  console.error("[Gemini] All models and retries failed.");
  throw lastError || new Error("All models and retries failed due to quota or server errors.");
}

// Review schema for structured output
const REVIEW_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    songTitle: { type: Type.STRING },
    artistName: { type: Type.STRING },
    headline: { type: Type.STRING },
    hook: { type: Type.STRING },
    reviewBody: { type: Type.STRING },
    breakdown: {
      type: Type.OBJECT,
      properties: {
        production: { type: Type.STRING },
        instrumentation: { type: Type.STRING },
        vocals: { type: Type.STRING },
        lyrics: { type: Type.STRING },
        structure: { type: Type.STRING },
        emotionalImpact: { type: Type.STRING }
      },
      required: ["production", "instrumentation", "vocals", "lyrics", "structure", "emotionalImpact"]
    },
    semanticSynergy: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.NUMBER },
        analysis: { type: Type.STRING },
        keyThematicMatches: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["score", "analysis", "keyThematicMatches"]
    },
    soundsLike: { type: Type.ARRAY, items: { type: Type.STRING } },
    bestMoment: {
      type: Type.OBJECT,
      properties: {
        timestamp: { type: Type.STRING },
        description: { type: Type.STRING }
      },
      required: ["timestamp", "description"]
    },
    whoIsItFor: { type: Type.STRING },
    rating: { type: Type.NUMBER, description: "Overall rating from 0.0 to 10.0" },
    analysis: {
      type: Type.OBJECT,
      properties: {
        energy: { type: Type.STRING },
        mood: { type: Type.STRING },
        genre: { type: Type.STRING },
        subGenre: { type: Type.STRING },
        instruments: { type: Type.ARRAY, items: { type: Type.STRING } },
        vocalType: { type: Type.STRING },
        dynamicRange: { type: Type.STRING }
      },
      required: ["energy", "mood", "genre", "instruments", "vocalType", "dynamicRange"]
    },
    timestampHighlights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          timestamp: { type: Type.STRING },
          description: { type: Type.STRING },
          category: { type: Type.STRING }
        },
        required: ["timestamp", "description", "category"]
      }
    },
    pullQuotes: { type: Type.ARRAY, items: { type: Type.STRING } },
    seo: {
      type: Type.OBJECT,
      properties: {
        metaTitle: { type: Type.STRING },
        metaDescription: { type: Type.STRING },
        focusKeyword: { type: Type.STRING },
        slug: { type: Type.STRING }
      },
      required: ["metaTitle", "metaDescription", "focusKeyword", "slug"]
    },
    similarSongs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          artist: { type: Type.STRING },
          reason: { type: Type.STRING }
        },
        required: ["title", "artist", "reason"]
      }
    },
    playlistIdeas: { type: Type.ARRAY, items: { type: Type.STRING } },
    marketScore: {
      type: Type.OBJECT,
      properties: {
        overallScore: { type: Type.NUMBER, description: "Market potential score from 0 to 100" },
        marketStatus: { type: Type.STRING },
        releaseConfidence: { type: Type.STRING },
        microCopy: { type: Type.STRING },
        breakdown: {
          type: Type.OBJECT,
          properties: {
            genreMomentum: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER, description: "Score from 0 to 100" },
                signal: { type: Type.STRING },
                insight: { type: Type.STRING }
              }
            },
            platformFit: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER, description: "Score from 0 to 100" },
                platforms: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      stars: { type: Type.NUMBER, description: "1-5 stars" }
                    }
                  }
                },
                insight: { type: Type.STRING }
              }
            },
            marketDifferentiation: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER, description: "Score from 0 to 100" },
                insight: { type: Type.STRING }
              }
            },
            longevityVsVirality: {
              type: Type.OBJECT,
              properties: {
                profile: { type: Type.STRING },
                score: { type: Type.NUMBER, description: "Score from 0 to 100" },
                insight: { type: Type.STRING }
              }
            },
            releaseTiming: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER, description: "Score from 0 to 100" },
                signal: { type: Type.STRING },
                insight: { type: Type.STRING }
              }
            },
            audienceDiscovery: {
              type: Type.OBJECT,
              properties: {
                primaryPath: { type: Type.STRING },
                insight: { type: Type.STRING }
              }
            },
            brandAlignment: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER, description: "Score from 0 to 100" },
                insight: { type: Type.STRING }
              }
            }
          }
        },
        finalSummary: { type: Type.STRING },
        recommendations: {
          type: Type.OBJECT,
          properties: {
            focus: { type: Type.ARRAY, items: { type: Type.STRING } },
            avoid: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    }
  },
  required: [
    "songTitle", "artistName", "headline", "hook", "reviewBody", "breakdown", "semanticSynergy",
    "soundsLike", "bestMoment", "whoIsItFor", "rating", "analysis",
    "timestampHighlights", "pullQuotes", "seo", "similarSongs", "playlistIdeas", "marketScore"
  ]
};

export const analyzeTrack = async ({ trackName, artistName, audioBase64, audioMimeType, lyrics, bio, imageBase64, imageMimeType, artistPhotoBase64, artistPhotoMimeType, preset }: any) => {
  // 1. Check Quota
  await checkQuota();
  
  const ai = await getAI();
  
  // 2. Sanitize Inputs
  const safeTrackName = sanitizeInput(trackName);
  const safeArtistName = sanitizeInput(artistName);
  const safeLyrics = sanitizeInput(lyrics);
  const safeBio = sanitizeInput(bio);
  
  // Fetch style guides for training
  let styleGuidesContext = "";
  try {
    const res = await fetch(`${API_URL}/api/public/style-guides`);
    if (res.ok) {
      const guides = await res.json();
      if (guides && guides.length > 0) {
        styleGuidesContext = "\nSTYLE GUIDES & WRITING VOICE EXAMPLES:\n";
        guides.forEach((guide: any, index: number) => {
          styleGuidesContext += `\nExample ${index + 1} (${guide.type} from ${guide.source}):\n${guide.content}\n`;
        });
        styleGuidesContext += "\nINSTRUCTION: You MUST strictly adopt the professional, sharp, and authoritative music criticism voice found in the examples above. This is NOT optional. Use their specific vocabulary, sentence length variation, and critical perspective. If your output sounds like a generic AI assistant, it is a failure. Be specific, opinionated, and culturally aware. Write like a human critic who has listened to thousands of records.\n";
      }
    }
  } catch (e) {
    console.error("Failed to fetch style guides for Gemini context", e);
  }

  const prompt = `
    TRACK METADATA:
    - Track: ${safeTrackName}
    - Artist: ${safeArtistName}
    - Bio: ${safeBio || "Independent artist."}
    - Lyrics: ${safeLyrics || "No lyrics provided - focus on mood, delivery, and theme implied by the music."}
    ${styleGuidesContext}
    
    REVIEW WRITING INSTRUCTIONS (STOP-SLOP PROTOCOL):
    Write a fully human-sounding music review that feels natural, emotionally sharp, specific, and charged with the raw excitement of a true fan. Treat the review as a short story about an encounter with a piece of art—build a narrative that connects technical details to a larger emotional truth.
    The 'reviewBody' MUST be exactly 5 paragraphs long. Use actual double newlines to separate paragraphs.
    
    CORE WRITING RULES:
    1. CUT FILLER: Remove throat-clearing openers and emphasis crutches.
    2. BREAK FORMULAS: Avoid binary contrasts ("Not X, but Y"), negative listings, and rhetorical setups.
    3. EMOTIONAL RESONANCE: Share what the music actually feels like to listen to. Use longer, flowing, descriptive sentences to build an emotional atmosphere. Don't just list technical facts; describe the human experience of hearing the track.
    4. BE SPECIFIC: No vague declaratives ("The implications are significant"). Name the specific thing. No lazy extremes ("every," "always," "never").
    5. VARY RHYTHM: Embrace longer, complex, flowing sentences that tell a story. Avoid stacking short, choppy, declarative sentences back-to-back, as this creates a cold, robotic tone.
    6. CONVERSATIONAL FLOW: Write like a passionate human speaking freely. Use conjunctions (and, but, so, because) to connect ideas into sweeping, poetic sentences. Do not write in a staccato, telegraphic style.
    7. NO EM DASHES: Do not use em dashes (—) anywhere in the text. Use commas or parentheses instead if you need to separate clauses.
    8. 100% CELEBRATORY & UPLIFTING: This review must be an absolute celebration of the artist's work. Focus entirely on the strengths, the magic, and the unique brilliance of the track. Make the artist feel incredibly proud of what they've created. This should be the kind of glowing, passionate review they immediately want to share with their fans.
    9. VISCERAL EXCITEMENT: Don't just analyze; celebrate. Convey the physical thrill, the emotional gut-punch, and the sheer joy of the track. Write with the energy of someone who just heard their new favorite song and can't wait to tell the world.
    10. HUMAN QUIRKS: Use contractions (it's, don't, can't) naturally. Write at an accessible reading level. Avoid overly academic or formal language, but remain professional.
    11. NARRATIVE ARC: Every review should have a beginning, middle, and end. Start with a hook that sets a scene or a mood, explore the track's internal world, and conclude with a definitive statement on its place in the listener's life.
    12. ACTIVE VOICE: Use active voice where possible. Instead of "The track is driven by a bassline", write "A bassline drives the track".
    13. FIRST PERSON: You may occasionally use the first person ('I', 'me', 'my') to share a personal reaction, but keep the focus primarily on the artist and the music.
    
    STRUCTURAL VARIETY & PACING (BURSTINESS):
    - Vary your sentence structures wildly. Mix extremely long, rambling, passionate sentences with very short, punchy fragments.
    - Paragraphs MUST NOT be of equal length. Make one paragraph very long and detailed, and the next paragraph just one or two sentences.
    - Avoid symmetrical, perfectly balanced writing. Human writing is slightly messy and unpredictable.
    - Avoid "The [Subject] is [Adjective]" sentence patterns.
    - Start sentences with conjunctions occasionally (And, But, Because) to sound more conversational.
    
    CRITICAL: If lyrics are provided, you MUST ensure any quotes used in the review are 100% accurate and verbatim from the provided text. Do not hallucinate or misquote lyrics.
    
    HYPERLINK INSTRUCTIONS:
    - You MUST include at least 5 relevant hyperlinks within the 'reviewBody'.
    - Use the provided 'googleSearch' tool to find real, accurate URLs.
    - CRITICAL: DO NOT use Spotify artist links as they are often broken.
    - PREFER: Wikipedia articles, official artist websites, Google Knowledge Graph links, or established music databases like AllMusic or Discogs.
    - Use Markdown format: [Link Text](URL).
    - Links should point to: The artist's history, similar established artists, genre-defining articles, or relevant music history.
    - Example: "[Radiohead](https://en.wikipedia.org/wiki/Radiohead)" or "[Hyperpop](https://en.wikipedia.org/wiki/Hyperpop)".
    - Ensure the links feel integrated into the narrative of the review.
    
    CRITICAL STYLE CONSTRAINTS (BANNED AI TELLS):
    - DO NOT start any paragraph with: "Musically", "Lyrically", "Vocally", "Ultimately", "Overall", "Finally", "The track", "This song", "Here's", "It turns out", "The truth is", "In the end".
    - FORBIDDEN WORDS: "soundscape", "journey", "captures", "prowess", "sonic", "tapestry", "testament", "masterpiece", "vibrant", "seamlessly", "evocative", "captivating", "resonate", "delve", "dive into", "unfold", "crafted", "rich", "lush", "intricate", "landscape", "presents", "showcases", "navigate", "unpack", "lean into", "game-changer", "really", "just", "literally", "genuinely", "honestly", "simply", "actually", "deeply", "truly", "fundamentally", "inherently", "inevitably", "interestingly", "importantly", "crucially", "undeniable", "infectious", "palpable", "soars", "ethereal", "mesmerizing", "transcends", "delivers", "solidifies", "proves", "embodies", "embodying", "echoes", "encapsulated", "encapsulates".
    - FORBIDDEN PHRASES: "Not just.. it's..", "The song is a...", "This track is a...", "A testament to...", "In conclusion", "At its core", "With its...", "From the opening...", "Let that sink in", "Make no mistake", "Here's why that matters", "Full stop", "It's worth noting", "At the end of the day", "When it comes to", "In a world where", "The reality is", "feature, not a bug", "I promise", "It's safe to say", "Leaves a lasting impression".
    - BE A CHAMPION FOR THE ARTIST: Write with the enthusiasm of a dedicated fan or a passionate music blogger discovering a hidden gem. Build them up. Write like a human on a forum or a blog, not a PR machine.
    - Use the provided STYLE GUIDES as your primary voice. Mimic their vocabulary and passion, but ensure the sentence rhythm is warm, flowing, and conversational.
    - Be specific about the production. Mention specific instruments, mixing choices, or textures you hear.
    
    REVIEW STRUCTURE VARIATIONS (Choose one randomly for each review and STICK TO IT):
    1. THE CULTURAL CRITIC: Start with the broader musical landscape or a specific trend this track responds to. Focus on "Why this matters now."
    2. THE TECHNICAL AUTOPSY: Lead with a striking production detail (a specific synth tone, a vocal quirk). Build the review around the "How it was made."
    3. THE EMOTIONAL ARC: Focus on the visceral reaction. Start with the feeling of the first 10 seconds and track how that feeling evolves or dissolves.
    4. THE COMPARATIVE ESSAY: Position the artist against a contemporary rival or a historical influence. Use the comparison to highlight what makes this track unique or derivative.
    5. THE LYRICAL DISSECTION: If lyrics are present, lead with a specific line. Analyze the songwriting as poetry/prose first, then bring in the music as the "delivery vehicle."
    6. THE REBEL REVIEW: Start with a contrarian take. If the song is "chill," talk about its hidden tension. If it's "loud," talk about its emptiness.
    
    SELF-CORRECTION BEFORE OUTPUT:
    Does this sound like a generic AI? If yes, rewrite it. Use more specific nouns and fewer generic adjectives. Make it sound like it was written by someone who has a physical physical copy of the record in their hands.
    
    SCORING INSTRUCTIONS:
    - 'rating' MUST be on a scale of 0.0 to 10.0 (e.g., 8.4).
    - ALL 'marketScore' values (overallScore and all sub-scores in the breakdown) MUST be on a scale of 0 to 100 (e.g., 94).
    
    Output must be valid JSON matching the schema.
  `;

  const reviewPromise = generateWithRetryAndFallback(
    ai,
    "gemini-3.1-pro-preview", // Primary model
    ["gemini-3-flash-preview", "gemini-flash-latest"], // Fallbacks
    {
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: audioBase64,
              mimeType: audioMimeType
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: REVIEW_SCHEMA as any,
        tools: [{ googleSearch: {} }]
      }
    }
  );

  let artistPhotoPromise = Promise.resolve(null);
  if (artistPhotoBase64 && artistPhotoMimeType) {
    artistPhotoPromise = generateWithRetryAndFallback(
      ai,
      "gemini-2.5-flash-image", // Primary model
      [], // Fallback
      {
        contents: {
          parts: [
            {
              inlineData: {
                data: artistPhotoBase64,
                mimeType: artistPhotoMimeType
              }
            },
            { text: `Transform this artist photo into a magazine-style portrait. Add the word "VERDIQ" in a big, bold, high-contrast font in the background or overlaying the image. DO NOT add any other text, titles, subtitles, or artist names. ONLY the word "VERDIQ". Use a professional editorial aesthetic. Preset: ${preset || 'dark'}` }
          ]
        }
      }
    ).then(imgResponse => {
      for (const part of imgResponse.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      return null;
    }).catch(e => {
      console.error("Artist photo transformation failed", e);
      // Fallback to original artist photo if AI fails
      return `data:${artistPhotoMimeType};base64,${artistPhotoBase64}`;
    });
  }

  const [response, artistPhotoUrl] = await Promise.all([reviewPromise, artistPhotoPromise]);

  const review = JSON.parse(response.text || "{}");
  
  // Cover Art (at top of review) - use original if provided
  let imageUrl = imageBase64 ? `data:${imageMimeType};base64,${imageBase64}` : `https://picsum.photos/seed/${artistName}-${trackName}/800/800`;

  return { 
    ...review, 
    id: Math.random().toString(36).substring(2, 11), 
    imageUrl,
    artistPhotoUrl,
    createdAt: new Date().toISOString() 
  };
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

// Helper to encode AudioBuffer to WAV base64
const encodeWAV = (buffer: AudioBuffer): string => {
  const sampleRate = buffer.sampleRate;
  const numChannels = 1;
  const bitsPerSample = 16;
  const pcmData = buffer.getChannelData(0);
  const numSamples = pcmData.length;
  const dataSize = numSamples * 2;
  
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);
  
  // RIFF identifier
  view.setUint8(0, 'R'.charCodeAt(0));
  view.setUint8(1, 'I'.charCodeAt(0));
  view.setUint8(2, 'F'.charCodeAt(0));
  view.setUint8(3, 'F'.charCodeAt(0));
  // file length
  view.setUint32(4, 36 + dataSize, true);
  // WAVE identifier
  view.setUint8(8, 'W'.charCodeAt(0));
  view.setUint8(9, 'A'.charCodeAt(0));
  view.setUint8(10, 'V'.charCodeAt(0));
  view.setUint8(11, 'E'.charCodeAt(0));
  // fmt chunk identifier
  view.setUint8(12, 'f'.charCodeAt(0));
  view.setUint8(13, 'm'.charCodeAt(0));
  view.setUint8(14, 't'.charCodeAt(0));
  view.setUint8(15, ' '.charCodeAt(0));
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate
  view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true);
  // block align
  view.setUint16(32, numChannels * bitsPerSample / 8, true);
  // bits per sample
  view.setUint16(34, bitsPerSample, true);
  // data chunk identifier
  view.setUint8(36, 'd'.charCodeAt(0));
  view.setUint8(37, 'a'.charCodeAt(0));
  view.setUint8(38, 't'.charCodeAt(0));
  view.setUint8(39, 'a'.charCodeAt(0));
  // data chunk length
  view.setUint32(40, dataSize, true);
  
  const wavBuffer = new Uint8Array(44 + dataSize);
  wavBuffer.set(new Uint8Array(wavHeader), 0);
  
  // Convert float to 16-bit PCM
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, pcmData[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    const offset = 44 + i * 2;
    wavBuffer[offset] = val & 0xFF;
    wavBuffer[offset + 1] = (val >> 8) & 0xFF;
  }
  
  // Convert to base64 safely
  let binary = '';
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < wavBuffer.length; i += CHUNK_SIZE) {
    const chunk = wavBuffer.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return btoa(binary);
};

export const generatePodcast = async (trackName: string, artistName: string, originalAudioBase64?: string) => {
  // Check Quota
  await checkQuota();
  
  const ai = await getAI();
  
  const scriptPrompt = `
    Create a RAW, conversational, high-energy dialogue script for a music podcast session.
    Track: "${trackName}" by ${artistName}.
    Characters: Wolf (energetic male) and Sloane (analytical female).
    Format: Wolf: [Dialogue], Sloane: [Dialogue].
  `;

  const scriptResponse = await generateWithRetryAndFallback(
    ai,
    "gemini-3.1-pro-preview", // Primary model
    ["gemini-3-flash-preview", "gemini-flash-latest"], // Fallbacks
    {
      contents: scriptPrompt
    }
  );

  const script = scriptResponse.text || "";

  const audioResponse = await generateWithRetryAndFallback(
    ai,
    "gemini-2.5-flash-preview-tts", // Primary model
    [], // No fallback for TTS currently
    {
      contents: [{ parts: [{ text: script }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              { speaker: "Wolf", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } } },
              { speaker: "Sloane", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
            ]
          }
        }
      }
    }
  );

  const pcmData = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!pcmData) throw new Error("No audio generated");

  // If original audio is provided, mix it as background music
  if (originalAudioBase64) {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Convert raw PCM from Gemini (24kHz, 16-bit) to Float32 for AudioBuffer
      const pcmBuffer = Uint8Array.from(atob(pcmData), c => c.charCodeAt(0));
      const floatData = new Float32Array(pcmBuffer.length / 2);
      const dataView = new DataView(pcmBuffer.buffer);
      for (let i = 0; i < floatData.length; i++) {
        floatData[i] = dataView.getInt16(i * 2, true) / 32768;
      }
      
      const podcastBuffer = audioContext.createBuffer(1, floatData.length, 24000);
      podcastBuffer.getChannelData(0).set(floatData);
      
      // Decode original audio
      const songBuffer = await decodeAudio(originalAudioBase64, audioContext);
      
      // Mix using OfflineAudioContext
      const offlineCtx = new OfflineAudioContext(1, podcastBuffer.length, podcastBuffer.sampleRate);
      
      const podcastSource = offlineCtx.createBufferSource();
      podcastSource.buffer = podcastBuffer;
      podcastSource.connect(offlineCtx.destination);
      
      const songSource = offlineCtx.createBufferSource();
      songSource.buffer = songBuffer;
      
      const gainNode = offlineCtx.createGain();
      gainNode.gain.value = 0.12; // Subtle background music
      
      songSource.connect(gainNode);
      gainNode.connect(offlineCtx.destination);
      
      podcastSource.start(0);
      songSource.start(0);
      songSource.loop = true; // Loop the song clip if it's shorter than the podcast
      
      const renderedBuffer = await offlineCtx.startRendering();
      const mixedAudioBase64 = encodeWAV(renderedBuffer);
      
      return { audio: mixedAudioBase64, script };
    } catch (err) {
      console.error("Audio mixing failed, falling back to raw TTS", err);
    }
  }

  // Fallback to standard WAV encoding if mixing fails or no original audio
  const pcmBuffer = Uint8Array.from(atob(pcmData), c => c.charCodeAt(0));
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = pcmBuffer.length;
  
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);
  
  // RIFF identifier
  view.setUint8(0, 'R'.charCodeAt(0));
  view.setUint8(1, 'I'.charCodeAt(0));
  view.setUint8(2, 'F'.charCodeAt(0));
  view.setUint8(3, 'F'.charCodeAt(0));
  // file length
  view.setUint32(4, 36 + dataSize, true);
  // WAVE identifier
  view.setUint8(8, 'W'.charCodeAt(0));
  view.setUint8(9, 'A'.charCodeAt(0));
  view.setUint8(10, 'V'.charCodeAt(0));
  view.setUint8(11, 'E'.charCodeAt(0));
  // fmt chunk identifier
  view.setUint8(12, 'f'.charCodeAt(0));
  view.setUint8(13, 'm'.charCodeAt(0));
  view.setUint8(14, 't'.charCodeAt(0));
  view.setUint8(15, ' '.charCodeAt(0));
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, byteRate, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitsPerSample, true);
  // data chunk identifier
  view.setUint8(36, 'd'.charCodeAt(0));
  view.setUint8(37, 'a'.charCodeAt(0));
  view.setUint8(38, 't'.charCodeAt(0));
  view.setUint8(39, 'a'.charCodeAt(0));
  // data chunk length
  view.setUint32(40, dataSize, true);
  
  const wavBuffer = new Uint8Array(44 + dataSize);
  wavBuffer.set(new Uint8Array(wavHeader), 0);
  wavBuffer.set(pcmBuffer, 44);
  
  // Convert to base64 safely
  let binary = '';
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < wavBuffer.length; i += CHUNK_SIZE) {
    const chunk = wavBuffer.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  const audioBase64 = btoa(binary);

  return { audio: audioBase64, script };
};
