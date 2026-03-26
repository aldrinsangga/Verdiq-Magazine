import React, { useEffect } from 'react';
import { auth } from '../authClient';
import { onAuthStateChanged } from 'firebase/auth';

interface SessionHeartbeatProps {
  onSessionExpired: () => void;
}

/**
 * Periodically checks for session validity and handles expiration.
 */
export const SessionHeartbeat: React.FC<SessionHeartbeatProps> = ({ onSessionExpired }) => {
  useEffect(() => {
    // 1. Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
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
          onSessionExpired();
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
