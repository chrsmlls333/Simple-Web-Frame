import { useState, useEffect, useRef } from 'react';
import { type SessionId, sessionActiveResponseDataSchema } from '@/lib/schemas';
import { formatTimestamp } from '@/lib/styles';

interface SessionActiveHookResult {
  isActive: boolean;
  lastActiveAt: number;
  lastActiveAtFormatted: string;
  isConnected: boolean;
}

export function useSessionActivity(sessionId: SessionId): SessionActiveHookResult {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [lastActiveAt, setLastActiveAt] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Cleanup function for the event source
  const cleanupEventSource = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  useEffect(() => {
    // Initialize the event source
    const eventSource = new EventSource(`/api/sse/session-activity?sessionId=${sessionId}`);
    eventSourceRef.current = eventSource;

    // Set up event handlers
    eventSource.onopen = () => {
      console.log('[SessionActivity] Connection opened');
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[SessionActivity] Received data:', data);

        // Validate the data structure
        const activityData = sessionActiveResponseDataSchema.parse(data);

        // Update state with the activity data
        setIsActive(activityData.isActive);
        setLastActiveAt(activityData.lastActiveAt);
      } catch (error) {
        console.error('[SessionActivity] Error parsing event data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[SessionActivity] Error:', error);
      setIsConnected(false);

      // Try to reconnect after a delay
      setTimeout(() => {
        cleanupEventSource();
        // The browser will automatically try to reconnect
      }, 5000);
    };

    // Clean up on unmount
    return () => {
      cleanupEventSource();
    };
  }, [sessionId]);

  // Handle visibility changes to maintain connection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Reconnect if the tab becomes visible again and we're not connected
        if (!isConnected) {
          cleanupEventSource();
          eventSourceRef.current = new EventSource(
            `/api/sse/session-activity?sessionId=${sessionId}`
          );
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionId, isConnected]);

  return {
    isActive,
    lastActiveAt,
    lastActiveAtFormatted: formatTimestamp(lastActiveAt),
    isConnected,
  };
}
