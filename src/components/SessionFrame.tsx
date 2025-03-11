import React, { useEffect, useState, useRef } from 'react';
import { ConfigSchema, type Config } from '../lib/sessionStore';
import { actions } from 'astro:actions';
import { z } from 'astro:schema';

interface SessionFrameProps {
  sessionId: string;
  config: z.infer<typeof ConfigSchema>;
}

// Status options with corresponding text and class name
const statusOptions = {
  active: { text: 'Active', className: 'font-semibold text-green-600', pulse: false },
  pulse: { text: 'Active', className: 'font-semibold text-green-600', pulse: true },
  error: { text: 'Error', className: 'font-semibold text-red-600', pulse: false },
} as const;

const SessionFrame: React.FC<SessionFrameProps> = ({ sessionId, config: initialConfig }) => {
  const [config, setConfig] = useState(initialConfig);
  const [status, setStatus] = useState<keyof typeof statusOptions>('active');
  const contentFrameRef = useRef(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    
    const sendHeartbeat = async () => {
      // Trigger pulsing animation
      setStatus('pulse');
      // setTimeout(() => setStatus('active'), 1000);
      
      try {
        const { data, error } = await actions.heartbeat({ sessionId });
        
        if (error) {
          console.error('Failed to send heartbeat:', error);
          setStatus('error');
          return;
        }
        
        if (data?.session) {
          compareConfigToDOM(data.session);
          setTimeout(() => setStatus('active'), 1000);
          // setStatus('active');
        }
      } catch (e) {
        console.error('Error sending heartbeat:', e);
        setStatus('error');
      }
    };
    
    const markInactive = async () => {
      try {
        await actions.markInactive({ sessionId });
      } catch (e) {
        console.error('Failed to mark session as inactive:', e);
      }
    };
    
    const compareConfigToDOM = (newConfig: Config) => {
      if (newConfig.iframeUrl !== config.iframeUrl) {
        setConfig(newConfig);
        console.log("[Client] Updated iframe URL to:", newConfig.iframeUrl);
      } else {
        console.log("[Client] No changes detected");
      }
    };
    
    // Send initial heartbeat
    sendHeartbeat();
    
    // Set up heartbeat interval
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 15000);
    
    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup function
    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      markInactive();
    };
  }, [sessionId, config.iframeUrl]);
  
  return (
    <div className="session-container flex flex-col w-full h-screen">
      <div className="session-info p-2 bg-gray-100 border-t border-gray-300 flex justify-between opacity-20 hover:opacity-100 absolute bottom-0 w-full z-10 transition-opacity">
        <p>Session ID: <span id="session-id">{sessionId}</span></p>
        <p>Status: <span 
        id="active-status" 
        className={`${statusOptions[status].className} ${statusOptions[status].pulse ? 'animate-pulse' : ''}`}>
        {statusOptions[status].text}
          </span>
        </p>
      </div>
      <div id="iframe-container" 
           className="iframe-container flex-grow relative">
        <iframe 
          id="content-frame"
          ref={contentFrameRef}
          src={config.iframeUrl} 
          title="Session Content"
          allow="clipboard-read;clipboard-write;geolocation;camera;microphone;midi;usb;serial;xr-spatial-tracking;web-share;ambient-light-sensor;window-management"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-presentation allow-downloads allow-popups allow-popups-to-escape-sandbox"
          allowFullScreen={true}
          className="absolute top-0 left-0 w-full h-full border-none">
        </iframe>
      </div>
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        
        .animate-pulse {
          animation: pulse 1s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default SessionFrame;
