import React, { useState, useEffect, useRef } from 'react';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import MainContent from './components/MainContent';
import SupportWidget from './components/SupportWidget';
import SEO from './components/SEO';
import InsufficientCreditsModal from './components/InsufficientCreditsModal';
import ErrorBoundary from './components/ErrorBoundary';
import Notification, { NotificationType } from './components/Notification';
import { NotificationProvider, useNotification } from './components/NotificationContext';
import { getSession, getAuthHeaders, saveSession, clearSession, getCurrentUser, auth, safeJson, isAdmin } from './authClient';
import { onAuthStateChanged } from 'firebase/auth';
import { analyzeTrack, generatePodcast } from './services/geminiService';
import { UserAccount } from '../types';
import { PayPalScriptProvider } from "@paypal/react-paypal-js";

let API_URL = (import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL !== 'undefined') 
  ? import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') 
  : '';
if (API_URL.includes('localhost')) {
  API_URL = '';
}

// Utility to compress base64 images
const compressImage = (base64Str, maxWidth = 800, maxHeight = 400) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(base64Str);
  });
};

const saveSessionLocal = (user) => {
  saveSession(user);
};

// Helper to get auth headers from localStorage
const getAuthHeadersLocal = async () => {
  return await getAuthHeaders();
};

function AppContent() {
  const { showNotification } = useNotification();
  // Map views to URL paths
  const viewToPath = {
    'landing': '/',
    'dashboard': '/studio',
    'magazine': '/magazine',
    'podcasts': '/podcasts',
    'pricing': '/pricing',
    'account': '/account',
    'admin': '/admin',
    'auth': '/login',
    'signup': '/signup',
    'review': '/review',
    'guide': '/guide',
    'faq': '/faq',
    'terms': '/terms',
    'privacy': '/privacy',
    'contact': '/contact',
    'referrals': '/referrals'
  };
  
  const pathToView = Object.fromEntries(
    Object.entries(viewToPath).map(([view, path]) => [path, view])
  );
  
  const [view, setView] = useState('landing');
  const [isInitializing, setIsInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Analyzing...");
  const [currentReview, setCurrentReview] = useState(null);
  const [currentAudioFile, setCurrentAudioFile] = useState(null);
  
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [allReviews, setAllReviews] = useState([]);

  const [styleGuides, setStyleGuides] = useState([]);
  const [targetPodcastId, setTargetPodcastId] = useState(null);
  const [accountTab, setAccountTab] = useState('profile');
  const [paypalClientId, setPaypalClientId] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportView, setSupportView] = useState<'list' | 'form' | 'chat'>('list');

  const handleContactSupport = () => {
    if (!currentUser) {
      navigate('auth');
      return;
    }
    navigate('dashboard');
    setSupportOpen(true);
    setSupportView('form');
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const analysisCancelledRef = useRef(false);

  const handleCancelAnalysis = () => {
    analysisCancelledRef.current = true;
    setLoading(false);
    setStatus("");
    showNotification("Analysis cancelled. No credits were deducted.", "success");
  };
  
  // Credit system state
  const [creditStatus, setCreditStatus] = useState(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditModalConfig, setCreditModalConfig] = useState<{
    action: string | null;
    required: number;
    reason?: string;
    message?: string;
    isFreeUser?: boolean;
  }>({ action: null, required: 0 });

  const navigate = (v, reviewId = null) => {
    // Close mobile menu if open
    setMobileMenuOpen(false);
    
    if ((v === 'dashboard' || v === 'account') && !currentUser) {
      setView('auth');
      updateUrlForView('auth');
      window.scrollTo(0, 0);
      return;
    }
    if (v === 'signup' && currentUser) {
      setView('dashboard');
      updateUrlForView('dashboard');
      window.scrollTo(0, 0);
      return;
    }
    if (v === 'admin' && !isAdmin(currentUser)) {
      setView('landing');
      updateUrlForView('landing');
      window.scrollTo(0, 0);
      return;
    }
    
    if (v === 'account' && reviewId) {
      setAccountTab(reviewId);
    } else if (v === 'account') {
      setAccountTab('profile');
    }
    
    setView(v);
    updateUrlForView(v, reviewId);
    
    if (v !== 'review') {
      setCurrentReview(null);
    }
    if (v !== 'podcasts') {
      setTargetPodcastId(null);
    }
    
    // Use a small timeout to ensure DOM has updated before scrolling
    setTimeout(() => window.scrollTo(0, 0), 0);
  };

  // Function to navigate to a review and update URL
  const navigateToReview = (review, viewOnly = false) => {
    if (!review) {
      console.error('navigateToReview: Review is null');
      navigate('magazine');
      return;
    }
    
    console.log('Navigating to review:', review.id, 'viewOnly:', viewOnly);
    setCurrentReview({ ...review, viewOnly });
    
    // Extract audio file if present
    if (review.podcastAudioUrl) {
      setCurrentAudioFile({
        url: review.podcastAudioUrl,
        name: `${review.songTitle} - Review Podcast`
      });
    } else {
      setCurrentAudioFile(null);
    }
    
    navigate('review', review.id);
  };

  // Load a review from URL ID
  const loadReviewFromUrl = async (reviewId) => {
    try {
      console.log('Loading review from URL:', reviewId);
      const res = await fetch(`${API_URL}/api/public/reviews/${reviewId}`);
      if (res.ok) {
        const review = await res.json();
        console.log('Successfully loaded review from URL');
        navigateToReview(review, true);
      } else {
        console.error('Failed to load review from URL:', res.status);
        navigate('magazine');
      }
    } catch (e) {
      console.error('Failed to load review from URL:', e);
      navigate('magazine');
    }
  }

  // Get initial view from URL
  function getViewFromPath() {
    const path = window.location.pathname;
    // Check for review with ID: /review/{id}
    if (path.startsWith('/review/')) {
      return 'review';
    }
    return pathToView[path] || 'landing';
  }

  // Initial load effect
  useEffect(() => {
    // Capture referral code from URL
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      console.log('[Referral] Captured referral code:', ref);
      sessionStorage.setItem('referralCode', ref);
    }

    const initialView = getViewFromPath();
    setView(initialView);
    
    const path = window.location.pathname;
    if (path.startsWith('/review/')) {
      const reviewId = path.split('/review/')[1];
      if (reviewId) {
        loadReviewFromUrl(reviewId);
      }
    }
  }, []);
  
  // Sync URL with view changes
  useEffect(() => {
    const handlePopState = async () => {
      const path = window.location.pathname;
      
      // Check for review with ID: /review/{id}
      if (path.startsWith('/review/')) {
        const reviewId = path.split('/review/')[1];
        if (reviewId) {
          try {
            const reviewRes = await fetch(`${API_URL}/api/public/reviews/${reviewId}`);
            if (reviewRes.ok) {
              const reviewData = await reviewRes.json();
              setCurrentReview({ ...reviewData, viewOnly: true });
              setView('review');
              updateUrlForView('review', reviewId);
            } else {
              setView('magazine');
              updateUrlForView('magazine');
            }
          } catch (e) {
            setView('magazine');
            updateUrlForView('magazine');
          }
        } else {
          setView('magazine');
          updateUrlForView('magazine');
        }
      } else if (path.startsWith('/podcasts/')) {
        const podcastId = path.split('/podcasts/')[1];
        if (podcastId) {
          setTargetPodcastId(podcastId);
          setView('podcasts');
          updateUrlForView('podcasts', podcastId);
        } else {
          setView('podcasts');
          updateUrlForView('podcasts');
        }
      } else {
        const newView = pathToView[path] || 'landing';
        setView(newView);
        updateUrlForView(newView);
        if (newView !== 'review') {
          setCurrentReview(null);
        }
      }
      window.scrollTo(0, 0);
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [pathToView]);
  
  // Update URL when view changes (without triggering navigation)
  const updateUrlForView = (newView, reviewId = null) => {
    // Ensure we only pass cloneable data to pushState
    const safeReviewId = typeof reviewId === 'string' ? reviewId : null;
    let newPath = viewToPath[newView] || '/';
    
    // Special case for review with ID
    if (newView === 'review' && safeReviewId) {
      newPath = `/review/${safeReviewId}`;
    } else if (newView === 'podcasts' && safeReviewId) {
      newPath = `/podcasts/${safeReviewId}`;
    }
    
    // Only update if path actually changed
    if (window.location.pathname !== newPath) {
      try {
        window.history.pushState({ view: String(newView) }, '', newPath);
      } catch (e) {
        console.error('pushState failed:', e);
      }
    }
  };

  // Fetch a review with its audio data
  const fetchReviewWithAudio = async (reviewId) => {
    try {
      console.log('=== Fetching review with audio ===');
      console.log('Review ID:', reviewId);
      const headers = await getAuthHeadersLocal();
      const res = await fetch(`${API_URL}/api/reviews/${reviewId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        console.log('Fetched review data:', {
          id: data.id,
          hasPodcast: data.hasPodcast,
          podcastAudioUrl: data.podcastAudioUrl,
          podcastAudioPath: data.podcastAudioPath
        });
        return data;
      } else {
        console.error('Failed to fetch review:', res.status);
      }
    } catch (e) {
      console.error('Failed to fetch review with audio:', e);
    }
    return null;
  };

  // Fetch credit status
  const fetchCreditStatus = async () => {
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
  };

  // Check if user can perform action (returns true if allowed, false if not)
  const checkCreditsForAction = async (action) => {
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
          // Show modal
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
  };

  // Deduct credits for an action
  const deductCredits = async (action) => {
    try {
      const headers = await getAuthHeadersLocal();
      const res = await fetch(`${API_URL}/api/credits/deduct`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      
      if (res.ok) {
        const data = await res.json();
        // Refresh credit status
        await fetchCreditStatus();
        return data;
      }
    } catch (e) {
      console.error('Credit deduction error:', e);
    }
    return null;
  };

  // Initial data fetch and auth listener
  useEffect(() => {
    // Listen for auth state changes to handle email verification
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // If user is logged in, we might need to refresh their verification status
        // But we'll let the init function handle the initial load
      }
    });

    const init = async () => {
      try {
        // Fetch config
        try {
          const configRes = await fetch(`${API_URL}/api/config`);
          if (configRes.ok) {
            const config = await configRes.json();
            if (config.paypalClientId) {
              setPaypalClientId(config.paypalClientId);
            }
          }
        } catch (e) {
          console.error("Failed to fetch config", e);
        }

        // Handle URL routing for shareable review links
        const path = window.location.pathname;
        const reviewMatch = path.match(/^\/review\/([a-zA-Z0-9-]+)$/);
        
        if (reviewMatch) {
          const reviewId = reviewMatch[1];
          // Fetch the public review
          try {
            const reviewRes = await fetch(`${API_URL}/api/public/reviews/${reviewId}`);
            if (reviewRes.ok) {
              const reviewData = await reviewRes.json();
              setCurrentReview({ ...reviewData, viewOnly: true });
              navigate('review', reviewId);
            } else {
              // Review not found, redirect to magazine
              navigate('magazine');
              window.history.replaceState({}, '', '/');
            }
          } catch (e) {
            console.error('Failed to load shared review:', e);
            navigate('magazine');
            window.history.replaceState({}, '', '/');
          }
        } else {
          // Handle URL parameters for deep linking
          const params = new URLSearchParams(window.location.search);
          const urlView = params.get('view');
          if (urlView && ['landing', 'magazine', 'podcasts', 'dashboard', 'pricing', 'guide', 'account'].includes(urlView)) {
            navigate(urlView);
          }
        }

        // Check for existing session in localStorage
        const savedUser = await getCurrentUser() as UserAccount | null;
        if (savedUser) {
          setCurrentUser(savedUser);
          saveSessionLocal(savedUser);
          // Fetch credit status after login
          fetchCreditStatus();
        }
        setIsInitializing(false);

        // Load published reviews for magazine/podcasts
        try {
          const reviewsRes = await fetch(`${API_URL}/api/public/published-reviews`);
          if (reviewsRes.ok) {
            const publishedReviews = await reviewsRes.json();
            setAllReviews(publishedReviews);
          }
        } catch (e) {
          console.error("Failed to load published reviews", e);
        }

        // Load all users for admin (with auth if available)
        try {
          const authHeaders = await getAuthHeadersLocal();
          if (authHeaders.Authorization && isAdmin(savedUser)) {
            const usersRes = await fetch(`${API_URL}/api/users`, { headers: authHeaders });
            if (usersRes.ok) {
              const usersList = await usersRes.json();
              setUsers(usersList);
            }
            // Fetch style guides for admin
            fetchStyleGuides();
          }
        } catch (e) {
          console.error("Failed to load users", e);
        }
      } catch (e) {
        console.error("Failed to initialize app data", e);
      }
    };
    
    init();
    return () => unsubscribe();
  }, []);

  const refreshUserData = async () => {
    if (!currentUser?.id) return;
    const headers = await getAuthHeadersLocal();
    try {
      const userRes = await fetch(`${API_URL}/api/users/${currentUser.id}`, { headers });
      if (userRes.ok) {
        const freshUser = await userRes.json();
        setCurrentUser(freshUser);
        saveSessionLocal(freshUser);
      }
      
      fetchCreditStatus();
      
      const usersRes = await fetch(`${API_URL}/api/users`, { headers });
      if (usersRes.ok) {
        const usersList = await safeJson(usersRes);
        setUsers(usersList);
        setAllReviews(usersList.flatMap(u => u.history || []));
      }
    } catch (e) {
      console.error('Failed to refresh user data:', e);
    }
  };

  const handleLogin = async (user) => {
    setCurrentUser(user);
    saveSessionLocal(user);
    
    // Fetch users with auth header if admin
    try {
      const headers = user.session?.access_token 
        ? { 'Authorization': `Bearer ${user.session.access_token}` }
        : {};
      const res = await fetch(`${API_URL}/api/users`, { headers });
      if (res.ok) {
        const list = await safeJson(res);
        setUsers(list);
        setAllReviews(list.flatMap(u => u.history || []));
      } else {
        const errorData = await safeJson(res).catch(() => ({}));
        console.error('Failed to load users:', res.status, errorData);
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    }
    
    // Only navigate to landing if we're still on the auth view
    // This prevents overwriting navigation that happened during the async fetch
    if (view === 'auth') {
      navigate('landing');
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      clearSession();
    } catch (e) {
      console.error('Logout error:', e);
    }
    setCurrentUser(null);
    setCreditStatus(null);
    navigate('landing');
    setCurrentAudioFile(null);
  };

  const fetchStyleGuides = async () => {
    try {
      const headers = await getAuthHeadersLocal();
      const res = await fetch(`${API_URL}/api/style-guides`, { headers });
      if (res.ok) {
        const data = await res.json();
        setStyleGuides(data);
      }
    } catch (e) {
      console.error('Failed to fetch style guides:', e);
    }
  };

  const handleAddStyleGuide = async (guide) => {
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
  };

  const handleUpdateStyleGuide = async (id, guide) => {
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
  };

  const handleDeleteStyleGuide = async (id) => {
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
  };

  const handleAnalyze = async (data) => {
    if (!currentUser) {
      navigate('auth');
      return;
    }

    // Check credits before proceeding
    const canProceed = await checkCreditsForAction('review');
    if (!canProceed) {
      return; // Modal will be shown automatically
    }

    setLoading(true);
    setStatus("Extracting Technical Features...");
    analysisCancelledRef.current = false;
    
    try {
      setCurrentAudioFile(data.audioFile);
      
      // Convert audio to base64
      const audioBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(data.audioFile);
      });

      if (analysisCancelledRef.current) return;

      // Convert image if provided
      let imageBase64 = null;
      let imageMimeType = null;
      if (data.featuredPhoto) {
        const imgData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(data.featuredPhoto);
        });
        const rawBase64 = (imgData as string);
        // Compress cover art
        imageBase64 = (await compressImage(rawBase64, 1200, 1200) as string).split(',')[1];
        imageMimeType = 'image/jpeg';
      }

      if (analysisCancelledRef.current) return;

      // Convert artist photo if provided
      let artistPhotoBase64 = null;
      let artistPhotoMimeType = null;
      if (data.artistPhoto) {
        const artistImgData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(data.artistPhoto);
        });
        const rawArtistBase64 = (artistImgData as string);
        // Compress artist photo
        artistPhotoBase64 = (await compressImage(rawArtistBase64, 1000, 1000) as string).split(',')[1];
        artistPhotoMimeType = 'image/jpeg';
      }

      if (analysisCancelledRef.current) return;

      setStatus("Writing editorial draft & synthesizing voices...");
      
      // Get auth headers for API calls
      const authHeaders = await getAuthHeadersLocal();
      
      // Call the analyze service and podcast generation directly on frontend in parallel
      const reviewPromise = analyzeTrack({
        trackName: data.trackName,
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
        data.trackName, 
        data.artistName, 
        audioBase64 as string
      ).catch(err => {
        console.error("Podcast generation failed", err);
        let pErr = '';
        if (err instanceof Error) {
          pErr = err.message;
        } else if (typeof err === 'object' && err !== null) {
          if ('error' in err && typeof (err as any).error === 'object' && (err as any).error !== null && 'message' in (err as any).error) {
            pErr = String((err as any).error.message);
          } else if ('message' in err) {
            pErr = String((err as any).message);
          } else {
            pErr = JSON.stringify(err);
          }
        } else {
          pErr = String(err);
        }
        return { error: pErr || 'Podcast generation failed' };
      });

      const [review, podcastResult] = await Promise.all([reviewPromise, podcastPromise]);

      if (analysisCancelledRef.current) return;
      
      let podcastAudio = null;
      let podcastError = null;
      
      if (podcastResult && 'error' in podcastResult) {
        podcastError = podcastResult.error;
      } else if (podcastResult && 'audio' in podcastResult) {
        podcastAudio = podcastResult.audio;
        if (!podcastAudio) {
          podcastError = 'Podcast audio was empty';
        }
      }

      // If podcast generation failed, show error and ask user to retry
      if (!podcastAudio || podcastError) {
        setLoading(false);
        setStatus('');
        throw new Error(`Podcast generation failed: ${podcastError || 'No audio generated'}. Please try again.`);
      }

      // Create review for storage WITH podcast audio, but WITHOUT original song audio
      const reviewForStorage = { 
        ...review, 
        userId: currentUser.id,
        hasPodcast: !!podcastAudio,
        podcastAudio: podcastAudio,  // Include the actual audio data
      };
      
      // Save to backend
      setStatus("Saving to studio...");
      // Get FRESH auth headers right before the final save call
      // to prevent "token expired" errors after long AI generation
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
      
      // Update credit status immediately from the response
      setCreditStatus(prev => ({
        ...prev,
        credits: updatedUser.credits,
        plan: updatedUser.isSubscribed ? 'pro' : 'free'
      }));
      
      // After successful save, fetch the review to get the storage URLs
      setStatus("Finalizing...");
      const refreshedReview = await fetchReviewWithAudio(reviewForStorage.id);
      
      // Keep full review with audio in local state for playback
      // Note: songAudio is intentionally omitted here as per user request to delete it
      const fullReview = { 
        ...reviewForStorage, 
        ...(refreshedReview || {}),
        podcastAudio, 
        podcastAudioUrl: refreshedReview?.podcastAudioUrl || refreshedReview?.podcastAudio,
      };
      setCurrentReview(fullReview);

      // Update current user state from the save response (which now includes history)
      const fullUser = { ...updatedUser, session: currentUser.session };
      setCurrentUser(fullUser);
      saveSessionLocal(fullUser);
      
      // Sync credit status
      setCreditStatus(prev => ({
        ...prev,
        credits: updatedUser.credits,
        plan: updatedUser.isSubscribed ? 'pro' : 'free'
      }));

      // Refresh users list ONLY if admin
      if (isAdmin(currentUser)) {
        const authHeaders = await getAuthHeadersLocal();
        const usersRes = await fetch(`${API_URL}/api/users`, { headers: authHeaders });
        if (usersRes.ok) {
          const usersList = await usersRes.json();
          setUsers(usersList);
          setAllReviews(usersList.flatMap(u => u.history || []));
        }
      }

      navigate('review', reviewForStorage.id);
    } catch (error) {
      console.error(error);
      let errorMessage = '';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        if ('error' in error && typeof (error as any).error === 'object' && (error as any).error !== null && 'message' in (error as any).error) {
          errorMessage = String((error as any).error.message);
        } else if ('message' in error) {
          errorMessage = String((error as any).message);
        } else {
          errorMessage = JSON.stringify(error);
        }
      } else {
        errorMessage = String(error);
      }

      if (errorMessage.includes('413')) {
        showNotification("The file or data is too large for the studio to process. Try using a smaller audio file or lower resolution images.", "error");
      } else if (errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        showNotification("We've hit our daily processing limit. Please try again tomorrow.", "warning");
      } else {
        showNotification(`Studio Error: ${errorMessage || 'Verify your file and try again.'}`, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (reviewId) => {
    if (!currentUser) return;

    try {
      // Check credits before publishing
      const canProceed = await checkCreditsForAction('publish');
      if (!canProceed) {
        return; // Modal will be shown automatically
      }

      let review = currentUser.history?.find(r => r.id === reviewId);
      
      if (!review && currentReview?.id === reviewId) {
        review = currentReview;
      }

      if (!review) {
        console.log('Review not found in local history, fetching directly...');
        const headers = await getAuthHeadersLocal();
        const reviewRes = await fetch(`${API_URL}/api/public/reviews/${reviewId}`, { headers });
        if (reviewRes.ok) {
          review = await reviewRes.json();
        }
      }

      if (!review) {
        console.error('Review not found:', reviewId);
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
        const data = await res.json();
        // Update credits from the response
        if (data.remaining !== undefined) {
          setCreditStatus(prev => ({
            ...prev,
            credits: data.remaining,
          }));
        }
        
        // Fetch updated user data
        const userRes = await fetch(`${API_URL}/api/users/${currentUser.id}`, { headers });
        if (userRes.ok) {
          const updatedUser = await userRes.json();
          setCurrentUser(updatedUser);
          saveSessionLocal(updatedUser);
        }
        
        if (currentReview?.id === reviewId) {
          setCurrentReview(updatedReview);
        }

        // Refresh public reviews
        try {
          const reviewsRes = await fetch(`${API_URL}/api/public/published-reviews`);
          if (reviewsRes.ok) {
            const publishedReviews = await reviewsRes.json();
            setAllReviews(publishedReviews);
          }
        } catch (e) {
          console.error("Failed to refresh published reviews", e);
        }
        
        navigate('magazine');
      } else {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 402) {
          setShowCreditModal(true);
        } else {
          showNotification(`Failed to publish: ${errorData.message || 'Server error'}`, 'error');
        }
      }
    } catch (error) {
      console.error('handlePublish error:', error);
      showNotification('An unexpected error occurred while publishing. Please try again.', 'error');
    }
  };

  const handleUpdateReview = async (updatedReview) => {
    if (!currentUser) return;

    try {
      const headers = await getAuthHeadersLocal();
      const res = await fetch(`${API_URL}/api/reviews/${updatedReview.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ userId: updatedReview.userId || currentUser?.id, review: updatedReview })
      });

      if (res.ok) {
        const data = await res.json();
        // Update credits from the response
        if (data.remaining !== undefined) {
          setCreditStatus(prev => ({
            ...prev,
            credits: data.remaining,
          }));
        }

        // Fetch updated user data (the PUT returns the review, not user)
        if (currentUser?.id) {
          const userRes = await fetch(`${API_URL}/api/users/${currentUser.id}`, { headers });
          if (userRes.ok) {
            const freshUser = await userRes.json();
            setCurrentUser(freshUser);
            saveSessionLocal(freshUser);
          }
        }
        setCurrentReview(updatedReview);

        if (isAdmin(currentUser)) {
          const usersRes = await fetch(`${API_URL}/api/users`, { headers });
          if (usersRes.ok) {
            const usersList = await usersRes.json();
            setUsers(usersList);
            setAllReviews(usersList.flatMap(u => u.history || []));
          }
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 402) {
          setCreditModalConfig({
            action: 'edit',
            required: errorData.required || 3,
            reason: 'insufficient_credits',
            message: errorData.message || 'Editing a review requires 3 credits.',
            isFreeUser: !currentUser?.isSubscribed
          });
          setShowCreditModal(true);
        } else {
          showNotification(`Failed to save changes: ${errorData.message || 'Server error'}`, 'error');
        }
      }
    } catch (error) {
      console.error('handleUpdateReview error:', error);
      showNotification('An unexpected error occurred while saving changes. Please try again.', 'error');
    }
  };

  const handleUpdateProfile = async (updatedUser) => {
    const headers = await getAuthHeadersLocal();
    
    try {
      const res = await fetch(`${API_URL}/api/users/${updatedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(updatedUser)
      });

      if (res.status === 428) {
        showNotification('Re-authentication required for this action. Please try again.', 'warning');
        throw new Error('Re-authentication required');
      }

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to update user');
      }

      const savedUser = await res.json();
      
      // Update current user if this is themselves
      if (currentUser?.id === savedUser.id) {
        setCurrentUser(savedUser);
        saveSessionLocal(savedUser);
      }
      
      // Update user in local state immediately (optimistic update)
      setUsers(prev => prev.map(u => u.id === savedUser.id ? { ...u, ...savedUser } : u));
      
      return savedUser;
    } catch (error) {
      console.error('handleUpdateProfile error:', error);
      throw error;
    }
  };

  const handleDeleteUser = async (userId) => {
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
      setUsers(prev => prev.filter(u => u.id !== userId));
      setAllReviews(prev => prev.filter(r => r.userId !== userId));
    }
  };

  const handleAdminUpdateReview = async (review, userId) => {
    const headers = await getAuthHeadersLocal();
    const res = await fetch(`${API_URL}/api/reviews/${review.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ userId, review })
    });

    if (res.ok) {
      // Refresh public reviews
      try {
        const reviewsRes = await fetch(`${API_URL}/api/public/published-reviews`);
        if (reviewsRes.ok) {
          const publishedReviews = await reviewsRes.json();
          setAllReviews(publishedReviews);
        }
      } catch (e) {
        console.error("Failed to refresh published reviews", e);
      }

      // Fetch users with auth headers
      try {
        const usersRes = await fetch(`${API_URL}/api/users`, { headers });
        if (usersRes.ok) {
          const usersList = await usersRes.json();
          setUsers(usersList);
        }
      } catch (fetchError) {
        console.error('Error refreshing users after review update:', fetchError);
      }
    } else {
      const error = await res.json().catch(() => ({ detail: 'Failed to update review' }));
      throw new Error(error.detail || 'Failed to update review');
    }
  };

  const handleDeleteReview = async (reviewId) => {
    const headers = await getAuthHeadersLocal();
    const res = await fetch(`${API_URL}/api/reviews/${reviewId}`, {
      method: 'DELETE',
      headers
    });

    if (res.ok) {
      setAllReviews(prev => prev.filter(r => r.id !== reviewId));
      // Also update current user history if it's their review
      if (currentUser?.history?.find(r => r.id === reviewId)) {
        setCurrentUser(prev => ({
          ...prev,
          history: prev.history.filter(r => r.id !== reviewId)
        }));
      }
      // Refresh users list for admin
      if (isAdmin(currentUser)) {
        const usersRes = await fetch(`${API_URL}/api/users`, { headers });
        if (usersRes.ok) {
          const usersList = await usersRes.json();
          setUsers(usersList);
        }
      }
    } else {
      const error = await res.json().catch(() => ({ detail: 'Failed to delete review' }));
      throw new Error(error.detail || 'Failed to delete review');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950 font-sans overflow-x-hidden">
      <SEO view={view} currentReview={currentReview} allReviews={allReviews} />
      <Navigation 
        view={view}
        currentUser={currentUser}
        creditStatus={creditStatus}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        navigate={navigate}
        handleLogout={handleLogout}
      />

      {isInitializing ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Initializing Studio</p>
          </div>
        </div>
      ) : (
        <PayPalScriptProvider 
          key={paypalClientId}
          options={{ 
            clientId: paypalClientId,
            currency: "USD",
            intent: "capture"
          }}>
          <div className="flex-grow">
            <MainContent 
              view={view}
              loading={loading}
              status={status}
              currentUser={currentUser}
              currentReview={currentReview}
              currentAudioFile={currentAudioFile}
              allReviews={allReviews}
              users={users}
              styleGuides={styleGuides}
              creditStatus={creditStatus}
              targetPodcastId={targetPodcastId}
              setUsers={setUsers}
              setAllReviews={setAllReviews}
              setTargetPodcastId={setTargetPodcastId}
              paypalClientId={paypalClientId}
              handleAnalyze={handleAnalyze}
              handleLogin={handleLogin}
              handleUpdateReview={handleUpdateReview}
              handlePublish={handlePublish}
              handleUpdateProfile={handleUpdateProfile}
              handleDeleteUser={handleDeleteUser}
              handleAdminUpdateReview={handleAdminUpdateReview}
              handleDeleteReview={handleDeleteReview}
              handleAddStyleGuide={handleAddStyleGuide}
              handleUpdateStyleGuide={handleUpdateStyleGuide}
              handleDeleteStyleGuide={handleDeleteStyleGuide}
              handleLogout={handleLogout}
              handleCancelAnalysis={handleCancelAnalysis}
              refreshUserData={refreshUserData}
              accountTab={accountTab}
              fetchReviewWithAudio={fetchReviewWithAudio}
              navigateToReview={navigateToReview}
              navigate={navigate}
              onContactSupport={handleContactSupport}
            />
          </div>
        </PayPalScriptProvider>
      )}

      <Footer navigate={navigate} />

      {/* Support Widget */}
      {currentUser && (view === 'dashboard' || view === 'podcasts' || view === 'magazine' || view === 'account' || view === 'guide' || view === 'pricing' || supportOpen) && (
        <SupportWidget 
          currentUser={currentUser} 
          isOpen={supportOpen}
          setIsOpen={setSupportOpen}
          view={supportView}
          setView={setSupportView}
        />
      )}

      {/* Insufficient Credits Modal */}
      <InsufficientCreditsModal
        isOpen={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        onBuyCredits={() => { setShowCreditModal(false); navigate('pricing'); }}
        onUpgrade={() => { setShowCreditModal(false); navigate('pricing'); }}
        currentCredits={creditStatus?.credits || 0}
        requiredCredits={creditModalConfig.required}
        action={creditModalConfig.action}
        isFreeUser={creditModalConfig.isFreeUser}
      />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </ErrorBoundary>
  );
}

export default App;
