import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized: Missing authorization header');
    }

    const { trackName, artistName, audioBase64, audioMimeType, lyrics, bio, imageBase64, imageMimeType, artistPhotoBase64, artistPhotoMimeType, preset } = await req.json();

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");

    let styleGuidesContext = "";
    try {
      const guidesResponse = await fetch(`${supabaseUrl}/rest/v1/style_guides?select=*`, {
        headers: {
          'apikey': supabaseKey!,
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (guidesResponse.ok) {
        const guides = await guidesResponse.json();
        if (guides && guides.length > 0) {
          styleGuidesContext = "\nSTYLE GUIDES & WRITING VOICE EXAMPLES:\n";
          guides.forEach((guide: any, index: number) => {
            styleGuidesContext += `\nExample ${index + 1} (${guide.type} from ${guide.source}):\n${guide.content}\n`;
          });
          styleGuidesContext += "\nINSTRUCTION: You MUST strictly adopt the professional, sharp, and authoritative music criticism voice found in the examples above. This is NOT optional. Use their specific vocabulary, sentence length variation, and critical perspective. If your output sounds like a generic AI assistant, it is a failure. Be specific, opinionated, and culturally aware. Write like a human critic who has listened to thousands of records.\n";
        }
      }
    } catch (e) {
      console.error("Failed to fetch style guides:", e);
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
    The 'reviewBody' MUST be exactly 5 paragraphs long. Use actual double newlines to separate paragraphs.

    HYPERLINK INSTRUCTIONS:
    - You MUST include at least 5 relevant hyperlinks within the 'reviewBody'.
    - Use the provided 'googleSearch' tool to find real, accurate URLs.
    - CRITICAL: DO NOT use Spotify artist links as they are often broken.
    - PREFER: Wikipedia articles, official artist websites, Google Knowledge Graph links, or established music databases like AllMusic or Discogs.
    - Use Markdown format: [Link Text](URL).
    - Links should point to: The artist's history, similar established artists, genre-defining articles, or relevant music history.
    - Example: "[Radiohead](https://en.wikipedia.org/wiki/Radiohead)" or "[Hyperpop](https://en.wikipedia.org/wiki/Hyperpop)".
    - Ensure the links feel integrated into the narrative of the review.

    CRITICAL STYLE CONSTRAINTS:
    - DO NOT use generic AI filler words: "Ultimately", "Landscape", "Tapestry", "Sonic journey", "In conclusion", "Testament", "Masterpiece", "Vibrant", "Seamlessly", "Evocative", "Captivating", "Resonate", "Delve", "Dive into", "Unfold", "Crafted", "Rich", "Lush", "Intricate".
    - DO NOT use the phrase "The song is a..." or "This track is a...".
    - AVOID being overly positive. Be a critical, professional journalist. If something is weak, say it.
    - Use the provided STYLE GUIDES as your primary voice. Mimic their vocabulary and sentence structure.
    - Be specific about the production. Mention specific instruments or textures you hear.

    SCORING INSTRUCTIONS:
    - 'rating' MUST be on a scale of 0.0 to 10.0 (e.g., 8.4).
    - ALL 'marketScore' values (overallScore and all sub-scores in the breakdown) MUST be on a scale of 0 to 100 (e.g., 94).

    Output must be valid JSON matching the schema.
  `;

    // Call Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: audioMimeType,
                  data: audioBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          response_mime_type: "application/json",
          response_schema: {
            type: "object",
            properties: {
              songTitle: { type: "string" },
              artistName: { type: "string" },
              headline: { type: "string" },
              hook: { type: "string" },
              reviewBody: { type: "string" },
              breakdown: {
                type: "object",
                properties: {
                  production: { type: "string" },
                  instrumentation: { type: "string" },
                  vocals: { type: "string" },
                  lyrics: { type: "string" },
                  structure: { type: "string" },
                  emotionalImpact: { type: "string" }
                },
                required: ["production", "instrumentation", "vocals", "lyrics", "structure", "emotionalImpact"]
              },
              semanticSynergy: {
                type: "object",
                properties: {
                  score: { type: "number" },
                  analysis: { type: "string" },
                  keyThematicMatches: { type: "array", items: { type: "string" } }
                },
                required: ["score", "analysis", "keyThematicMatches"]
              },
              soundsLike: { type: "array", items: { type: "string" } },
              bestMoment: {
                type: "object",
                properties: {
                  timestamp: { type: "string" },
                  description: { type: "string" }
                },
                required: ["timestamp", "description"]
              },
              whoIsItFor: { type: "string" },
              rating: { type: "number", description: "Overall rating from 0.0 to 10.0" },
              analysis: {
                type: "object",
                properties: {
                  energy: { type: "string" },
                  mood: { type: "string" },
                  genre: { type: "string" },
                  subGenre: { type: "string" },
                  instruments: { type: "array", items: { type: "string" } },
                  vocalType: { type: "string" },
                  dynamicRange: { type: "string" }
                },
                required: ["energy", "mood", "genre", "instruments", "vocalType", "dynamicRange"]
              },
              timestampHighlights: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    timestamp: { type: "string" },
                    description: { type: "string" },
                    category: { type: "string" }
                  },
                  required: ["timestamp", "description", "category"]
                }
              },
              pullQuotes: { type: "array", items: { type: "string" } },
              seo: {
                type: "object",
                properties: {
                  metaTitle: { type: "string" },
                  metaDescription: { type: "string" },
                  focusKeyword: { type: "string" },
                  slug: { type: "string" }
                },
                required: ["metaTitle", "metaDescription", "focusKeyword", "slug"]
              },
              similarSongs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    artist: { type: "string" },
                    reason: { type: "string" }
                  },
                  required: ["title", "artist", "reason"]
                }
              },
              playlistIdeas: { type: "array", items: { type: "string" } },
              marketScore: {
                type: "object",
                properties: {
                  overallScore: { type: "number", description: "Market potential score from 0 to 100" },
                  marketStatus: { type: "string" },
                  releaseConfidence: { type: "string" },
                  microCopy: { type: "string" },
                  breakdown: {
                    type: "object",
                    properties: {
                      genreMomentum: {
                        type: "object",
                        properties: {
                          score: { type: "number", description: "Score from 0 to 100" },
                          signal: { type: "string" },
                          insight: { type: "string" }
                        }
                      },
                      platformFit: {
                        type: "object",
                        properties: {
                          score: { type: "number", description: "Score from 0 to 100" },
                          platforms: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                name: { type: "string" },
                                stars: { type: "number", description: "1-5 stars" }
                              }
                            }
                          },
                          insight: { type: "string" }
                        }
                      },
                      marketDifferentiation: {
                        type: "object",
                        properties: {
                          score: { type: "number", description: "Score from 0 to 100" },
                          insight: { type: "string" }
                        }
                      },
                      longevityVsVirality: {
                        type: "object",
                        properties: {
                          profile: { type: "string" },
                          score: { type: "number", description: "Score from 0 to 100" },
                          insight: { type: "string" }
                        }
                      },
                      releaseTiming: {
                        type: "object",
                        properties: {
                          score: { type: "number", description: "Score from 0 to 100" },
                          signal: { type: "string" },
                          insight: { type: "string" }
                        }
                      },
                      audienceDiscovery: {
                        type: "object",
                        properties: {
                          primaryPath: { type: "string" },
                          insight: { type: "string" }
                        }
                      },
                      brandAlignment: {
                        type: "object",
                        properties: {
                          score: { type: "number", description: "Score from 0 to 100" },
                          insight: { type: "string" }
                        }
                      }
                    }
                  },
                  finalSummary: { type: "string" },
                  recommendations: {
                    type: "object",
                    properties: {
                      focus: { type: "array", items: { type: "string" } },
                      avoid: { type: "array", items: { type: "string" } }
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
          }
        },
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();

    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts || parts.length === 0) {
      const finishReason = data.candidates?.[0]?.finishReason;
      throw new Error(`No review generated. Finish reason: ${finishReason || 'unknown'}. Full response: ${JSON.stringify(data).slice(0, 500)}`);
    }

    const reviewText = parts.find((p: any) => p.text)?.text;
    if (!reviewText) {
      throw new Error(`No text in response parts: ${JSON.stringify(parts).slice(0, 500)}`);
    }

    let review: any;
    try {
      review = JSON.parse(reviewText);
    } catch (e) {
      throw new Error(`Failed to parse Gemini JSON response: ${reviewText.slice(0, 500)}`);
    }

    // Handle images
    let imageUrl = imageBase64 ? `data:${imageMimeType};base64,${imageBase64}` : `https://picsum.photos/seed/${artistName}-${trackName}/800/800`;

    let artistPhotoUrl = null;
    if (artistPhotoBase64 && artistPhotoMimeType) {
      try {
        const imgResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `Transform this artist photo into a magazine-style portrait. Add the word "VERDIQ" in a big, bold, high-contrast font in the background or overlaying the image. DO NOT add any other text, titles, subtitles, or artist names. ONLY the word "VERDIQ". Use a professional editorial aesthetic. Preset: ${preset || 'dark'}` },
                  {
                    inline_data: {
                      mime_type: artistPhotoMimeType,
                      data: artistPhotoBase64
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              response_modalities: ["TEXT", "IMAGE"]
            }
          })
        });

        if (imgResponse.ok) {
          const imgData = await imgResponse.json();
          const inlineData = imgData.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
          if (inlineData) {
            artistPhotoUrl = `data:${inlineData.mimeType};base64,${inlineData.data}`;
          }
        }
      } catch (e) {
        console.error("Artist photo transformation failed", e);
        artistPhotoUrl = `data:${artistPhotoMimeType};base64,${artistPhotoBase64}`;
      }
    }

    const result = {
      ...review,
      id: crypto.randomUUID(),
      imageUrl,
      artistPhotoUrl,
      createdAt: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
