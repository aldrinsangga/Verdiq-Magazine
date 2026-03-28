import { useState, useCallback, useRef, useEffect } from 'react';
import { viewToPath, normalizePath } from '../constants';
import { isAdmin } from '../authClient';

export function useAppNavigation(currentUser: any) {
  const currentUserRef = useRef(currentUser);
  
  // Keep ref in sync with prop
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const [view, setView] = useState(() => {
    const path = normalizePath(window.location.pathname);
    if (path.startsWith('/review/')) return 'review';
    if (path.startsWith('/podcasts/')) return 'podcasts';
    // Use the viewToPath mapping
    const pathToView = Object.fromEntries(
      Object.entries(viewToPath).map(([v, p]) => [p, v])
    );
    return pathToView[path] || 'landing';
  });
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountTab, setAccountTab] = useState('profile');
  const [targetPodcastId, setTargetPodcastId] = useState<string | null>(null);
  const [currentReview, setCurrentReview] = useState<any>(null);

  const updateUrlForView = useCallback((newView: string, reviewId: string | null = null) => {
    const safeReviewId = typeof reviewId === 'string' ? reviewId : null;
    let newPath = viewToPath[newView as keyof typeof viewToPath] || '/';
    
    if (newView === 'review' && safeReviewId) {
      newPath = `/review/${safeReviewId}`;
    } else if (newView === 'podcasts' && safeReviewId) {
      newPath = `/podcasts/${safeReviewId}`;
    }
    
    if (normalizePath(window.location.pathname) !== normalizePath(newPath)) {
      try {
        window.history.pushState({ view: String(newView), reviewId: safeReviewId }, '', newPath);
      } catch (e) {
        console.error('pushState failed:', e);
      }
    }
  }, []);

  const navigate = useCallback((v: string, reviewId: string | null = null, overrideUser: any = undefined) => {
    setMobileMenuOpen(false);
    
    const activeUser = overrideUser !== undefined ? overrideUser : currentUserRef.current;
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
    
    setTimeout(() => window.scrollTo(0, 0), 0);
  }, [updateUrlForView]);

  return {
    view,
    setView,
    mobileMenuOpen,
    setMobileMenuOpen,
    accountTab,
    setAccountTab,
    targetPodcastId,
    setTargetPodcastId,
    currentReview,
    setCurrentReview,
    navigate,
    updateUrlForView
  };
}
