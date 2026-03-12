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

  const { data, error } = await supabase.functions.invoke('gemini-podcast', {
    body: { review }
  });

  if (error) {
    throw new Error(error.message || 'Failed to generate podcast');
  }

  return data;
};
