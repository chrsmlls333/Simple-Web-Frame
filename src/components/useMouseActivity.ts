import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to track mouse activity and detect inactivity
 * @param inactiveTime Time in milliseconds before considering the user inactive
 * @returns Object containing isActive state and reset function
 */
export const useMouseActivity = (inactiveTime: number = 5000) => {
  const [isActive, setIsActive] = useState<boolean>(true);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const lastHandled = useRef<number>(0);

  const throttle = (func: Function, limit: number) => {
    return function (...args: any[]) {
      const now = Date.now();
      if (now - lastHandled.current >= limit) {
        lastHandled.current = now;
        func(...args);
      }
    };
  };

  useEffect(() => {
    // Update last activity timestamp when mouse moves
    const handleActivity = throttle(() => {
      setLastActivity(Date.now());
      setIsActive(true);
    }, 200); // Throttle to run at most once every 200ms

    // Check if user has been inactive
    const checkActivity = setInterval(() => {
      const currentTime = Date.now();
      if (currentTime - lastActivity > inactiveTime) {
        setIsActive(false);
      }
    }, 1000); // Check every second

    // Add event listeners for mouse movement
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keypress', handleActivity); // Optional: also detect keyboard activity

    // Clean up event listeners and interval
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keypress', handleActivity);
      clearInterval(checkActivity);
    };
  }, [inactiveTime, lastActivity]);

  // Function to manually reset activity timer
  const resetActivity = () => {
    setLastActivity(Date.now());
    setIsActive(true);
  };

  return { isActive, resetActivity };
};
