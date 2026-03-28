import { useCallback } from 'react';
import { isAdmin, getAuthHeaders } from '../authClient';
import { analyzeTrack, generatePodcast } from '../services/geminiService';

export function useAppActions(
  currentUser: any,
  setCurrentUser: React.Dispatch<React.SetStateAction<any>>,
  setCreditStatus: React.Dispatch<React.SetStateAction<any>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setStatus: React.Dispatch<React.SetStateAction<string>>,
  currentReview: any,
  setCurrentReview: React.Dispatch<React.SetStateAction<any>>,
  setCurrentAudioFile: React.Dispatch<React.SetStateAction<any>>,
  setUsers: React.Dispatch<React.SetStateAction<any[]>>,
  setAdminUsers: React.Dispatch<React.SetStateAction<any>>,
  setAdminReviews: React.Dispatch<React.SetStateAction<any>>,
  setAllReviews: React.Dispatch<React.SetStateAction<any[]>>,
  setStyleGuides: React.Dispatch<React.SetStateAction<any[]>>,
  setTargetPodcastId: React.Dispatch<React.SetStateAction<string | null>>,
  setShowCreditModal: React.Dispatch<React.SetStateAction<boolean>>,
  setCreditModalConfig: React.Dispatch<React.SetStateAction<any>>,
  showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void,
  navigate: (view: string, extra?: string | null, overrideUser?: any) => void,
  navigateToReview: (review: any, viewOnly?: boolean) => void,
  fetchReviewWithAudio: (id: string) => Promise<any>,
  API_URL: string,
  analysisCancelledRef: React.MutableRefObject<boolean>,
  compressImage: (base64Str: string, maxWidth?: number, maxHeight?: number) => Promise<unknown>,
  saveSessionLocal: (user: any) => void,
  getAuthHeadersLocal: () => Promise<any>,
  fetchWithTimeout: (url: string, options?: any, timeout?: number) => Promise<Response>
) {
  const fetchAdminUsers = useCallback(async (offset = 0, limit = 20, search = "") => {
    if (!isAdmin(currentUser)) return;
    try {
      const headers = await getAuthHeadersLocal();
      const res = await fetch(`${API_URL}/api/users?offset=${offset}&limit=${limit}&search=${encodeURIComponent(search)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAdminUsers(data);
        setUsers(data.users);
      }
    } catch (e) {
      console.error("Failed to fetch admin users", e);
    }
  }, [currentUser, API_URL, getAuthHeadersLocal, setAdminUsers, setUsers]);

  const fetchAdminReviews = useCallback(async (offset = 0, limit = 20) => {
    if (!isAdmin(currentUser)) return;
    try {
      const headers = await getAuthHeadersLocal();
      const res = await fetch(`${API_URL}/api/admin/reviews?offset=${offset}&limit=${limit}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAdminReviews(data);
        setAllReviews(data.reviews);
      }
    } catch (e) {
      console.error("Failed to fetch admin reviews", e);
    }
  }, [currentUser, API_URL, getAuthHeadersLocal, setAdminReviews, setAllReviews]);

  const fetchCreditStatus = useCallback(async () => {
    try {
      const headers = await getAuthHeadersLocal();
      const res = await fetch(`${API_URL}/api/credits/status`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCreditStatus(data);
        return data;
      }
    } catch (e) {
      console.error('Failed to fetch credit status:', e);
    }
    return null;
  }, [API_URL, getAuthHeadersLocal, setCreditStatus]);

  const checkCreditsForAction = useCallback(async (action: string) => {
    try {
      const headers = await getAuthHeadersLocal();
      const res = await fetch(`${API_URL}/api/credits/check`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (!data.canAfford) {
          setCreditModalConfig({
            action,
            required: data.cost || 0,
            reason: data.reason,
            message: data.message,
            isFreeUser: data.reason === 'review_limit' || data.reason === 'feature_locked'
          });
          setShowCreditModal(true);
          return false;
        }
        return true;
      }
    } catch (e) {
      console.error('Credit check error:', e);
    }
    return false;
  }, [API_URL, getAuthHeadersLocal, setCreditModalConfig, setShowCreditModal]);

  const fetchStyleGuides = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/public/style-guides`);
      if (res.ok) {
        const data = await res.json();
        setStyleGuides(data);
      }
    } catch (e) {
      console.error("Failed to fetch style guides", e);
    }
  }, [API_URL, setStyleGuides]);

  const handleUpdateProfile = useCallback(async (userData: any) => {
    const headers = await getAuthHeadersLocal();
    const targetUserId = userData.id || currentUser?.id;
    const res = await fetch(`${API_URL}/api/users/${targetUserId}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    if (res.ok) {
      const updatedUser = await res.json();
      if (updatedUser.id === currentUser?.id) {
        setCurrentUser(updatedUser);
        saveSessionLocal(updatedUser);
      } else {
        // Update admin user lists if it's another user
        setUsers((prev: any[]) => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        setAdminUsers((prev: any) => ({
          ...prev,
          users: prev.users?.map((u: any) => u.id === updatedUser.id ? updatedUser : u) || []
        }));
      }
      showNotification("Profile updated successfully", "success");
      return updatedUser;
    } else {
      const err = await res.json();
      showNotification(err.detail || "Failed to update profile", "error");
      throw new Error(err.detail || "Failed to update profile");
    }
  }, [currentUser, API_URL, getAuthHeadersLocal, setCurrentUser, saveSessionLocal, setUsers, setAdminUsers, showNotification]);

  const handleAnalyze = useCallback(async (data: any) => {
    if (!currentUser) {
      navigate('auth');
      return;
    }

    const canProceed = await checkCreditsForAction('review');
    if (!canProceed) return;

    setLoading(true);
    setStatus("Extracting Technical Features...");
    analysisCancelledRef.current = false;
    
    try {
      setCurrentAudioFile(data.audioFile);
      
      const audioBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(data.audioFile);
      });

      if (analysisCancelledRef.current) return;

      let imageBase64 = null;
      let imageMimeType = null;
      if (data.featuredPhoto) {
        const imgData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(data.featuredPhoto);
        });
        const rawBase64 = (imgData as string);
        imageBase64 = (await compressImage(rawBase64, 1200, 1200) as string).split(',')[1];
        imageMimeType = 'image/jpeg';
      }

      if (analysisCancelledRef.current) return;

      let artistPhotoBase64 = null;
      let artistPhotoMimeType = null;
      if (data.artistPhoto) {
        const artistImgData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(data.artistPhoto);
        });
        const rawArtistBase64 = (artistImgData as string);
        artistPhotoBase64 = (await compressImage(rawArtistBase64, 1000, 1000) as string).split(',')[1];
        artistPhotoMimeType = 'image/jpeg';
      }

      if (analysisCancelledRef.current) return;

      setStatus("Writing editorial draft & synthesizing voices...");
      
      const reviewPromise = analyzeTrack({
        trackName: data.songTitle,
        artistName: data.artistName,
        audioBase64: audioBase64,
        audioMimeType: data.audioFile.type,
        lyrics: data.lyrics || '',
        bio: data.bio || '',
        imageBase64: imageBase64,
        imageMimeType: imageMimeType,
        artistPhotoBase64: artistPhotoBase64,
        artistPhotoMimeType: artistPhotoMimeType,
        preset: data.stylePreset || 'dark'
      });

      const podcastPromise = generatePodcast(
        data.songTitle, 
        data.artistName, 
        audioBase64 as string
      ).catch(err => {
        console.error("Podcast generation failed", err);
        return { error: err.message || 'Podcast generation failed' };
      });

      const [review, podcastResult] = await Promise.all([reviewPromise, podcastPromise]);

      if (analysisCancelledRef.current) return;
      
      let podcastAudio = null;
      let podcastError = null;
      
      if (podcastResult && 'error' in podcastResult) {
        podcastError = podcastResult.error;
      } else if (podcastResult && 'audio' in podcastResult) {
        podcastAudio = podcastResult.audio;
      }

      if (!podcastAudio || podcastError) {
        setLoading(false);
        setStatus('');
        throw new Error(`Podcast generation failed: ${podcastError || 'No audio generated'}. Please try again.`);
      }

      const reviewId = Math.random().toString(36).substring(2, 11);
      const reviewForStorage = { 
        ...review, 
        id: reviewId,
        userId: currentUser.id,
        hasPodcast: !!podcastAudio,
        podcastAudio: podcastAudio,
      };
      
      setStatus("Saving to studio...");
      const freshAuthHeaders = await getAuthHeadersLocal();

      if (analysisCancelledRef.current) return;
      
      const saveRes = await fetch(`${API_URL}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...freshAuthHeaders },
        body: JSON.stringify({ userId: currentUser.id, review: reviewForStorage })
      });

      if (!saveRes.ok) {
        const errorData = await saveRes.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to save review');
      }

      const updatedUser = await saveRes.json();
      setCurrentUser(updatedUser);
      saveSessionLocal(updatedUser);
      
      setCreditStatus((prev: any) => ({
        ...prev,
        credits: updatedUser.credits,
        plan: updatedUser.isSubscribed ? 'pro' : 'free'
      }));
      
      setStatus("Finalizing...");
      const refreshedReview = await fetchReviewWithAudio(reviewForStorage.id);
      
      if (!refreshedReview) {
        throw new Error("Failed to verify review save. Please check your studio.");
      }

      navigateToReview(refreshedReview, false);
      setLoading(false);
      setStatus("");
      showNotification("Analysis complete! Review saved to your studio.", "success");
    } catch (e: any) {
      console.error("Analysis failed", e);
      setLoading(false);
      setStatus("");
      showNotification(e.message || "Failed to analyze track. Please try again.", "error");
    }
  }, [currentUser, API_URL, getAuthHeadersLocal, checkCreditsForAction, compressImage, navigateToReview, fetchReviewWithAudio, setCurrentUser, saveSessionLocal, setCreditStatus, setLoading, setStatus, setCurrentAudioFile, showNotification, navigate]);

  const handlePublish = useCallback(async (reviewId: string) => {
    if (!currentUser) return;

    try {
      let review = currentUser.history?.find((r: any) => r.id === reviewId);
      
      if (!review && currentReview?.id === reviewId) {
        review = currentReview;
      }

      if (!review) {
        const headers = await getAuthHeadersLocal();
        const reviewRes = await fetch(`${API_URL}/api/public/reviews/${reviewId}`, { headers });
        if (reviewRes.ok) {
          review = await reviewRes.json();
        }
      }

      if (!review) {
        showNotification('Could not find this review. Please try refreshing the page.', 'error');
        return;
      }

      const updatedReview = { ...review, isPublished: true };
      const headers = await getAuthHeadersLocal();
      const res = await fetch(`${API_URL}/api/reviews/${reviewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ userId: currentUser.id, review: updatedReview })
      });

      if (res.ok) {
        const savedUser = await res.json();
        setCurrentUser(savedUser);
        saveSessionLocal(savedUser);
        
        if (currentReview?.id === reviewId) {
          setCurrentReview({ ...currentReview, isPublished: true });
        }
        
        showNotification('Review published successfully!', 'success');
        
        try {
          const reviewsRes = await fetch(`${API_URL}/api/public/published-reviews?limit=100`, { cache: 'no-store' });
          if (reviewsRes.ok) {
            const data = await reviewsRes.json();
            setAllReviews(data.reviews || []);
          }
        } catch (e) {
          console.error("Failed to refresh published reviews", e);
        }
      } else {
        const error = await res.json();
        showNotification(error.detail || 'Failed to publish review', 'error');
      }
    } catch (error: any) {
      console.error('handlePublish error:', error);
      showNotification(error.message || 'An unexpected error occurred.', 'error');
    }
  }, [currentUser, currentReview, API_URL, getAuthHeadersLocal, setCurrentUser, saveSessionLocal, setCurrentReview, setAllReviews, showNotification]);

  const handleUpdateReview = useCallback(async (updatedReview: any) => {
    if (!currentUser) return false;

    const previousReview = currentReview;
    const previousHistory = currentUser.history;

    try {
      if (currentReview?.id === updatedReview.id) {
        setCurrentReview(updatedReview);
      }
      
      const newHistory = currentUser.history?.map((r: any) => r.id === updatedReview.id ? updatedReview : r);
      setCurrentUser((prev: any) => ({ ...prev, history: newHistory }));

      const headers = await getAuthHeadersLocal();
      const res = await fetch(`${API_URL}/api/reviews/${updatedReview.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ userId: currentUser.id, review: updatedReview })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { status: res.status, data: errorData, message: errorData.detail || 'Failed to save changes' };
      }

      const savedUser = await res.json();
      setCurrentUser(savedUser);
      saveSessionLocal(savedUser);
      
      try {
        const reviewsRes = await fetch(`${API_URL}/api/public/published-reviews?limit=100`, { cache: 'no-store' });
        if (reviewsRes.ok) {
          const data = await reviewsRes.json();
          setAllReviews(data.reviews || []);
        }
      } catch (e) {
        console.error("Failed to refresh published reviews", e);
      }

      if (isAdmin(currentUser)) {
        fetchAdminUsers(0, 20);
        fetchAdminReviews(0, 20);
      }
      
      return true;
    } catch (error: any) {
      setCurrentReview(previousReview);
      setCurrentUser((prev: any) => ({ ...prev, history: previousHistory }));
      
      console.error('handleUpdateReview error:', error);
      
      if (error.status === 402) {
        setCreditModalConfig({
          action: updatedReview.isPublished ? 'publish' : 'edit',
          required: error.data?.required || 3,
          reason: 'insufficient_credits',
          message: error.data?.message,
          isFreeUser: !currentUser?.isSubscribed
        });
        setShowCreditModal(true);
      } else {
        showNotification(error.message || 'An unexpected error occurred while saving changes. Please try again.', 'error');
      }
      return false;
    }
  }, [currentUser, currentReview, API_URL, getAuthHeadersLocal, setCurrentUser, saveSessionLocal, setCurrentReview, setAllReviews, fetchAdminUsers, fetchAdminReviews, setCreditModalConfig, setShowCreditModal, showNotification]);

  const handleDeleteUser = useCallback(async (userId: string) => {
    if (userId === currentUser?.id) {
      showNotification("Cannot terminate active session.", "warning");
      return;
    }
    const headers = await getAuthHeadersLocal();
    const res = await fetch(`${API_URL}/api/users/${userId}`, { 
      method: 'DELETE',
      headers 
    });
    if (res.ok) {
      setUsers((prev: any[]) => prev.filter(u => u.id !== userId));
      setAdminUsers((prev: any) => ({
        ...prev,
        users: prev.users?.filter((u: any) => u.id !== userId) || [],
        totalCount: Math.max(0, (prev.totalCount || 0) - 1)
      }));
      setAllReviews((prev: any[]) => prev.filter(r => r.userId !== userId));
      setAdminReviews((prev: any) => ({
        ...prev,
        reviews: prev.reviews?.filter((r: any) => r.userId !== userId) || []
      }));
      showNotification("User deleted successfully.", "success");
    } else {
      showNotification("Failed to delete user.", "error");
    }
  }, [currentUser, API_URL, getAuthHeadersLocal, setUsers, setAdminUsers, setAllReviews, setAdminReviews, showNotification]);

  const handleAdminUpdateReview = useCallback(async (review: any, userId: string) => {
    const headers = await getAuthHeadersLocal();
    const res = await fetch(`${API_URL}/api/reviews/${review.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ userId, review })
    });

    if (res.ok) {
      try {
        const reviewsRes = await fetch(`${API_URL}/api/public/published-reviews?limit=100`, { cache: 'no-store' });
        if (reviewsRes.ok) {
          const data = await reviewsRes.json();
          setAllReviews(data.reviews || []);
        }
      } catch (e) {
        console.error("Failed to refresh published reviews", e);
      }

      fetchAdminUsers(0, 20);
      fetchAdminReviews(0, 20);
    } else {
      const error = await res.json().catch(() => ({ detail: 'Failed to update review' }));
      throw new Error(error.detail || 'Failed to update review');
    }
  }, [API_URL, getAuthHeadersLocal, setAllReviews, fetchAdminUsers, fetchAdminReviews]);

  const handleDeleteReview = useCallback(async (reviewId: string) => {
    const headers = await getAuthHeadersLocal();
    const res = await fetch(`${API_URL}/api/reviews/${reviewId}`, {
      method: 'DELETE',
      headers
    });

    if (res.ok) {
      setAllReviews((prev: any[]) => prev.filter(r => r.id !== reviewId));
      if (currentUser?.history?.find((r: any) => r.id === reviewId)) {
        const updatedUser = {
          ...currentUser,
          history: currentUser.history.filter((r: any) => r.id !== reviewId)
        };
        setCurrentUser(updatedUser);
        saveSessionLocal(updatedUser);
      }
      fetchAdminUsers(0, 20);
      fetchAdminReviews(0, 20);
    } else {
      const error = await res.json().catch(() => ({ detail: 'Failed to delete review' }));
      showNotification(error.detail || 'Failed to delete review', 'error');
      throw new Error(error.detail || 'Failed to delete review');
    }
  }, [currentUser, API_URL, getAuthHeadersLocal, setAllReviews, setCurrentUser, saveSessionLocal, fetchAdminUsers, fetchAdminReviews, showNotification]);

  const handleAddStyleGuide = useCallback(async (guide: any) => {
    const headers = await getAuthHeadersLocal();
    const res = await fetch(`${API_URL}/api/style-guides`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(guide)
    });
    if (res.ok) {
      await fetchStyleGuides();
    } else {
      throw new Error('Failed to add style guide');
    }
  }, [API_URL, getAuthHeadersLocal, fetchStyleGuides]);

  const handleUpdateStyleGuide = useCallback(async (id: string, guide: any) => {
    const headers = await getAuthHeadersLocal();
    const res = await fetch(`${API_URL}/api/style-guides/${id}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(guide)
    });
    if (res.ok) {
      await fetchStyleGuides();
    } else {
      throw new Error('Failed to update style guide');
    }
  }, [API_URL, getAuthHeadersLocal, fetchStyleGuides]);

  const handleDeleteStyleGuide = useCallback(async (id: string) => {
    const headers = await getAuthHeadersLocal();
    const res = await fetch(`${API_URL}/api/style-guides/${id}`, {
      method: 'DELETE',
      headers
    });
    if (res.ok) {
      await fetchStyleGuides();
    } else {
      throw new Error('Failed to delete style guide');
    }
  }, [API_URL, getAuthHeadersLocal, fetchStyleGuides]);

  return {
    fetchAdminUsers,
    fetchAdminReviews,
    fetchCreditStatus,
    checkCreditsForAction,
    fetchStyleGuides,
    handleUpdateProfile,
    handleAnalyze,
    handlePublish,
    handleUpdateReview,
    handleDeleteUser,
    handleAdminUpdateReview,
    handleDeleteReview,
    handleAddStyleGuide,
    handleUpdateStyleGuide,
    handleDeleteStyleGuide
  };
}
