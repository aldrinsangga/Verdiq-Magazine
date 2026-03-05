import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db } from "./db.ts";
import { UserAccount } from "../types.ts";
import { GoogleGenAI, Type, Modality } from "@google/genai";

dotenv.config({ override: true });

const app = express();

// Initialize Gemini API
const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing from environment variables.");
    throw new Error("GEMINI_API_KEY is missing from environment variables.");
  }
  console.log(`Using API Key starting with: ${apiKey.substring(0, 4)}... (length: ${apiKey.length})`);
  return new GoogleGenAI({ apiKey });
};

// Strip password from user objects before sending to client
const sanitizeUser = (user: UserAccount): Omit<UserAccount, 'password'> => {
  const { password, ...safe } = user;
  return safe;
};

// Helper to extract userId from mock token
const getUserIdFromAuth = (authHeader: string | undefined): string | null => {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  if (!token.startsWith('mock-jwt-token-')) return null;
  return token.replace('mock-jwt-token-', '');
};

// Middleware to check if user is admin
const isAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const userId = getUserIdFromAuth(req.headers.authorization);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  
  const user = await db.users.findOne({ id: userId });
  // Allow if user has admin role OR if it's the super admin email
  if (user && (user.role === 'admin' || user.email === 'verdiqmag@gmail.com' || user.email === 'admin@verdiq.ai')) {
    next();
  } else {
    res.status(403).json({ message: "Forbidden: Admin access required" });
  }
};

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

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// API Routes

// Auth
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await db.users.findOne({ email, password });
  if (user) {
    // Check if MFA is enabled for this user
    if ((user as any).mfaEnabled) {
      return res.json({ mfa_required: true, email });
    }

    const sanitized = sanitizeUser(user);
    res.json({
      ...sanitized,
      session: { access_token: "mock-jwt-token-" + user.id }
    });
  } else {
    res.status(401).json({ message: "Invalid credentials", detail: "Invalid credentials" });
  }
});

app.post("/api/auth/signup", async (req, res) => {
  const { email, password, name } = req.body;
  const existing = await db.users.findOne({ email });
  if (existing) {
    return res.status(400).json({ message: "User already exists", detail: "User already exists" });
  }
  const newUser: UserAccount = {
    id: Math.random().toString(36).substring(2, 11),
    email,
    password,
    name,
    credits: 3,
    isSubscribed: false,
    history: [],
    invoices: [],
    role: 'user',
    mfaEnabled: false
  };
  await db.users.insertOne(newUser);
  const sanitized = sanitizeUser(newUser);
  res.json({ ...sanitized, session: { access_token: "mock-jwt-token-" + newUser.id } });
});

app.post("/api/auth/logout", async (req, res) => {
  res.json({ success: true });
});

// Users
app.get("/api/users", isAdmin, async (req, res) => {
  const users = await db.users.find();
  res.json(users.map(sanitizeUser));
});

app.get("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  const userId = getUserIdFromAuth(req.headers.authorization);
  
  // Allow if it's the user themselves OR an admin
  const requestingUser = userId ? await db.users.findOne({ id: userId }) : null;
  const isAdminUser = requestingUser && (requestingUser.role === 'admin' || requestingUser.email === 'verdiqmag@gmail.com' || requestingUser.email === 'admin@verdiq.ai');
  
  if (id !== userId && !isAdminUser) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const user = await db.users.findOne({ id });
  if (user) {
    res.json(sanitizeUser(user));
  } else {
    res.status(404).json({ message: "User not found" });
  }
});

app.put("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  const update = req.body;
  const userId = getUserIdFromAuth(req.headers.authorization);
  
  const requestingUser = userId ? await db.users.findOne({ id: userId }) : null;
  const isAdminUser = requestingUser && (requestingUser.role === 'admin' || requestingUser.email === 'verdiqmag@gmail.com' || requestingUser.email === 'admin@verdiq.ai');

  if (id !== userId && !isAdminUser) {
    return res.status(403).json({ message: "Forbidden" });
  }

  // Prevent non-admins from promoting themselves
  if (!isAdminUser && update.role) {
    delete update.role;
  }

  const updated = await db.users.updateOne({ id }, update);
  if (updated) {
    res.json(sanitizeUser(updated));
  } else {
    res.status(404).json({ message: "User not found" });
  }
});

app.delete("/api/users/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  const deleted = await db.users.deleteOne({ id });
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ message: "User not found" });
  }
});

