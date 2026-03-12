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

    const { review } = await req.json();

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    // Generate script
    const scriptPrompt = `
    Create a RAW, conversational, high-energy dialogue script for a music podcast session.
    Track: "${review.songTitle}" by ${review.artistName}.
    Characters: Wolf (energetic male) and Sloane (analytical female).
    Format: Wolf: [Dialogue], Sloane: [Dialogue].
  `;

    const scriptResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: scriptPrompt }
            ]
          }
        ]
      })
    });

    if (!scriptResponse.ok) {
      const error = await scriptResponse.text();
      throw new Error(`Script generation error: ${error}`);
    }

    const scriptData = await scriptResponse.json();
    const script = scriptData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Generate audio
    console.log("Script generated, length:", script.length);
    console.log("Starting audio generation...");

    const audioResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: script }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                { speaker: "Wolf", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } } },
                { speaker: "Sloane", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
              ]
            }
          }
        }
      })
    });

    if (!audioResponse.ok) {
      const error = await audioResponse.text();
      throw new Error(`Audio generation error: ${error}`);
    }

    const audioData = await audioResponse.json();
    const pcmData = audioData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!pcmData) {
      const finishReason = audioData.candidates?.[0]?.finishReason;
      throw new Error(`No audio generated. Finish reason: ${finishReason || 'unknown'}. Response: ${JSON.stringify(audioData).slice(0, 500)}`);
    }

    // Convert base64 PCM to WAV format
    const pcmBytes = Uint8Array.from(atob(pcmData), c => c.charCodeAt(0));
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = pcmBytes.length;

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
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    view.setUint8(36, 'd'.charCodeAt(0));
    view.setUint8(37, 'a'.charCodeAt(0));
    view.setUint8(38, 't'.charCodeAt(0));
    view.setUint8(39, 'a'.charCodeAt(0));
    view.setUint32(40, dataSize, true);

    const wavBuffer = new Uint8Array(44 + dataSize);
    wavBuffer.set(new Uint8Array(wavHeader), 0);
    wavBuffer.set(pcmBytes, 44);

    let binary = '';
    const CHUNK_SIZE = 0x8000;
    for (let i = 0; i < wavBuffer.length; i += CHUNK_SIZE) {
      const chunk = wavBuffer.subarray(i, i + CHUNK_SIZE);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const audioBase64 = btoa(binary);

    return new Response(
      JSON.stringify({ audio: audioBase64, script }),
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
