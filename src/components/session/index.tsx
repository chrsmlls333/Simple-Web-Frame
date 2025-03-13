import React, { useState, useEffect } from 'react';
import { type SessionData, type SessionId } from '../../lib/sessionStore';
import { actions } from 'astro:actions';
import SessionFrame from './SessionFrame';

interface ReactSessionProps {}

export default function ReactSession() {
  const [sessionId, setSessionId] = useState<SessionId>();
  const [sessionData, setSessionData] = useState<SessionData>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Initialize session on mount
  useEffect(() => {
    const initializeSession = async () => {
      setIsLoading(true);

      const urlParamKey = 'sessionId';

      try {
        // Get session ID from URL parameter or localStorage
        const urlParams = new URLSearchParams(window.location.search);
        let foundSessionId = urlParams.get(urlParamKey);
        if (foundSessionId) console.log(`[Client] Found session ID in url query: ${foundSessionId}`);

        // if not in urlparam, then 
        if (!foundSessionId) {
          foundSessionId = localStorage.getItem('currentSessionId');
          if (foundSessionId) console.log(`[Client] Found session ID in localStorage: ${foundSessionId}`);
        }

        // if not in urlparam or localstorage, then notify user
        if (!foundSessionId) console.log(`[Client] No session ID found in url query or localStorage, server will generate a new one`);
        
        // Call the server action to get or create a session
        const { data, error } = await actions.getSession({
          sessionId: foundSessionId || undefined
        });

        if (error || !data) {
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
      } catch (e: any) {
        setError(`Error initializing session: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    initializeSession();
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