// Credits
app.get("/api/credits/status", async (req, res) => {
  const userId = getUserIdFromAuth(req.headers.authorization);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  
  const user = await db.users.findOne({ id: userId });
  
  if (!user) return res.status(404).json({ message: "User not found" });
  
  res.json({ 
    credits: user.credits, 
    isSubscribed: false, 
    plan: 'free' 
  });
});

app.post("/api/credits/check", async (req, res) => {
  const { action } = req.body;
  let userId = req.body.userId || getUserIdFromAuth(req.headers.authorization);

  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const cost = 3; // Both analysis and publishing cost 3 credits
  const user = await db.users.findOne({ id: userId });
  
  if (user) {
    const canAfford = user.credits >= cost;
    res.json({ 
      canAfford, 
      cost, 
      remaining: user.credits,
      message: canAfford ? "OK" : "Insufficient credits"
    });
  } else {
    res.status(404).json({ message: "User not found" });
  }
});

app.post("/api/credits/deduct", async (req, res) => {
  const { action } = req.body;
  let userId = req.body.userId || getUserIdFromAuth(req.headers.authorization);

  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const cost = 3;
  
  const user = await db.users.findOne({ id: userId });
  if (user) {
    const updated = await db.users.updateOne({ id: userId }, { 
      credits: Math.max(0, user.credits - cost) 
    });
    res.json({ success: true, deducted: cost, remaining: updated?.credits });
  } else {
    res.status(404).json({ message: "User not found" });
  }
});

// Top-up (Mock)
app.post("/api/credits/topup", async (req, res) => {
  res.json({ approval_url: `${req.body.returnUrl}&paymentId=mock_topup_id&PayerID=mock_payer_id` });
});

app.post("/api/credits/topup/execute", async (req, res) => {
  const userId = getUserIdFromAuth(req.headers.authorization);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  
  const user = await db.users.findOne({ id: userId });
  
  if (user) {
    const updated = await db.users.updateOne({ id: userId }, { 
      credits: user.credits + 50 // Mock top-up of 50 credits
    });
    res.json({ success: true, credits: updated?.credits });
  } else {
    res.status(404).json({ message: "User not found" });
  }
});

// MFA Endpoints (Mock)
app.get("/api/auth/mfa/status", async (req, res) => {
  const userId = getUserIdFromAuth(req.headers.authorization);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  
  const user = await db.users.findOne({ id: userId });
  
  res.json({ mfa_enabled: (user as any)?.mfaEnabled || false });
});

app.post("/api/auth/mfa/setup", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Unauthorized" });
  
  res.json({
    qr_code: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/Verdiq:Admin?secret=MOCKSECRET123&issuer=Verdiq",
    manual_entry_key: "MOCKSECRET123"
  });
});

app.post("/api/auth/mfa/verify-setup", async (req, res) => {
  const userId = getUserIdFromAuth(req.headers.authorization);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  
  const { code } = req.body;
  if (code === "123456" || code === "000000") {
    await db.users.updateOne({ id: userId }, { mfaEnabled: true } as any);
    res.json({ success: true });
  } else {
    res.status(400).json({ detail: "Invalid verification code. Try 123456." });
  }
});

app.post("/api/auth/mfa/verify", async (req, res) => {
  const { email, password, mfa_code } = req.body;
  const user = await db.users.findOne({ email, password });
  
  if (user && (mfa_code === "123456" || mfa_code === "000000")) {
    const sanitized = sanitizeUser(user);
    res.json({
      ...sanitized,
      session: { access_token: "mock-jwt-token-" + user.id }
    });
  } else {
    res.status(401).json({ detail: "Invalid MFA code. Try 123456." });
  }
});

