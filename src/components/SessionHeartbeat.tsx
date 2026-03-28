import React, { useEffect, useRef } from 'react';
import { auth } from '../authClient';
import { onAuthStateChanged } from 'firebase/auth';

interface SessionHeartbeatProps {
  onSessionExpired: () => void;
}

/**
 * Periodically checks for session validity and handles expiration.
 */
export const SessionHeartbeat: React.FC<SessionHeartbeatProps> = ({ onSessionExpired }) => {
  const wasLoggedIn = useRef(false);

  useEffect(() => {
    // 1. Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        wasLoggedIn.current = true;
      } else if (wasLoggedIn.current) {
        // Only trigger expiration if they were previously logged in
        wasLoggedIn.current = false;
        onSessionExpired();
      }
    });

    // 2. Periodic token refresh/check
    const interval = setInterval(async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          // Force refresh token to ensure session is still valid
          await user.getIdToken(true);
        } catch (error) {
          console.error('[Session Heartbeat] Token refresh failed:', error);
          if (wasLoggedIn.current) {
            wasLoggedIn.current = false;
            onSessionExpired();
          }
        }
      }
    }, 10 * 60 * 1000); // Every 10 minutes

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [onSessionExpired]);

  return null;
};
