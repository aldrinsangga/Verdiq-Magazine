import { useEffect, useRef } from 'react';
import { normalizePath, pathToView, getViewFromPath } from '../constants';
import { isAdmin, getCurrentUser, saveSession } from '../authClient';

export function useAppInitialization(
  currentUser: any,
  setCurrentUser: (user: any) => void,
  setIsInitializing: (isInit: boolean) => void,
  setView: (view: string) => void,
  setPaypalClientId: (id: string) => void,
  setAllReviews: (reviews: any[]) => void,
  setTargetPodcastId: (id: string | null) => void,
  setCurrentReview: (review: any) => void,
  fetchCreditStatus: () => Promise<void>,
  fetchStyleGuides: () => Promise<void>,
  navigate: (view: string, extra?: string | null, overrideUser?: any) => void,
  API_URL: string,
  fetchWithTimeout: (url: string, options?: any, timeout?: number) => Promise<Response>
) {
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const init = async () => {
      const startPath = normalizePath(window.location.pathname);
      try {
        const configPromise = fetchWithTimeout(`${API_URL}/api/config`).then(res => res.ok ? res.json() : null).catch(() => null);
        const userPromise = getCurrentUser().catch(() => null);
        const reviewsPromise = fetchWithTimeout(`${API_URL}/api/public/published-reviews?limit=100`, { cache: 'no-store' }).then(res => res.ok ? res.json() : null).catch(() => null);

        const [config, savedUser, reviewsData] = await Promise.all([configPromise, userPromise, reviewsPromise]);

        if (config && config.paypalClientId) {
          setPaypalClientId(config.paypalClientId);
        }

        if (savedUser) {
          setCurrentUser(savedUser);
          saveSession(savedUser);
          fetchCreditStatus();
          if (isAdmin(savedUser)) {
            fetchStyleGuides();
          }
        }

        if (reviewsData) {
          setAllReviews(reviewsData.reviews || []);
        }

        const currentPath = normalizePath(window.location.pathname);
        if (currentPath !== startPath) {
          setIsInitializing(false);
          return;
        }

        const reviewMatch = currentPath.match(/^\/review\/([a-zA-Z0-9-]+)$/);
        const podcastMatch = currentPath.match(/^\/podcasts\/([a-zA-Z0-9-]+)$/);

        if (reviewMatch) {
          const reviewId = reviewMatch[1];
          try {
            const reviewRes = await fetchWithTimeout(`${API_URL}/api/public/reviews/${reviewId}`);
            if (reviewRes.ok) {
              const reviewData = await reviewRes.json();
              setCurrentReview({ ...reviewData, viewOnly: true });
              setView('review');
            } else {
              navigate('magazine', null, savedUser);
            }
          } catch (e) {
            console.error('Failed to load shared review:', e);
            navigate('magazine', null, savedUser);
          }
        } else if (podcastMatch) {
          const podcastId = podcastMatch[1];
          setTargetPodcastId(podcastId);
          setView('podcasts');
        } else {
          const params = new URLSearchParams(window.location.search);
          const urlView = params.get('view');
          const initialView = pathToView[currentPath] || 'landing';
          
          const validViews = [
            'landing', 'magazine', 'podcasts', 'dashboard', 'pricing', 
            'guide', 'account', 'referrals', 'faq', 'terms', 
            'privacy', 'contact', 'admin', 'auth', 'signup'
          ];
          
          if (urlView && validViews.includes(urlView)) {
            navigate(urlView, null, savedUser);
          } else {
            if (savedUser) {
              if (initialView === 'signup' || initialView === 'auth') {
                navigate('dashboard', null, savedUser);
              } else if (initialView === 'admin' && !isAdmin(savedUser)) {
                navigate('landing', null, savedUser);
              }
            } else {
              const protectedViews = ['dashboard', 'account', 'admin', 'referrals'];
              if (protectedViews.includes(initialView)) {
                navigate('auth', null, savedUser);
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
  }, []);
}