// Helper for retrying Gemini calls
const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (e: any) {
    if (retries > 0 && (e.status === 429 || e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED'))) {
      console.log(`Quota hit, retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw e;
  }
};

// Analysis
app.post("/api/analyze", async (req, res) => {
  const { trackName, artistName, audioBase64, audioMimeType, lyrics, bio, imageBase64, imageMimeType, preset } = req.body;
  
  try {
    const ai = getAI();
    const prompt = `
      TRACK METADATA:
      - Track: ${trackName}
      - Artist: ${artistName}
      - Bio: ${bio || "Independent artist."}
      - Lyrics: ${lyrics || "No lyrics provided - focus on mood, delivery, and theme implied by the music."}
      
      REVIEW WRITING INSTRUCTIONS:
      Write like a real music journalist, not a content machine. 
      Your tone should feel sharp, confident, and slightly opinionated. Think magazine-style music coverage similar to NME. 
      Short paragraphs. Clear statements. No fluff.

      RULES:
      - Use active voice. Keep sentences tight and direct.
      - Mix short punchy lines with a few longer descriptive ones.
      - Add attitude when needed. Be specific about sound, mood, lyrics, and production.
      - Describe moments in the track. Point out exact details.
      - Avoid generic praise like "amazing," "incredible," or "talented."
      - No dramatic metaphors about galaxies, oceans, journeys, or landscapes.
      - Do not use cliché music writing phrases or corporate/marketing language.
      - AVOID AI BUZZWORDS: immersive, resonate, elevate, multifaceted, seamless, robust, tapestry, journey, delve, hence, moreover, nevertheless, captivating, dynamic, sonic landscape.
      - Do not write like a press release. No summary paragraph at the end of the reviewBody.

      STRUCTURE for reviewBody:
      - EXACTLY 4 paragraphs.
      1. Start with a strong hook. One or two punchy lines.
      2. Introduce the artist and track naturally. No formal bio dump.
      3. Break down the sound. Mention instruments, production choices, vocal tone, pacing.
      4. Highlight standout lyrics or moments.
      5. Add subtle critique or edge where appropriate.
      6. End on a sharp closing line that feels final, not explanatory.

      QUOTES:
      - The "hook" and "pullQuotes" must be in Title Case (e.g., "The Sound Of The Future" instead of "THE SOUND OF THE FUTURE").

      Write like someone who actually listened to the track three times and has an opinion. Keep it human. Keep it honest. Keep it tight.
      Output must be valid JSON matching the schema.
    `;

    console.log(`Starting analysis for ${trackName} by ${artistName}...`);

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: audioBase64,
              mimeType: audioMimeType || 'audio/mpeg'
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: REVIEW_SCHEMA as any
      }
    }));

    if (!response.text) {
      throw new Error("Gemini returned an empty response");
    }

    const review = JSON.parse(response.text);
    
    // Image transformation (optional)
    let imageUrl = `https://picsum.photos/seed/${artistName}-${trackName}/800/800`;
    if (imageBase64 && imageMimeType) {
      try {
        const imgResponse = await withRetry(() => ai.models.generateContent({
          model: "gemini-3.1-flash-image-preview",
          contents: {
            parts: [
              { text: `Transform this artist image. Do NOT add any editorial subtitles, headlines, or extra words. Add ONLY the bold word "VERDIQ" in the background. Maintain a professional magazine aesthetic. Preset: ${preset || 'dark'}` },
              {
                inlineData: {
                  data: imageBase64,
                  mimeType: imageMimeType
                }
              }
            ]
          }
        }));
        
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

    res.json({ ...review, id: Math.random().toString(36).substring(2, 11), imageUrl, createdAt: new Date().toISOString() });
  } catch (e: any) {
    console.error("Analysis failed with error:", e);
    if (e.response) {
      console.error("Gemini Response Error:", JSON.stringify(e.response, null, 2));
    }
    res.status(500).json({ 
      message: "Analysis failed", 
      detail: e.message || "Unknown error",
      stack: process.env.NODE_ENV !== 'production' ? e.stack : undefined
    });
  }
});

app.post("/api/generate-podcast", async (req, res) => {
  const { review } = req.body;
  
  try {
    const ai = getAI();
    const scriptPrompt = `
      Create a RAW, conversational, high-energy dialogue script for a music podcast session.
      Track: "${review.songTitle}" by ${review.artistName}.
      Characters: Wolf (charismatic, high-energy, electric male host) and Sloane (analytical, sharp, but equally passionate female host).
      Tone: Dynamic, engaging, and passionate. Wolf should be high-energy and charismatic—keep the vibe electric and fast-paced, but ensure it feels like a professional editorial discussion rather than just hype.
      Format: Wolf: [Dialogue], Sloane: [Dialogue].
      The dialogue should feel like two experts who are genuinely excited about the track, balancing raw enthusiasm with sharp musical insight.
    `;

    const scriptResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: scriptPrompt
    }));

    const script = scriptResponse.text || "";

    const audioResponse = await withRetry(() => ai.models.generateContent({
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
    }));

    const pcmData = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!pcmData) throw new Error("No audio generated");

    // Convert base64 PCM to Buffer
    const pcmBuffer = Buffer.from(pcmData, 'base64');
    
    // Convert raw PCM to WAV format
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = pcmBuffer.length;
    
    const wavHeader = Buffer.alloc(44);
    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(36 + dataSize, 4);
    wavHeader.write('WAVE', 8);
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16);
    wavHeader.writeUInt16LE(1, 20);
    wavHeader.writeUInt16LE(numChannels, 22);
    wavHeader.writeUInt32LE(sampleRate, 24);
    wavHeader.writeUInt32LE(byteRate, 28);
    wavHeader.writeUInt16LE(blockAlign, 32);
    wavHeader.writeUInt16LE(bitsPerSample, 34);
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(dataSize, 40);
    
    const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);
    const audioBase64 = wavBuffer.toString('base64');

    res.json({ audio: audioBase64, script });
  } catch (e: any) {
    console.error("Podcast generation failed", e);
    res.status(500).json({ 
      message: "Podcast generation failed",
      detail: e.message || "Unknown error"
    });
  }
});

