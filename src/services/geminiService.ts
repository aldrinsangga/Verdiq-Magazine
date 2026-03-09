import { GoogleGenAI, Type, Modality } from "@google/genai";

// Initialize Gemini API
// Note: process.env.GEMINI_API_KEY is injected by the platform
const getAI = () => new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY || "" });

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
    rating: { type: Type.NUMBER },
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
        overallScore: { type: Type.NUMBER },
        marketStatus: { type: Type.STRING },
        releaseConfidence: { type: Type.STRING },
        microCopy: { type: Type.STRING },
        breakdown: {
          type: Type.OBJECT,
          properties: {
            genreMomentum: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                signal: { type: Type.STRING },
                insight: { type: Type.STRING }
              }
            },
            platformFit: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                platforms: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      stars: { type: Type.NUMBER }
                    }
                  }
                },
                insight: { type: Type.STRING }
              }
            },
            marketDifferentiation: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                insight: { type: Type.STRING }
              }
            },
            longevityVsVirality: {
              type: Type.OBJECT,
              properties: {
                profile: { type: Type.STRING },
                score: { type: Type.NUMBER },
                insight: { type: Type.STRING }
              }
            },
            releaseTiming: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
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
                score: { type: Type.NUMBER },
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

export const analyzeTrack = async ({ trackName, artistName, audioBase64, audioMimeType, lyrics, bio, imageBase64, imageMimeType, preset }: any) => {
  const ai = getAI();
  
  // Fetch style guides for training
  let styleGuidesContext = "";
  try {
    const res = await fetch('/api/public/style-guides');
    if (res.ok) {
      const guides = await res.json();
      if (guides && guides.length > 0) {
        styleGuidesContext = "\nSTYLE GUIDES & WRITING VOICE EXAMPLES:\n";
        guides.forEach((guide: any, index: number) => {
          styleGuidesContext += `\nExample ${index + 1} (${guide.type} from ${guide.source}):\n${guide.content}\n`;
        });
        styleGuidesContext += "\nINSTRUCTION: Analyze the writing style, vocabulary, tone, and structure of the examples above. Mimic this professional, sharp, and authoritative music criticism voice in your review. Avoid generic AI phrasing like 'tapestry of sound' or 'sonic journey'. Be specific, opinionated, and culturally aware.\n";
      }
    }
  } catch (e) {
    console.error("Failed to fetch style guides for Gemini context", e);
  }

  const prompt = `
    TRACK METADATA:
    - Track: ${trackName}
    - Artist: ${artistName}
    - Bio: ${bio || "Independent artist."}
    - Lyrics: ${lyrics || "No lyrics provided - focus on mood, delivery, and theme implied by the music."}
    ${styleGuidesContext}
    
    REVIEW WRITING INSTRUCTIONS:
    Write a fully human-sounding music review that feels natural, emotionally sharp, and specific.
    Output must be valid JSON matching the schema.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: [
      { text: prompt },
      {
        inlineData: {
          data: audioBase64,
          mimeType: audioMimeType
        }
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: REVIEW_SCHEMA as any
    }
  });

  const review = JSON.parse(response.text || "{}");
  
  // Image transformation (optional)
  let imageUrl = `https://picsum.photos/seed/${artistName}-${trackName}/800/800`;
  if (imageBase64 && imageMimeType) {
    try {
      const imgResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [
          { text: `Transform this artist image into a magazine-cover style featured image with the word VERDIQ in the background. Preset: ${preset || 'dark'}` },
          {
            inlineData: {
              data: imageBase64,
              mimeType: imageMimeType
            }
          }
        ]
      });
      
      for (const part of imgResponse.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    } catch (e) {
      console.error("Image transformation failed", e);
    }
  }

  return { 
    ...review, 
    id: Math.random().toString(36).substring(2, 11), 
    imageUrl, 
    createdAt: new Date().toISOString() 
  };
};

export const generatePodcast = async (review: any) => {
  const ai = getAI();
  
  const scriptPrompt = `
    Create a RAW, conversational, high-energy dialogue script for a music podcast session.
    Track: "${review.songTitle}" by ${review.artistName}.
    Characters: Wolf (energetic male) and Sloane (analytical female).
    Format: Wolf: [Dialogue], Sloane: [Dialogue].
  `;

  const scriptResponse = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: scriptPrompt
  });

  const script = scriptResponse.text || "";

  const audioResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: script,
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
  });

  const pcmData = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!pcmData) throw new Error("No audio generated");

  // Convert base64 PCM to WAV format
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
  
  // Convert to base64 safely to avoid "Maximum call stack size exceeded"
  let binary = '';
  const CHUNK_SIZE = 0x8000; // 32768
  for (let i = 0; i < wavBuffer.length; i += CHUNK_SIZE) {
    const chunk = wavBuffer.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  const audioBase64 = btoa(binary);

  return { audio: audioBase64, script };
};
