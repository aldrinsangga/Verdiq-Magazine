import { supabase } from '../supabaseClient';


export const analyzeTrack = async ({ trackName, artistName, audioBase64, audioMimeType, lyrics, bio, imageBase64, imageMimeType, artistPhotoBase64, artistPhotoMimeType, preset }: any) => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('You must be logged in to analyze tracks');
  }

  const { data, error } = await supabase.functions.invoke('gemini-analyze', {
    body: {
      trackName,
      artistName,
      audioBase64,
      audioMimeType,
      lyrics,
      bio,
      imageBase64,
      imageMimeType,
      artistPhotoBase64,
      artistPhotoMimeType,
      preset
    }
  });

  if (error) {
    console.error('Edge Function Error:', error);
    throw new Error(error.message || 'Failed to analyze track');
  }

  return data;
};

export const generatePodcast = async (review: any) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('You must be logged in to generate a podcast');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(`${supabaseUrl}/functions/v1/gemini-podcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'Apikey': supabaseAnonKey,
    },
    body: JSON.stringify({ review }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errJson = JSON.parse(responseText);
      errorMessage = errJson.error || errJson.message || errorMessage;
    } catch {
      errorMessage = responseText || errorMessage;
    }
    throw new Error(`Podcast generation error: ${errorMessage}`);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error('Invalid response from podcast service');
  }
};
