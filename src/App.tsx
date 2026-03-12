import React, { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import MainContent from './components/MainContent';
import SupportWidget from './components/SupportWidget';
import InsufficientCreditsModal from './components/InsufficientCreditsModal';
import { getSession, saveSession, clearSession, getCurrentUser } from './authClient';
import { analyzeTrack, generatePodcast } from './services/geminiService';
import { UserAccount } from '../types';
import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import { api } from './services/api';

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
  
  async function loadReviewFromUrl(reviewId) {
    try {
      const review = await api.getPublicReview(reviewId);
      if (review) {
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
  const [creditModalConfig, setCreditModalConfig] = useState<{
    action: string | null;
    required: number;
    reason?: string;
    message?: string;
    isFreeUser?: boolean;
  }>({ action: null, required: 0 });
  
  // Sync URL with view changes
  useEffect(() => {
    const handlePopState = async () => {
      const path = window.location.pathname;
      
      // Check for review with ID: /review/{id}
      if (path.startsWith('/review/')) {
        const reviewId = path.split('/review/')[1];
        if (reviewId) {
          try {
            const reviewData = await api.getPublicReview(reviewId);
            if (reviewData) {
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

  const fetchReviewWithAudio = async (reviewId) => {
    try {
      const data = await api.getReview(reviewId);
      return data;
    } catch (e) {
      console.error('Failed to fetch review with audio:', e);
    }
    return null;
  };

  const fetchCreditStatus = async () => {
    try {
      const data = await api.getCreditStatus();
      setCreditStatus(data);
      return data;
    } catch (e) {
      console.error('Failed to fetch credit status:', e);
    }
    return null;
  };

  const checkCreditsForAction = async (action) => {
    try {
      const data = await api.checkCredits(action);
      if (!data.canAfford) {
        setCreditModalConfig({
          action,
          required: data.cost || 0,
          reason: (data as any).reason,
          message: data.message,
          isFreeUser: (data as any).reason === 'review_limit' || (data as any).reason === 'feature_locked'
        });
        setShowCreditModal(true);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Credit check error:', e);
    }
    return false;
  };

  const deductCredits = async (action) => {
    try {
      const data = await api.deductCredits(action);
      await fetchCreditStatus();
      return data;
    } catch (e) {
      console.error('Credit deduction error:', e);
    }
    return null;
  };

  // Initial data fetch and auth listener
  useEffect(() => {
    // Supabase handles auth state changes automatically through session management
    // The init function will handle the initial load

    const init = async () => {
      try {
        const path = window.location.pathname;
        const reviewMatch = path.match(/^\/review\/([a-zA-Z0-9-]+)$/);

        if (reviewMatch) {
          const reviewId = reviewMatch[1];
          try {
            const reviewData = await api.getPublicReview(reviewId);
            if (reviewData) {
              setCurrentReview({ ...reviewData, viewOnly: true });
              navigate('review', reviewId);
            } else {
              navigate('magazine');
              window.history.replaceState({}, '', '/');
            }
          } catch (e) {
            console.error('Failed to load shared review:', e);
            navigate('magazine');
            window.history.replaceState({}, '', '/');
          }
        } else {
          const params = new URLSearchParams(window.location.search);
          const urlView = params.get('view');
          if (urlView && ['landing', 'magazine', 'podcasts', 'dashboard', 'pricing', 'guide', 'account'].includes(urlView)) {
            navigate(urlView);
          }
        }

        const savedUser = await getCurrentUser() as UserAccount | null;
        if (savedUser) {
          setCurrentUser(savedUser);
          saveSessionLocal(savedUser);
          fetchCreditStatus();
        }
        setIsInitializing(false);

        try {
          const publishedReviews = await api.getPublishedReviews();
          setAllReviews(publishedReviews);
        } catch (e) {
          console.error("Failed to load published reviews", e);
        }

        try {
          if (savedUser?.role === 'admin' || savedUser?.email === 'verdiqmag@gmail.com') {
            const usersList = await api.getAllUsers();
            setUsers(usersList);
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
    try {
      const freshUser = await api.getUser(currentUser.id);
      if (freshUser) {
        setCurrentUser(freshUser);
        saveSessionLocal(freshUser);
      }
      fetchCreditStatus();
      const usersList = await api.getAllUsers();
      setUsers(usersList);
      setAllReviews(usersList.flatMap(u => u.history || []));
    } catch (e) {
      console.error('Failed to refresh user data:', e);
    }
  };

  const handleLogin = async (user) => {
    setCurrentUser(user);
    saveSessionLocal(user);

    try {
      if (user.role === 'admin' || user.email === 'verdiqmag@gmail.com' || user.email === 'admin@verdiq.ai') {
        const list = await api.getAllUsers();
        setUsers(list);
        setAllReviews(list.flatMap(u => u.history || []));
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    }

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
      const data = await api.getStyleGuides();
      setStyleGuides(data);
    } catch (e) {
      console.error('Failed to fetch style guides:', e);
    }
  };

  const handleAddStyleGuide = async (guide) => {
    await api.createStyleGuide(guide);
    await fetchStyleGuides();
  };

  const handleUpdateStyleGuide = async (id, guide) => {
    await api.updateStyleGuide(id, guide);
    await fetchStyleGuides();
  };

  const handleDeleteStyleGuide = async (id) => {
    await api.deleteStyleGuide(id);
    await fetchStyleGuides();
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

      // Convert artist photo if provided
      let artistPhotoBase64 = null;
      let artistPhotoMimeType = null;
      if (data.artistPhoto) {
        const artistImgData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(data.artistPhoto);
        });
        artistPhotoBase64 = (artistImgData as string).split(',')[1];
        artistPhotoMimeType = data.artistPhoto.type;
      }

      setStatus("Writing editorial draft...");


      const review = await analyzeTrack({
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
      };
      
      setStatus("Saving to studio...");
      const updatedUser = await api.createReview(currentUser.id, reviewForStorage);
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
      const fullReview = { 
        ...reviewForStorage, 
        podcastAudio, 
        songAudio,
        podcastAudioUrl: refreshedReview?.podcastAudioUrl || refreshedReview?.podcastAudio,
        songAudioUrl: refreshedReview?.songAudioUrl || refreshedReview?.songAudio
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

      if (currentUser?.role === 'admin' || currentUser?.email === 'verdiqmag@gmail.com') {
        try {
          const usersList = await api.getAllUsers();
          setUsers(usersList);
          setAllReviews(usersList.flatMap(u => u.history || []));
        } catch (_) {}
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
      const canProceed = await checkCreditsForAction('publish');
      if (!canProceed) return;

      let review = currentUser.history?.find(r => r.id === reviewId);
      if (!review) {
        const freshUser = await api.getUser(currentUser.id);
        if (freshUser) {
          const fullUser = { ...freshUser, session: currentUser.session };
          setCurrentUser(fullUser);
          saveSessionLocal(fullUser);
          review = freshUser.history.find(r => r.id === reviewId);
        }
      }

      if (!review) {
        alert('Could not find this review in your history. Please try refreshing the page.');
        return;
      }

      const updatedReview = { ...review, isPublished: true };
      await api.updateReview(reviewId, currentUser.id, updatedReview);

      const deductRes = await deductCredits('publish');
      if (deductRes) {
        setCreditStatus(prev => ({ ...prev, credits: deductRes.remaining }));
      }

      const updatedUser = await api.getUser(currentUser.id);
      if (updatedUser) {
        setCurrentUser(updatedUser);
        saveSessionLocal(updatedUser);
      }

      if (currentReview?.id === reviewId) {
        setCurrentReview(updatedReview);
      }

      try {
        const publishedReviews = await api.getPublishedReviews();
        setAllReviews(publishedReviews);
      } catch (e) {
        console.error("Failed to refresh published reviews", e);
      }

      navigate('magazine');
    } catch (error) {
      console.error('handlePublish error:', error);
      alert('An unexpected error occurred while publishing. Please try again.');
    }
  };

  const handleUpdateReview = async (updatedReview) => {
    if (!currentUser) return;

    try {
      const canProceed = await checkCreditsForAction('edit');
      if (!canProceed) return;

      await api.updateReview(updatedReview.id, updatedReview.userId || currentUser?.id, updatedReview);

      const deductRes = await deductCredits('edit');
      if (deductRes) {
        setCreditStatus(prev => ({ ...prev, credits: deductRes.remaining }));
      }

      if (currentUser?.id) {
        const freshUser = await api.getUser(currentUser.id);
        if (freshUser) {
          setCurrentUser(freshUser);
          saveSessionLocal(freshUser);
        }
      }
      setCurrentReview(updatedReview);

      if (currentUser?.role === 'admin' || currentUser?.email === 'verdiqmag@gmail.com') {
        try {
          const usersList = await api.getAllUsers();
          setUsers(usersList);
          setAllReviews(usersList.flatMap(u => u.history || []));
        } catch (_) {}
      }
    } catch (error) {
      console.error('handleUpdateReview error:', error);
      alert('An unexpected error occurred while saving changes. Please try again.');
    }
  };

  const handleUpdateProfile = async (updatedUser) => {
    try {
      const savedUser = await api.updateUser(updatedUser.id, updatedUser);

      if (currentUser?.id === savedUser.id) {
        setCurrentUser(savedUser);
        saveSessionLocal(savedUser);
      }

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
      try {
        await api.deleteUser(userId);
        setUsers(prev => prev.filter(u => u.id !== userId));
        setAllReviews(prev => prev.filter(r => r.userId !== userId));
      } catch (e) {
        console.error('Delete user error:', e);
      }
    }
  };

  const handleAdminUpdateReview = async (review, userId) => {
    await api.updateReview(review.id, userId, review);

    try {
      const publishedReviews = await api.getPublishedReviews();
      setAllReviews(publishedReviews);
    } catch (e) {
      console.error("Failed to refresh published reviews", e);
    }

    try {
      const usersList = await api.getAllUsers();
      setUsers(usersList);
    } catch (e) {
      console.error('Error refreshing users after review update:', e);
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
    <PayPalScriptProvider options={{ 
      clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || "test",
      currency: "USD",
      intent: "capture"
    }}>
      <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950 font-sans overflow-x-hidden">
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
          handleAnalyze={handleAnalyze}
          handleLogin={handleLogin}
          handleUpdateReview={handleUpdateReview}
          handlePublish={handlePublish}
          handleUpdateProfile={handleUpdateProfile}
          handleDeleteUser={handleDeleteUser}
          handleAdminUpdateReview={handleAdminUpdateReview}
          handleAddStyleGuide={handleAddStyleGuide}
          handleUpdateStyleGuide={handleUpdateStyleGuide}
          handleDeleteStyleGuide={handleDeleteStyleGuide}
          handleLogout={handleLogout}
          fetchReviewWithAudio={fetchReviewWithAudio}
          navigateToReview={navigateToReview}
          navigate={navigate}
        />
      )}

      <Footer navigate={navigate} />

      {/* Support Widget */}
      {currentUser && (view === 'dashboard' || view === 'podcasts' || view === 'magazine' || view === 'account' || view === 'guide' || view === 'pricing') && (
        <SupportWidget currentUser={currentUser} />
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
    </PayPalScriptProvider>
  );
}

export default App;
