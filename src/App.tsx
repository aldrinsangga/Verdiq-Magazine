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
import { viewToPath, pathToView, normalizePath, getViewFromPath } from './constants';
import { useAppNavigation } from './hooks/useAppNavigation';
import { useAppAuth } from './hooks/useAppAuth';
import { useAppInitialization } from './hooks/useAppInitialization';
import { useAppActions } from './hooks/useAppActions';

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

function AppContent() {
  const { showNotification } = useNotification();
  
  const { currentUser, setCurrentUser, isInitializing, setIsInitializing, handleLogin, handleLogout: authLogout } = useAppAuth();
  const { 
    view, setView, mobileMenuOpen, setMobileMenuOpen, accountTab, setAccountTab, 
    targetPodcastId, setTargetPodcastId, currentReview, setCurrentReview, navigate, updateUrlForView 
  } = useAppNavigation(currentUser);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Analyzing...");
  const [currentAudioFile, setCurrentAudioFile] = useState(null);
  
  const [users, setUsers] = useState([]);
  const [adminUsers, setAdminUsers] = useState({ users: [], totalCount: 0, limit: 20, offset: 0 });
  const [adminReviews, setAdminReviews] = useState({ reviews: [], totalCount: 0, limit: 20, offset: 0 });
  const [allReviews, setAllReviews] = useState([]);
  const [styleGuides, setStyleGuides] = useState([]);
  const [paypalClientId, setPaypalClientId] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportView, setSupportView] = useState<'list' | 'form' | 'chat'>('list');
  const [creditStatus, setCreditStatus] = useState(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditModalConfig, setCreditModalConfig] = useState<{
    action: string | null;
    required: number;
    reason?: string;
    message?: string;
    isFreeUser?: boolean;
  }>({ action: null, required: 0 });

  const analysisCancelledRef = useRef(false);

  const navigateToReview = useCallback((review, viewOnly = false) => {
    if (!review) {
      console.error('navigateToReview: Review is null');
      navigate('magazine');
      return;
    }
    
    setCurrentReview({ ...review, viewOnly });
    
    if (review.podcastAudioUrl) {
      setCurrentAudioFile({
        url: review.podcastAudioUrl,
        name: `${review.songTitle} - Review Podcast`
      });
    } else {
      setCurrentAudioFile(null);
    }
    
    navigate('review', review.id);
  }, [navigate, setCurrentReview, setCurrentAudioFile]);

  const fetchReviewWithAudio = useCallback(async (reviewId) => {
    try {
      const headers = await getAuthHeadersLocal();
      const res = await fetch(`${API_URL}/api/reviews/${reviewId}`, { headers });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to fetch review with audio:', e);
    }
    return null;
  }, []);

  const {
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
  } = useAppActions(
    currentUser,
    setCurrentUser,
    setCreditStatus,
    setLoading,
    setStatus,
    currentReview,
    setCurrentReview,
    setCurrentAudioFile,
    setUsers,
    setAdminUsers,
    setAdminReviews,
    setAllReviews,
    setStyleGuides,
    setTargetPodcastId,
    setShowCreditModal,
    setCreditModalConfig,
    showNotification,
    navigate,
    navigateToReview,
    fetchReviewWithAudio,
    API_URL,
    analysisCancelledRef,
    compressImage,
    saveSessionLocal,
    getAuthHeadersLocal,
    fetchWithTimeout
  );

  useAppInitialization(
    currentUser,
    setCurrentUser,
    setIsInitializing,
    setView,
    setPaypalClientId,
    setAllReviews,
    setTargetPodcastId,
    setCurrentReview,
    fetchCreditStatus,
    fetchStyleGuides,
    navigate,
    API_URL,
    fetchWithTimeout
  );

  // Fetch user-specific data when currentUser changes
  useEffect(() => {
    if (currentUser) {
      fetchCreditStatus();
      if (isAdmin(currentUser)) {
        fetchStyleGuides();
      }
    }
  }, [currentUser, fetchCreditStatus, fetchStyleGuides]);

  const handleCancelAnalysis = () => {
    analysisCancelledRef.current = true;
    setLoading(false);
    setStatus("");
    showNotification("Analysis cancelled. No credits were deducted.", "success");
  };

  const handleContactSupport = () => {
    if (!currentUser) {
      navigate('auth');
      return;
    }
    navigate('dashboard');
    setSupportOpen(true);
    setSupportView('form');
  };

  // Sync URL with view changes
  useEffect(() => {
    const handlePopState = async () => {
      const path = normalizePath(window.location.pathname);
      
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
        if (newView !== 'podcasts') {
          setTargetPodcastId(null);
        }
      }
      window.scrollTo(0, 0);
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setView, setCurrentReview, setTargetPodcastId, API_URL]);

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
      
      if (view === 'admin') {
        fetchAdminUsers(adminUsers.offset, adminUsers.limit);
        fetchAdminReviews(adminReviews.offset, adminReviews.limit);
      }
    } catch (e) {
      console.error('Failed to refresh user data:', e);
    }
  };

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (e) {
      console.error('Logout error:', e);
    }
    authLogout();
    navigate('landing', null, null);
    setCurrentAudioFile(null);
  }, [authLogout, navigate, setCurrentAudioFile]);

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