// Reviews
app.post("/api/reviews", async (req, res) => {
  const { userId, review } = req.body;
  const user = await db.users.findOne({ id: userId });
  if (user) {
    const updatedHistory = [review, ...user.history];
    const credits = Math.max(0, user.credits - 3); // Deduct 3 credits for analysis
    const updated = await db.users.updateOne({ id: userId }, { history: updatedHistory, credits });
    if (updated) {
      res.json(sanitizeUser(updated));
    } else {
      res.status(500).json({ message: "Failed to update user" });
    }
  } else {
    res.status(404).json({ message: "User not found" });
  }
});

app.put("/api/reviews/:reviewId", async (req, res) => {
  const { reviewId } = req.params;
  const { userId, review } = req.body;
  const authUserId = getUserIdFromAuth(req.headers.authorization);
  
  const requestingUser = authUserId ? await db.users.findOne({ id: authUserId }) : null;
  const isAdminUser = requestingUser && (requestingUser.role === 'admin' || requestingUser.email === 'verdiqmag@gmail.com' || requestingUser.email === 'admin@verdiq.ai');

  if (userId !== authUserId && !isAdminUser) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const user = await db.users.findOne({ id: userId });
  if (user) {
    const updatedHistory = user.history.map(r => r.id === reviewId ? review : r);
    const updated = await db.users.updateOne({ id: userId }, { history: updatedHistory });
    if (updated) {
      res.json(sanitizeUser(updated));
    } else {
      res.status(500).json({ message: "Failed to update user" });
    }
  } else {
    res.status(404).json({ message: "User not found" });
  }
});

app.get("/api/public/published-reviews", async (req, res) => {
  const users = await db.users.find();
  const publishedReviews = users.flatMap(user => 
    (user.history || []).filter(review => review.isPublished)
  );
  res.json(publishedReviews);
});

app.get("/api/public/reviews/:id", async (req, res) => {
  const { id } = req.params;
  const users = await db.users.find();
  for (const user of users) {
    const review = user.history.find(r => r.id === id);
    if (review) return res.json(review);
  }
  res.status(404).json({ message: "Review not found" });
});

app.get("/api/reviews/:id", async (req, res) => {
  const { id } = req.params;
  const users = await db.users.find();
  for (const user of users) {
    const review = user.history.find(r => r.id === id);
    if (review) return res.json(review);
  }
  res.status(404).json({ message: "Review not found" });
});

app.get("/api/podcasts/stats", async (req, res) => {
  const users = await db.users.find();
  const playCounts: Record<string, number> = {};
  users.forEach(user => {
    user.history.forEach(review => {
      if (review.hasPodcast || review.podcastAudio) {
        playCounts[review.id] = (review as any).playCount || Math.floor(Math.random() * 100);
      }
    });
  });
  res.json({ play_counts: playCounts });
});

app.post("/api/podcasts/:id/play", async (req, res) => {
  const { id } = req.params;
  const users = await db.users.find();
  for (const user of users) {
    const reviewIndex = user.history.findIndex(r => r.id === id);
    if (reviewIndex !== -1) {
      const review = user.history[reviewIndex];
      (review as any).playCount = ((review as any).playCount || 0) + 1;
      await db.users.updateOne({ id: user.id }, { history: user.history });
      return res.json({ play_count: (review as any).playCount });
    }
  }
  res.status(404).json({ message: "Podcast not found" });
});

// Error handling for large payloads
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      message: "The session data is too large to save. Try a shorter track (under 5 mins)."
    });
  }
  next(err);
});

export default app;
