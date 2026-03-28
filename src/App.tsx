import React, { useState, useEffect, useRef, Suspense, lazy, useCallback } from 'react';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import MainContent from './components/MainContent';
import SEO from './components/SEO';
import { SessionHeartbeat } from './components/SessionHeartbeat';
import { smartFetch } from './lib/apiUtils';
import { getSession, getAuthHeaders, saveSession, logout, getCurrentUser, auth, safeJson, isAdmin } from './authClient';
import { onAuthStateChanged } from 'firebase/auth';
import { analyzeTrack, generatePodcast } from './services/geminiService';
import { UserAccount } from '../types';

import { NotificationProvider, useNotification } from './components/NotificationContext';

// Lazy load non-critical components
const SupportWidget = lazy(() => import('./components/SupportWidget'));
const InsufficientCreditsModal = lazy(() => import('./components/InsufficientCreditsModal'));
const ErrorBoundary = lazy(() => import('./components/ErrorBoundary'));

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

const fetchWithTimeout = async (url: string, options: any = {}, timeout = 5000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
};

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

// Helper to normalize paths for routing
const normalizePath = (path: string) => {
  if (path === '/') return '/';
  return path.endsWith('/') ? path.slice(0, -1) : path;
};

// Get initial view from URL
const getViewFromPath = () => {
  let path = normalizePath(window.location.pathname);
  
  // Check for review with ID: /review/{id}
  if (path.startsWith('/review/')) {
    return 'review';
  }
  
  // Check for podcast with ID: /podcasts/{id}
  if (path.startsWith('/podcasts/')) {
    return 'podcasts';
  }
  
  return pathToView[path] || 'landing';
};

