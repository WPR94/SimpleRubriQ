import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { notify } from '../utils/notify';

/**
 * Session timeout hook for security compliance (UK GDPR)
 * Automatically logs out users after a period of inactivity
 */
export function useSessionTimeout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);

  // Get timeout from localStorage (in minutes)
  const getTimeoutMinutes = () => {
    const stored = localStorage.getItem('simple-rubriq-session-timeout');
    return stored ? parseInt(stored) : 120; // Default 120 minutes (2 hours)
  };

  const resetTimer = () => {
    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    if (!user) return;

    const timeoutMinutes = getTimeoutMinutes();
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const warningMs = timeoutMs - 60 * 1000; // Warn 1 minute before

    // Set warning timer (1 minute before logout)
    warningRef.current = setTimeout(() => {
      notify.error('Session will expire in 1 minute due to inactivity', {
        duration: 10000,
      });
    }, warningMs);

    // Set logout timer
    timeoutRef.current = setTimeout(async () => {
      notify.error('Session expired due to inactivity. Please sign in again.');
      await signOut();
      navigate('/auth');
    }, timeoutMs);
  };

  useEffect(() => {
    if (!user) return;

    // Events that indicate user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

    // Reset timer on any user activity
    const handleActivity = () => resetTimer();

    // Initial timer setup
    resetTimer();

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    // Cleanup
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [user]);
}
