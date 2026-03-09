import React, { useState, useEffect } from 'react';
import SearchSection from './components/SearchSection';
import ReviewDisplay from './components/ReviewDisplay';
import Dashboard from './components/Dashboard';
import Pricing from './components/Pricing';
import Magazine from './components/Magazine';
import Auth from './components/Auth';
import ProfileDropdown from './components/ProfileDropdown';
import AccountSettings from './components/AccountSettings';
import AdminDashboard from './components/AdminDashboard';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsAndConditions from './components/TermsAndConditions';
import FAQ from './components/FAQ';
import ContactUs from './components/ContactUs';
import SubmissionGuide from './components/SubmissionGuide';
import Podcasts from './components/Podcasts';
import CreditCounter from './components/CreditCounter';
import InsufficientCreditsModal from './components/InsufficientCreditsModal';
import { getSession, getAuthHeaders, saveSession, clearSession, getCurrentUser } from './authClient';
import { analyzeTrack, generatePodcast } from './services/geminiService';
import { UserAccount } from '../types';

const API_URL = import.meta.env.VITE_BACKEND_URL || '';

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
const getAuthHeadersLocal = () => {
  return getAuthHeaders();
};

// AdminDashboard wrapper that fetches users on mount
const AdminDashboardWrapper = ({ currentUser, users, setUsers, setAllReviews, onUpdateUser, onDeleteUser, onUpdateReview, styleGuides, onAddStyleGuide, onUpdateStyleGuide, onDeleteStyleGuide }) => {
  const [localUsers, setLocalUsers] = React.useState(users || []);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const hasFetched = React.useRef(false);

  // Store setters in refs to avoid dependency issues
  const setUsersRef = React.useRef(setUsers);
  const setAllReviewsRef = React.useRef(setAllReviews);
  
  React.useEffect(() => {
    setUsersRef.current = setUsers;
    setAllReviewsRef.current = setAllReviews;
  });

  // Update local users when the prop changes
  React.useEffect(() => {
    if (users && users.length > 0) {
      setLocalUsers(users);
      // If we have users with full data (email field), don't need to refetch
      if (users[0]?.email) {
        hasFetched.current = true;
      }
    }
  }, [users]);

  // Fetch fresh data with auth headers on mount (only if needed)
  React.useEffect(() => {
    // Skip if we already have full user data
    if (hasFetched.current) return;
    
    // Check if current users have full data (admin view includes email)
    const hasFullData = localUsers.length > 0 && localUsers[0]?.email;
    if (hasFullData) {
      hasFetched.current = true;
      return;
    }
    
    hasFetched.current = true;

    let isMounted = true;
    setLoading(true);

    const fetchUsers = async () => {
      try {
        const headers = getAuthHeadersLocal();
        const res = await fetch(`${API_URL}/api/users`, { headers });
        
        if (!isMounted) return;
        
        if (res.ok) {
          const list = await res.json();
          if (isMounted) {
            setLocalUsers(list);
            setUsersRef.current(list);
            setAllReviewsRef.current(list.flatMap(u => u.history || []));
          }
        } else {
          if (isMounted) {
            setError('Failed to load users');
          }
        }
      } catch (e) {
        console.error('AdminDashboardWrapper: Fetch error:', e);
        if (isMounted) {
          setError('Failed to fetch users');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  // Show loading only if we have no data at all
  if (loading && localUsers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-emerald-500 mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-slate-400">Loading users...</p>
        </div>
      </div>
    );
  }

  if (error && localUsers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl font-bold hover:bg-emerald-400 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminDashboard 
      users={localUsers} 
      onUpdateUser={onUpdateUser} 
      onDeleteUser={onDeleteUser}
      onUpdateReview={onUpdateReview}
      styleGuides={styleGuides}
      onAddStyleGuide={onAddStyleGuide}
      onUpdateStyleGuide={onUpdateStyleGuide}
      onDeleteStyleGuide={onDeleteStyleGuide}
    />
  );
};

function App() {
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
    'review': '/review',
    'guide': '/guide',
    'faq': '/faq',
    'terms': '/terms',
    'privacy': '/privacy',
    'contact': '/contact'
  };
  
  const pathToView = Object.fromEntries(
    Object.entries(viewToPath).map(([view, path]) => [path, view])
  );
  
  // Function to load a review from URL
  async function loadReviewFromUrl(reviewId) {
    try {
      const res = await fetch(`${API_URL}/api/public/reviews/${reviewId}`);
      if (res.ok) {
        const review = await res.json();
        setCurrentReview(review);
        navigate('review');
      }
    } catch (e) {
      console.error('Failed to load review from URL:', e);
    }
  }

  // Get initial view from URL
  function getViewFromPath() {
    const path = window.location.pathname;
    // Check for review with ID: /review/{id}
    if (path.startsWith('/review/')) {
      const reviewId = path.split('/review/')[1];
      if (reviewId) {
        loadReviewFromUrl(reviewId);
      }
      return 'review';
    }
    return pathToView[path] || 'landing';
  }

  const [view, setView] = useState(getViewFromPath());
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Credit system state
  const [creditStatus, setCreditStatus] = useState(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditModalConfig, setCreditModalConfig] = useState({ action: null, required: 0 });
  
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
            } else {
              setView('magazine');
            }
          } catch (e) {
            setView('magazine');
          }
        } else {
          setView('magazine');
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
  }, [pathToView]);
  
  // Update URL when view changes (without triggering navigation)
  const updateUrlForView = (newView, reviewId = null) => {
    let newPath = viewToPath[newView] || '/';
    
    // Special case for review with ID
    if (newView === 'review' && reviewId) {
      newPath = `/review/${reviewId}`;
    }
    
    // Only update if path actually changed
    if (window.location.pathname !== newPath) {
      window.history.pushState({ view: newView }, '', newPath);
    }
  };

  // Fetch a review with its audio data
  const fetchReviewWithAudio = async (reviewId) => {
    try {
      console.log('=== Fetching review with audio ===');
      console.log('Review ID:', reviewId);
      const headers = getAuthHeadersLocal();
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
      const headers = getAuthHeadersLocal();
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
      const headers = getAuthHeadersLocal();
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
      const headers = getAuthHeadersLocal();
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

  // Initial data fetch and Supabase auth listener
  useEffect(() => {
    const init = async () => {
      try {
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
          const authHeaders = getAuthHeadersLocal();
          if (authHeaders.Authorization && (savedUser?.role === 'admin' || savedUser?.email === 'verdiqmag@gmail.com')) {
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
  }, []);

  const refreshUserData = async () => {
    if (!currentUser?.id) return;
    const headers = getAuthHeadersLocal();
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
        const usersList = await usersRes.json();
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
      const list = await res.json();
      setUsers(list);
      setAllReviews(list.flatMap(u => u.history || []));
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
      const headers = getAuthHeadersLocal();
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
    const headers = getAuthHeadersLocal();
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
    const headers = getAuthHeadersLocal();
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
    const headers = getAuthHeadersLocal();
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
    
    try {
      setCurrentAudioFile(data.audioFile);
      
      // Convert audio to base64
      const audioBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(data.audioFile);
      });

      // Convert image if provided
      let imageBase64 = null;
      let imageMimeType = null;
      if (data.featuredPhoto) {
        const imgData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(data.featuredPhoto);
        });
        imageBase64 = (imgData as string).split(',')[1];
        imageMimeType = data.featuredPhoto.type;
      }

      setStatus("Writing editorial draft...");
      
      // Get auth headers for API calls
      const authHeaders = getAuthHeadersLocal();
      
      // Call the analyze service directly on frontend
      const review = await analyzeTrack({
        trackName: data.trackName,
        artistName: data.artistName,
        audioBase64: audioBase64,
        audioMimeType: data.audioFile.type,
        lyrics: data.lyrics || '',
        bio: data.bio || '',
        imageBase64: imageBase64,
        imageMimeType: imageMimeType,
        preset: data.stylePreset || 'dark'
      });
      
      // Generate podcast audio directly on frontend
      let podcastAudio = null;
      let podcastError = null;
      try {
        setStatus("Synthesizing session voices...");
        const podcastData = await generatePodcast(review);
        podcastAudio = podcastData.audio;
        if (!podcastAudio) {
          podcastError = 'Podcast audio was empty';
        }
      } catch (err) {
        console.error("Podcast generation failed", err);
        podcastError = err.message || 'Podcast generation failed';
      }

      // If podcast generation failed, show error and ask user to retry
      if (!podcastAudio || podcastError) {
        setLoading(false);
        setStatus('');
        throw new Error(`Podcast generation failed: ${podcastError || 'No audio generated'}. Please try again.`);
      }

      // Store song audio locally
      const songAudio = audioBase64;

      // Create review for storage WITH podcast audio
      const reviewForStorage = { 
        ...review, 
        userId: currentUser.id,
        hasPodcast: !!podcastAudio,
        podcastAudio: podcastAudio,  // Include the actual audio data
        songAudio: songAudio,        // Include the actual song data
        hasSongAudio: true
      };
      
      // Save to backend
      setStatus("Saving to studio...");
      const saveRes = await fetch(`${API_URL}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ userId: currentUser.id, review: reviewForStorage })
      });

      if (!saveRes.ok) {
        const errorData = await saveRes.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to save review');
      }

      const updatedUser = await saveRes.json();
      setCurrentUser(updatedUser);
      saveSessionLocal(updatedUser);
      
      // Keep full review with audio in local state for playback
      const fullReview = { ...reviewForStorage, podcastAudio, songAudio };
      setCurrentReview(fullReview);

      // Store audio files to Supabase Storage
      if (podcastAudio || songAudio) {
        setStatus("Uploading audio files...");
        try {
          const audioStoreRes = await fetch(`${API_URL}/api/reviews/${reviewForStorage.id}/audio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ songAudio, podcastAudio })
          });
          if (!audioStoreRes.ok) {
            console.warn('Audio storage returned non-OK status:', audioStoreRes.status);
          } else {
            // After successful upload, re-fetch review to get signed URLs
            const refreshedReview = await fetchReviewWithAudio(reviewForStorage.id);
            if (refreshedReview) {
              // Keep the local base64 audio for immediate playback, but add the URLs
              setCurrentReview({
                ...fullReview,
                podcastAudioUrl: refreshedReview.podcastAudioUrl,
                songAudioUrl: refreshedReview.songAudioUrl
              });
              console.log('Review updated with signed URLs:', {
                podcastAudioUrl: refreshedReview.podcastAudioUrl,
                songAudioUrl: refreshedReview.songAudioUrl
              });
            }
          }
        } catch (audioError) {
          console.error('Audio storage failed:', audioError);
        }
      }

      // Deduct credits after successful analysis
      await deductCredits('review');
      
      // Refresh credit status
      await fetchCreditStatus();

      // Refresh users list and current user
      const usersRes = await fetch(`${API_URL}/api/users`, { headers: authHeaders });
      if (usersRes.ok) {
        const usersList = await usersRes.json();
        setUsers(usersList);
        setAllReviews(usersList.flatMap(u => u.history || []));
        
        // Update current user state to include the new review in history
        if (currentUser) {
          const updatedSelf = usersList.find(u => u.id === currentUser.id);
          if (updatedSelf) {
            const fullUser = { ...updatedSelf, session: currentUser.session };
            setCurrentUser(fullUser);
            saveSessionLocal(fullUser);
          }
        }
      }

      navigate('review');
    } catch (error) {
      console.error(error);
      alert(`Studio Error: ${error.message || 'Verify your file and try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (reviewId) => {
    if (!currentUser) return;

    try {
      // Check credits before publishing
      const canProceed = await checkCreditsForAction('magazine');
      if (!canProceed) {
        return; // Modal will be shown automatically
      }

      let review = currentUser.history.find(r => r.id === reviewId);
      if (!review) {
        console.log('Review not found in local history, refreshing user data...');
        const headers = getAuthHeadersLocal();
        const userRes = await fetch(`${API_URL}/api/users/${currentUser.id}`, { headers });
        if (userRes.ok) {
          const freshUser = await userRes.json();
          const fullUser = { ...freshUser, session: currentUser.session };
          setCurrentUser(fullUser);
          saveSessionLocal(fullUser);
          review = freshUser.history.find(r => r.id === reviewId);
        }
      }

      if (!review) {
        console.error('Review not found in history:', reviewId);
        alert('Could not find this review in your history. Please try refreshing the page.');
        return;
      }

      const updatedReview = { ...review, isPublished: true };
      
      const headers = getAuthHeadersLocal();
      const res = await fetch(`${API_URL}/api/reviews/${reviewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ userId: currentUser.id, review: updatedReview })
      });

      if (res.ok) {
        // Deduct credits for magazine submission
        await deductCredits('magazine');
        await fetchCreditStatus();
        
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
        alert(`Failed to publish: ${errorData.message || 'Server error'}`);
      }
    } catch (error) {
      console.error('handlePublish error:', error);
      alert('An unexpected error occurred while publishing. Please try again.');
    }
  };

  const handleUpdateReview = async (updatedReview) => {
    const headers = getAuthHeadersLocal();
    const res = await fetch(`${API_URL}/api/reviews/${updatedReview.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ userId: updatedReview.userId || currentUser?.id, review: updatedReview })
    });

    if (res.ok) {
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

      if (currentUser?.role === 'admin' || currentUser?.email === 'verdiqmag@gmail.com') {
        const usersRes = await fetch(`${API_URL}/api/users`, { headers });
        if (usersRes.ok) {
          const usersList = await usersRes.json();
          setUsers(usersList);
          setAllReviews(usersList.flatMap(u => u.history || []));
        }
      }
    }
  };

  const handleUpdateProfile = async (updatedUser) => {
    const headers = getAuthHeadersLocal();
    
    try {
      const res = await fetch(`${API_URL}/api/users/${updatedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(updatedUser)
      });

      if (res.status === 428) {
        alert('Re-authentication required for this action. Please try again.');
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
      alert("Cannot terminate active session.");
      return;
    }
    if (window.confirm("Permanently terminate this artist account? All studio history will be lost.")) {
      const headers = getAuthHeadersLocal();
      const res = await fetch(`${API_URL}/api/users/${userId}`, { 
        method: 'DELETE',
        headers 
      });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== userId));
        setAllReviews(prev => prev.filter(r => r.userId !== userId));
      }
    }
  };

  const handleAdminUpdateReview = async (review, userId) => {
    const headers = getAuthHeadersLocal();
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

  const navigate = (v, reviewId = null) => {
    // Close mobile menu if open
    setMobileMenuOpen(false);
    
    if ((v === 'dashboard' || v === 'account') && !currentUser) {
      setView('auth');
      updateUrlForView('auth');
      window.scrollTo(0, 0);
      return;
    }
    if (v === 'admin' && currentUser?.role !== 'admin' && currentUser?.email !== 'verdiqmag@gmail.com') {
      setView('landing');
      updateUrlForView('landing');
      window.scrollTo(0, 0);
      return;
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
    setCurrentReview({ ...review, viewOnly });
    navigate('review', review.isPublished ? review.id : null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950 font-sans">
      <nav className="fixed top-0 w-full z-50 glass border-b border-slate-800/50" data-testid="main-nav">
        <div className="max-w-[1440px] mx-auto px-8 h-24 flex items-center justify-between">
          <div onClick={() => navigate('landing')} className="text-2xl font-black cursor-pointer tracking-tighter flex items-center gap-3 group border-none bg-transparent" data-testid="logo">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl group-hover:rotate-12 transition-transform flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <div className="w-5 h-5 bg-slate-950 rounded-sm" />
            </div>
            <span className="gradient-text">Verdiq</span>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-12">
            <button onClick={() => navigate('landing')} className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'landing' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'} border-none bg-transparent`} data-testid="nav-submit">Submit</button>
            <button onClick={() => navigate('magazine')} className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'magazine' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'} border-none bg-transparent`} data-testid="nav-magazine">Magazine</button>
            <button onClick={() => navigate('podcasts')} className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'podcasts' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'} border-none bg-transparent`} data-testid="nav-podcasts">Podcasts</button>
            <button onClick={() => navigate('dashboard')} className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'dashboard' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'} border-none bg-transparent`} data-testid="nav-dashboard">Studio History</button>
          </div>

          <div className="flex items-center gap-4">
            {/* Mobile Hamburger Menu Button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors border-none bg-transparent"
              data-testid="mobile-menu-btn"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            {currentUser ? (
              <div className="flex items-center gap-4">
                <CreditCounter
                  credits={creditStatus?.credits || currentUser?.credits || 0}
                  monthlyCredits={creditStatus?.monthlyCredits || 0}
                  plan={creditStatus?.plan || 'free'}
                  isSubscribed={false}
                  onBuyCredits={() => navigate('pricing')}
                  onManageSubscription={() => navigate('pricing')}
                />
                <div className="w-px h-8 bg-slate-800 mx-2" />
                <ProfileDropdown 
                  user={currentUser} 
                  onLogout={handleLogout} 
                  onNavigate={navigate} 
                />
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <button onClick={() => navigate('auth')} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white transition-colors border-none bg-transparent" data-testid="login-btn">Login</button>
                <button onClick={() => navigate('pricing')} className="btn-primary !px-6 !py-2.5 !text-xs" data-testid="go-pro-btn">Go Pro</button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900/95 backdrop-blur-xl border-t border-slate-800" data-testid="mobile-menu">
            <div className="px-6 py-4 flex flex-col gap-2">
              <button 
                onClick={() => { navigate('landing'); setMobileMenuOpen(false); }} 
                className={`text-left py-3 px-4 rounded-lg text-sm font-bold transition-colors ${view === 'landing' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'} border-none bg-transparent`}
                data-testid="mobile-nav-submit"
              >
                Submit Track
              </button>
              <button 
                onClick={() => { navigate('magazine'); setMobileMenuOpen(false); }} 
                className={`text-left py-3 px-4 rounded-lg text-sm font-bold transition-colors ${view === 'magazine' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'} border-none bg-transparent`}
                data-testid="mobile-nav-magazine"
              >
                Magazine
              </button>
              <button 
                onClick={() => { navigate('podcasts'); setMobileMenuOpen(false); }} 
                className={`text-left py-3 px-4 rounded-lg text-sm font-bold transition-colors ${view === 'podcasts' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'} border-none bg-transparent`}
                data-testid="mobile-nav-podcasts"
              >
                Podcasts
              </button>
              <button 
                onClick={() => { navigate('dashboard'); setMobileMenuOpen(false); }} 
                className={`text-left py-3 px-4 rounded-lg text-sm font-bold transition-colors ${view === 'dashboard' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'} border-none bg-transparent`}
                data-testid="mobile-nav-dashboard"
              >
                Studio History
              </button>
            </div>
          </div>
        )}
      </nav>

      <main className="pt-20 pb-16">
        {isInitializing ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Initializing Studio</p>
            </div>
          </div>
        ) : (
          <>
            {view === 'landing' && (
          <SearchSection 
            onAnalyze={handleAnalyze} 
            isLoading={loading} 
            credits={currentUser?.credits || 0} 
            status={status} 
            isSubscribed={currentUser?.isSubscribed || false} 
          />
        )}
        {view === 'auth' && <Auth onLogin={handleLogin} onClose={() => navigate('landing')} />}
        {view === 'review' && currentReview && (
          <ReviewDisplay 
            review={currentReview} 
            onUpgrade={() => navigate('pricing')} 
            onSave={handleUpdateReview} 
            onPublish={handlePublish}
            onBack={() => navigate('magazine')}
            onViewPodcast={(id) => {
              setTargetPodcastId(id);
              navigate('podcasts');
            }}
            onSelectReview={() => {}}
            canPublish={creditStatus?.features?.publish_magazine || false}
            audioFile={currentAudioFile}
            isSubscribed={creditStatus?.isSubscribed || currentUser?.isSubscribed || false}
            features={creditStatus?.features || {}}
          />
        )}
        {view === 'dashboard' && currentUser && (
          <Dashboard 
            reviews={currentUser.history || []} 
            onSelect={async (r) => { 
              console.log('Dashboard: Selecting review:', r.id);
              const fullReview = await fetchReviewWithAudio(r.id);
              if (fullReview) {
                console.log('Dashboard: Got full review with URLs');
                navigateToReview(fullReview, false);
              } else {
                console.warn('Dashboard: Failed to get full review, using cached data');
                navigateToReview(r, false);
              }
            }} 
          />
        )}
        {view === 'magazine' && (
          <Magazine 
            reviews={allReviews} 
            onSelect={async (r) => { 
              const fullReview = await fetchReviewWithAudio(r.id);
              navigateToReview(fullReview || r, true);
            }} 
          />
        )}
        {view === 'podcasts' && (
          <Podcasts 
            reviews={allReviews} 
            onSelectReview={async (r) => { 
              const fullReview = await fetchReviewWithAudio(r.id);
              navigateToReview(fullReview || r, false);
            }} 
            initialPodcastId={targetPodcastId}
            fetchReviewWithAudio={fetchReviewWithAudio}
          />
        )}
        {view === 'pricing' && (
          <Pricing 
            currentUser={currentUser}
            onUpgrade={(data) => { 
              if (!currentUser) { navigate('auth'); return; }
              // Update user state with subscription data
              const updated = { 
                ...currentUser, 
                isSubscribed: true, 
                credits: data?.credits || 12,
                invoices: [
                  { 
                    id: 'INV-'+Date.now(), 
                    date: new Date().toLocaleDateString(), 
                    amount: data?.plan === 'label' ? '$49.00' : '$12.00', 
                    status: 'Paid', 
                    plan: data?.plan === 'label' ? 'Label' : 'Artist Pro' 
                  }, 
                  ...(currentUser.invoices || [])
                ] 
              };
              handleUpdateProfile(updated);
              navigate('landing'); 
            }} 
          />
        )}
        {view === 'account' && currentUser && (
          <AccountSettings 
            user={currentUser} 
            session={currentUser?.session}
            onUpdate={handleUpdateProfile} 
          />
        )}
        {view === 'admin' && (currentUser?.role === 'admin' || currentUser?.email === 'verdiqmag@gmail.com') && (
          <AdminDashboardWrapper 
            currentUser={currentUser}
            users={users}
            setUsers={setUsers}
            setAllReviews={setAllReviews}
            onUpdateUser={handleUpdateProfile} 
            onDeleteUser={handleDeleteUser}
            onUpdateReview={handleAdminUpdateReview}
            styleGuides={styleGuides}
            onAddStyleGuide={handleAddStyleGuide}
            onUpdateStyleGuide={handleUpdateStyleGuide}
            onDeleteStyleGuide={handleDeleteStyleGuide}
          />
        )}
        {view === 'privacy' && <PrivacyPolicy />}
        {view === 'terms' && <TermsAndConditions />}
        {view === 'faq' && <FAQ />}
        {view === 'contact' && <ContactUs />}
        {view === 'guide' && <SubmissionGuide onNavigate={navigate} />}
          </>
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-12 px-6 mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-8">
            <div className="flex items-center gap-4 text-slate-500">
              <span className="text-xl font-bold text-slate-200">Verdiq</span>
              <span className="text-xs uppercase tracking-widest">© 2024 Future of Sound and Critic</span>
            </div>
            <div className="flex flex-wrap justify-center gap-8">
               <button onClick={() => navigate('guide')} className="text-xs font-bold uppercase text-slate-500 hover:text-emerald-500 transition-colors border-none bg-transparent">Submission Guide</button>
               <button onClick={() => navigate('podcasts')} className="text-xs font-bold uppercase text-slate-500 hover:text-emerald-500 transition-colors border-none bg-transparent">Podcasts</button>
               <button onClick={() => navigate('pricing')} className="text-xs font-bold uppercase text-slate-500 hover:text-emerald-500 transition-colors border-none bg-transparent">Pricing</button>
               <button onClick={() => navigate('faq')} className="text-xs font-bold uppercase text-slate-500 hover:text-emerald-500 transition-colors border-none bg-transparent">FAQ</button>
               <button onClick={() => navigate('contact')} className="text-xs font-bold uppercase text-slate-500 hover:text-emerald-500 transition-colors border-none bg-transparent">Contact Us</button>
            </div>
          </div>
          <div className="flex justify-center gap-8 pt-8 border-t border-slate-900/50">
            <button onClick={() => navigate('privacy')} className="text-[10px] font-bold uppercase text-slate-600 hover:text-slate-400 transition-colors border-none bg-transparent">Privacy Policy</button>
            <button onClick={() => navigate('terms')} className="text-[10px] font-bold uppercase text-slate-600 hover:text-slate-400 transition-colors border-none bg-transparent">Terms & Conditions</button>
          </div>
        </div>
      </footer>

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

export default App;
