import { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, getCurrentUser, saveSession, clearSession } from '../authClient';

export function useAppAuth() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userData = await getCurrentUser();
          if (userData) {
            setCurrentUser(userData);
            saveSession(userData);
          }
        } catch (e) {
          console.error("Auth state change sync failed", e);
        }
      } else {
        setCurrentUser(null);
        clearSession();
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = useCallback((user: any) => {
    setCurrentUser(user);
    saveSession(user);
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    clearSession();
  }, []);

  return {
    currentUser,
    setCurrentUser,
    isInitializing,
    setIsInitializing,
    handleLogin,
    handleLogout
  };
}
