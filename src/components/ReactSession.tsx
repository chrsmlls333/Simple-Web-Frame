import React, { useState, useEffect } from 'react';
import { type Session } from '../lib/sessionStore';
import { actions } from 'astro:actions';
import SessionFrame from './SessionFrame';

interface ReactSessionProps {}

export default function ReactSession() {
  const [sessionId, setSessionId] = useState<string>();
  const [sessionData, setSessionData] = useState<Session>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Initialize session on mount
  useEffect(() => {
    setIsLoading(true);

    // Get session ID from URL parameter or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    let foundSessionId = urlParams.get('sessionId') || localStorage.getItem('currentSessionId');

    // Call the server action to get or create a session
    actions.getSession({
      sessionId: foundSessionId || undefined
    }).then(({ data, error }) => {
      if (error) {
        setError('Failed to get session');
        return;
      }

      // Update session data
      setSessionId(data.sessionId);
      setSessionData(data.session);

      // Store session ID in localStorage for persistence
      localStorage.setItem('currentSessionId', data.sessionId);

      // Update URL to include session ID without page reload
      const url = new URL(window.location.href);
      if (!url.searchParams.has('sessionId')) {
        url.searchParams.set('sessionId', data.sessionId);
        window.history.replaceState({}, '', url);
      }

      console.log(`[Client] Using session: ${data.sessionId}`);
    }).catch((e) => {
      setError(`Error initializing session: ${e.message}`);
    }).finally(() => {
      setIsLoading(false);
    });
  }, []);
  
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading session...</div>;
  }
  
  if (error) {
    return <div className="flex items-center justify-center h-screen text-red-600">{error}</div>;
  }
  
  return (
    <div className="min-h-screen">
      {sessionId && sessionData && (
        <SessionFrame sessionId={sessionId} config={sessionData} />
      )}
    </div>
  );
}