function AppContent() {
  const { showNotification } = useNotification();
  
  const [view, setView] = useState('landing');
  const [isInitializing, setIsInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Analyzing...");
  const [currentReview, setCurrentReview] = useState(null);
  const [currentAudioFile, setCurrentAudioFile] = useState(null);
  
  const [users, setUsers] = useState([]);
  const [adminUsers, setAdminUsers] = useState({ users: [], totalCount: 0, limit: 20, offset: 0 });
  const [adminReviews, setAdminReviews] = useState({ reviews: [], totalCount: 0, limit: 20, offset: 0 });
  const [currentUser, setCurrentUser] = useState(null);
  const [allReviews, setAllReviews] = useState([]);
  const [styleGuides, setStyleGuides] = useState([]);
  const [lastFetchTime, setLastFetchTime] = useState({ users: 0, reviews: 0 });

  const fetchAdminUsers = async (offset = 0, limit = 20, search = "") => {
    if (!isAdmin(currentUser)) return;
    try {
      const headers = await getAuthHeadersLocal();
      const res = await fetch(`${API_URL}/api/users?offset=${offset}&limit=${limit}&search=${encodeURIComponent(search)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAdminUsers(data);
        setUsers(data.users); // Keep users for backward compatibility
      }
    } catch (e) {
      console.error("Failed to fetch admin users", e);
    }
  };

  const fetchAdminReviews = async (offset = 0, limit = 20) => {
    if (!isAdmin(currentUser)) return;
    try {
      const headers = await getAuthHeadersLocal();
      const res = await fetch(`${API_URL}/api/admin/reviews?offset=${offset}&limit=${limit}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAdminReviews(data);
        setAllReviews(data.reviews); // Keep allReviews for backward compatibility
      }
    } catch (e) {
      console.error("Failed to fetch admin reviews", e);
    }
  };

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

  // Update URL when view changes (without triggering navigation)
  const updateUrlForView = useCallback((newView: string, reviewId: string | null = null) => {
    // Ensure we only pass cloneable data to pushState
    const safeReviewId = typeof reviewId === 'string' ? reviewId : null;
    let newPath = viewToPath[newView as keyof typeof viewToPath] || '/';
    
    // Special case for review with ID
    if (newView === 'review' && safeReviewId) {
      newPath = `/review/${safeReviewId}`;
    } else if (newView === 'podcasts' && safeReviewId) {
      newPath = `/podcasts/${safeReviewId}`;
    }
    
    // Only update if path actually changed
    if (normalizePath(window.location.pathname) !== normalizePath(newPath)) {
      try {
        window.history.pushState({ view: String(newView), reviewId: safeReviewId }, '', newPath);
      } catch (e) {
        console.error('pushState failed:', e);
      }
    }
  }, []);

  const navigate = useCallback((v: string, reviewId: string | null = null, overrideUser: any = undefined) => {
    // Close mobile menu if open
    setMobileMenuOpen(false);
    
    const activeUser = overrideUser !== undefined ? overrideUser : currentUser;
    
    // Protected views that require authentication
    const protectedViews = ['dashboard', 'account', 'referrals'];
    
    if (protectedViews.includes(v) && !activeUser) {
      setView('auth');
      updateUrlForView('auth');
      window.scrollTo(0, 0);
      return;
    }
    if ((v === 'signup' || v === 'auth') && activeUser) {
      setView('dashboard');
      updateUrlForView('dashboard');
      window.scrollTo(0, 0);
      return;
    }
    if (v === 'admin' && !isAdmin(activeUser)) {
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
    
    if (v === 'podcasts' && reviewId) {
      setTargetPodcastId(reviewId);
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

    // Fetch data based on view
    if (v === 'admin' && isAdmin(currentUser)) {
      fetchAdminUsers(0, 20);
      fetchAdminReviews(0, 20);
    }
  }, [currentUser, updateUrlForView]);

  const handleCancelAnalysis = () => {
    analysisCancelledRef.current = true;
    setLoading(false);
    setStatus("");
    showNotification("Analysis cancelled. No credits were deducted.", "success");
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
      const res = await fetchWithTimeout(`${API_URL}/api/public/reviews/${reviewId}`);
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
    let path = window.location.pathname;
    
    // Remove trailing slash if present (except for root '/')
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    
    // Check for review with ID: /review/{id}
    if (path.startsWith('/review/')) {
      return 'review';
    }
    
    // Check for podcast with ID: /podcasts/{id}
    if (path.startsWith('/podcasts/')) {
      return 'podcasts';
    }
    return pathToView[path] || 'landing';
  }

  // Sync URL with view changes
  useEffect(() => {
    const handlePopState = async () => {
      const path = normalizePath(window.location.pathname);
      
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
              // Don't call updateUrlForView here as it might push a new entry
            } else {
              setView('magazine');
            }
          } catch (e) {
            setView('magazine');
          }
        } else {
          setView('magazine');
        }
      } else if (path.startsWith('/podcasts/')) {
        const podcastId = path.split('/podcasts/')[1];
        if (podcastId) {
          setTargetPodcastId(podcastId);
          setView('podcasts');
        } else {
          setView('podcasts');
        }
      } else {
        const newView = pathToView[path] || 'landing';
        setView(newView);
        if (newView !== 'review') {
          setCurrentReview(null);
        }
      }
      window.scrollTo(0, 0);
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  
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
        // Handle URL routing for shareable review links first to determine initial view
        const path = normalizePath(window.location.pathname);
        const reviewMatch = path.match(/^\/review\/([a-zA-Z0-9-]+)$/);
        const podcastMatch = path.match(/^\/podcasts\/([a-zA-Z0-9-]+)$/);
        
        // Start non-blocking parallel fetches
        const configPromise = fetchWithTimeout(`${API_URL}/api/config`).then(res => res.ok ? res.json() : null).catch(() => null);
        const userPromise = getCurrentUser().catch(() => null);
        const reviewsPromise = fetchWithTimeout(`${API_URL}/api/public/published-reviews?limit=100`, { cache: 'no-store' }).then(res => res.ok ? res.json() : null).catch(() => null);

        // Wait for essential data
        const [config, savedUser, reviewsData] = await Promise.all([configPromise, userPromise, reviewsPromise]);

        if (config && config.paypalClientId) {
          setPaypalClientId(config.paypalClientId);
        }

        if (savedUser) {
          setCurrentUser(savedUser);
          saveSessionLocal(savedUser);
          fetchCreditStatus();
          if (isAdmin(savedUser)) {
            fetchStyleGuides();
          }
        }

        if (reviewsData) {
          setAllReviews(reviewsData.reviews || []);
        }

        if (reviewMatch) {
          const reviewId = reviewMatch[1];
          // Fetch the public review
          try {
            const reviewRes = await fetchWithTimeout(`${API_URL}/api/public/reviews/${reviewId}`);
            if (reviewRes.ok) {
              const reviewData = await reviewRes.json();
              setCurrentReview({ ...reviewData, viewOnly: true });
              navigate('review', reviewId, savedUser);
            } else {
              navigate('magazine', null, savedUser);
              window.history.replaceState({}, '', '/magazine');
            }
          } catch (e) {
            console.error('Failed to load shared review:', e);
            navigate('magazine', null, savedUser);
            window.history.replaceState({}, '', '/magazine');
          }
        } else if (podcastMatch) {
          const podcastId = podcastMatch[1];
          navigate('podcasts', podcastId, savedUser);
        } else {
          const params = new URLSearchParams(window.location.search);
          const urlView = params.get('view');
          const initialView = getViewFromPath();
          
          const validViews = [
            'landing', 'magazine', 'podcasts', 'dashboard', 'pricing', 
            'guide', 'account', 'referrals', 'faq', 'terms', 
            'privacy', 'contact', 'admin', 'auth', 'signup'
          ];
          
          if (urlView && validViews.includes(urlView)) {
            navigate(urlView, null, savedUser);
          } else {
            // Handle initialView checks
            if (savedUser) {
              if (initialView === 'signup' || initialView === 'auth') {
                navigate('dashboard', null, savedUser);
              } else if (initialView === 'admin' && !isAdmin(savedUser)) {
                navigate('landing', null, savedUser);
              } else {
                navigate(initialView, null, savedUser);
              }
            } else {
              const protectedViews = ['dashboard', 'account', 'admin', 'referrals'];
              if (protectedViews.includes(initialView)) {
                navigate('auth', null, savedUser);
              } else {
                navigate(initialView, null, savedUser);
              }
            }
          }
        }

        setIsInitializing(false);
      } catch (e) {
        console.error("Failed to initialize app data", e);
        setIsInitializing(false);
      }
    };
    
    init();
    return () => unsubscribe();
  }, [navigate]);

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
      
      // If we are in admin view, also refresh admin data
      if (view === 'admin') {
        fetchAdminUsers(adminUsers.offset, adminUsers.limit);
        fetchAdminReviews(adminReviews.offset, adminReviews.limit);
      }
    } catch (e) {
      console.error('Failed to refresh user data:', e);
    }
  };

  const handleLogin = async (user) => {
    setCurrentUser(user);
    saveSessionLocal(user);
    
    // Only navigate to dashboard if we're still on the auth view
    if (view === 'auth' || view === 'signup') {
      navigate('dashboard', null, user);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error('Logout error:', e);
    }
    setCurrentUser(null);
    setCreditStatus(null);
    navigate('landing', null, null);
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

      // Refresh admin data ONLY if currently in admin view
      if (isAdmin(currentUser) && view === 'admin') {
        fetchAdminUsers(adminUsers.offset, adminUsers.limit);
        fetchAdminReviews(adminReviews.offset, adminReviews.limit);
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
      } else if (errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED') || (error as any).type === 'QUOTA' || errorMessage.includes('Podcast generation failed') || errorMessage.includes('Analysis failed')) {
        // Custom user-friendly message for AI limits or general generation failures
        showNotification(
          "We hit our analysis limit for today.\n\nTo keep reviews and podcast quality high, we cap how many generations we run each day. Please try again in a few hours.\n\nYour credits remain intact. Your account is safe.", 
          "warning"
        );
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
      
      const success = await handleUpdateReview(updatedReview);
      if (success) {
        navigate('magazine');
      }
    } catch (error) {
      console.error('handlePublish error:', error);
      showNotification('An unexpected error occurred while publishing. Please try again.', 'error');
    }
  };

  const handleUpdateReview = async (updatedReview) => {
    if (!currentUser) return;

    // Optimistic Update
    const previousReview = currentReview;
    const previousHistory = currentUser.history;
    
    setCurrentReview(updatedReview);
    if (currentUser?.history) {
      setCurrentUser(prev => ({
        ...prev,
        history: prev.history.map(r => r.id === updatedReview.id ? updatedReview : r)
      }));
    }

    try {
      const headers = await getAuthHeadersLocal();
      const data = await smartFetch(`${API_URL}/api/reviews/${updatedReview.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ userId: updatedReview.userId || currentUser?.id, review: updatedReview })
      });

      // Update credits from the response
      if (data.remaining !== undefined) {
        setCreditStatus(prev => ({
          ...prev,
          credits: data.remaining,
        }));
      }

      // Fetch updated user data (the PUT returns the review, not user)
      if (currentUser?.id) {
        const freshUser = await smartFetch(`${API_URL}/api/users/${currentUser.id}`, { headers });
        setCurrentUser(freshUser);
        saveSessionLocal(freshUser);
      }

      // Refresh public reviews
      try {
        const reviewsRes = await fetch(`${API_URL}/api/public/published-reviews?limit=100`, { cache: 'no-store' });
        if (reviewsRes.ok) {
          const data = await reviewsRes.json();
          setAllReviews(data.reviews || []);
        }
      } catch (e) {
        console.error("Failed to refresh published reviews", e);
      }

      if (isAdmin(currentUser) && view === 'admin') {
        fetchAdminUsers(adminUsers.offset, adminUsers.limit);
        fetchAdminReviews(adminReviews.offset, adminReviews.limit);
      }
      
      return true;
    } catch (error: any) {
      // Rollback on failure
      setCurrentReview(previousReview);
      setCurrentUser(prev => ({ ...prev, history: previousHistory }));
      
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
        const reviewsRes = await fetch(`${API_URL}/api/public/published-reviews?limit=100`, { cache: 'no-store' });
        if (reviewsRes.ok) {
          const data = await reviewsRes.json();
          setAllReviews(data.reviews || []);
        }
      } catch (e) {
        console.error("Failed to refresh published reviews", e);
      }

      // Refresh admin data if in admin view
      if (isAdmin(currentUser) && view === 'admin') {
        fetchAdminUsers(adminUsers.offset, adminUsers.limit);
        fetchAdminReviews(adminReviews.offset, adminReviews.limit);
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
        const updatedUser = {
          ...currentUser,
          history: currentUser.history.filter(r => r.id !== reviewId)
        };
        setCurrentUser(updatedUser);
        saveSessionLocal(updatedUser);
      }
      // Refresh admin data if in admin view
      if (isAdmin(currentUser) && view === 'admin') {
        fetchAdminUsers(adminUsers.offset, adminUsers.limit);
        fetchAdminReviews(adminReviews.offset, adminReviews.limit);
      }
    } else {
      const error = await res.json().catch(() => ({ detail: 'Failed to delete review' }));
      showNotification(error.detail || 'Failed to delete review', 'error');
      throw new Error(error.detail || 'Failed to delete review');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950 font-sans overflow-x-hidden">
      <SEO view={view} currentReview={currentReview} allReviews={allReviews} />
      <SessionHeartbeat onSessionExpired={handleLogout} />
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
            adminUsers={adminUsers}
            adminReviews={adminReviews}
            fetchAdminUsers={fetchAdminUsers}
            fetchAdminReviews={fetchAdminReviews}
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
      )}

      <Footer navigate={navigate} />

      {/* Support Widget */}
      <Suspense fallback={null}>
        {currentUser && (view === 'dashboard' || view === 'podcasts' || view === 'magazine' || view === 'account' || view === 'guide' || view === 'pricing' || supportOpen) && (
          <SupportWidget 
            currentUser={currentUser} 
            isOpen={supportOpen}
            setIsOpen={setSupportOpen}
            view={supportView}
            setView={setSupportView}
          />
        )}
      </Suspense>

      {/* Insufficient Credits Modal */}
      <Suspense fallback={null}>
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
      </Suspense>
    </div>
  );
}

function App() {
  // Register Service Worker for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.error('[PWA] Service Worker registration failed:', err);
        });
      });
    }
  }, []);

  return (
    <ErrorBoundary>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </ErrorBoundary>
  );
}

export default App;
