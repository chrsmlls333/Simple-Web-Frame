import React, { useEffect, useState, useRef } from 'react';
import { DEFAULT_IFRAME_URL, type Config, type SessionId } from '../../lib/sessionStore';
import type { Task } from '../../lib/taskQueue';
import { actions } from 'astro:actions';
import { getReadableUUID } from '../../lib/styles';
import { useMouseActivity } from '../useMouseActivity';
import { AnimatePresence, motion } from 'motion/react';
import CopyUrl from './CopyUrl';

interface SessionFrameProps {
  sessionId: SessionId;
  config: Config;
}

// Status options with corresponding text and class name
const connectionStatusOptions = {
  active: {
    text: 'Active',
    className: 'font-semibold text-green-600',
    pulse: false,
  },
  pulse: {
    text: 'Active',
    className: 'font-semibold text-green-600',
    pulse: true,
  },
  error: {
    text: 'Error',
    className: 'font-semibold text-red-600',
    pulse: false,
  },
} as const;

const iframeStatusOptions = ['loading', 'loaded', 'error'] as const;

const SessionFrame: React.FC<SessionFrameProps> = ({ sessionId, config: initialConfig }) => {
  const [config, setConfig] = useState(initialConfig);

  const contentFrameRef = useRef<HTMLIFrameElement>(null);
  const [iframeStatus, setIframeStatus] = useState<(typeof iframeStatusOptions)[number]>('loading');

  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval>>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<keyof typeof connectionStatusOptions>('active');

  const { isActive: isMouseMoving } = useMouseActivity();

  const urlIsDefault = config.iframeUrl === DEFAULT_IFRAME_URL;
  const id = getReadableUUID(sessionId);

  // Process a task based on its type
  const processTask = (task: Task) => {
    console.log(`[TaskRunner] Processing task: ${task.task}`, task);

    switch (task.task) {
      case 'refresh':
        if (contentFrameRef.current) {
          setIframeStatus('loading');
          contentFrameRef.current.src = contentFrameRef.current.src;
          console.log('[TaskRunner] Refreshed iframe');
        } else {
          console.warn('[TaskRunner] Cannot refresh: iframe ref is null');
        }
        break;

      case 'screenshot':
        console.warn("[TaskRunner] 'screenshot' task not implemented");
        break;

      default:
        console.warn(`[TaskRunner] Unknown task type: ${(task as any).task}`);
        break;
    }

    // Mark a task as completed
    const markTaskCompleted = async (taskId: string) => {
      try {
        await actions.markTaskCompleted.orThrow({ taskId });
        console.log(`[TaskRunner] Marked task ${taskId} as completed`);
      } catch (e) {
        console.error('[TaskRunner] Failed to mark task as completed:', e);
      }
    };
    markTaskCompleted(task.id);
  };

  useEffect(() => {
    const sendHeartbeat = async () => {
      setConnectionStatus('pulse');

      try {
        const data = await actions.heartbeat.orThrow({ sessionId });
        compareConfigToDOM(data.session);

        // Process any tasks that came with the heartbeat
        if (data.tasks && data.tasks.length > 0) {
          console.log(`[TaskRunner] Received ${data.tasks.length} tasks`);
          data.tasks.forEach(processTask);
        }

        setTimeout(() => setConnectionStatus('active'), 1000);
      } catch (e) {
        console.error('Error sending heartbeat:', e);
        setConnectionStatus('error');
      }
    };

    const markInactive = async () => {
      try {
        await actions.markInactive.orThrow({ sessionId });
      } catch (e) {
        console.error('Failed to mark session as inactive:', e);
      }
    };

    const compareConfigToDOM = (newConfig: Config) => {
      if (newConfig.iframeUrl !== config.iframeUrl) {
        setIframeStatus('loading');
        setConfig(newConfig);
        console.log('[Client] Updated iframe URL to:', newConfig.iframeUrl);
      } else {
        console.log('[Client] No changes detected');
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
    <div className='relative flex h-screen w-full flex-col overflow-clip'>
      <AnimatePresence>
        {urlIsDefault && (
          <motion.div
            id='new-modal'
            className='bg-opacity-50 fixed inset-0 z-20 flex items-center justify-center bg-black'
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className='space-y-2 rounded-lg bg-zinc-500 text-center shadow-lg'
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.5 }}
              transition={{ duration: 0.3, type: 'spring', stiffness: 200 }}
            >
              <div className='space-y-2 rounded-lg bg-zinc-100 px-6 pt-4 pb-4 text-center shadow-lg'>
                {/* <h2 className="text-xl font-bold">New Session</h2> */}
                <h3 className='font-mono text-9xl font-bold tracking-widest'>{id}</h3>
              </div>
              <div className='m-2 mb-4 space-y-2 text-center'>
                <p className='text-white opacity-70'>
                  This session is ready to use. Go to the{' '}
                  <a href={`/admin#session-${sessionId}`} target='_blank' className='underline'>
                    Session Manager
                  </a>{' '}
                  to configure.
                </p>
                <p className='text-xs leading-loose text-zinc-300 opacity-70'>
                  Or copy this URL to re-use on other system or browser.
                  <br />
                  <CopyUrl url={`${window.location.origin}/?sessionId=${sessionId}`} />
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        id='iframe-container'
        className='relative flex-grow'
        initial={{ opacity: 1 }}
        animate={{ opacity: iframeStatus === 'loading' ? 0 : 1 }}
        transition={{ duration: 0.5 }}
      >
        <iframe
          id='content-frame'
          ref={contentFrameRef}
          src={config.iframeUrl}
          allow='clipboard-read;clipboard-write;geolocation;camera;microphone;midi;usb;serial;xr-spatial-tracking;web-share;ambient-light-sensor;window-management'
          sandbox='allow-scripts allow-same-origin allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-presentation allow-downloads allow-popups allow-popups-to-escape-sandbox'
          allowFullScreen={true}
          className={'absolute top-0 left-0 h-full w-full border-none transition-opacity'}
          onLoad={() => setIframeStatus('loaded')}
          onError={() => setIframeStatus('error')}
        ></iframe>
      </motion.div>
      <motion.div
        id='session-info-bar'
        className={
          'absolute bottom-[1px] z-10 -mb-4 flex w-full justify-between border-t border-gray-300 bg-gray-100/80 p-2 pb-6 opacity-100 transition-opacity duration-300'
        }
        initial={{ opacity: 1, y: 0 }}
        animate={
          iframeStatus === 'loaded' && !isMouseMoving ? { y: 50, opacity: 0 } : { y: 0, opacity: 1 }
        }
      >
        <p>
          Session ID:{' '}
          <span id='session-id' className='font-mono text-lg font-bold tracking-wider'>
            {id}
          </span>
        </p>
        <p>
          Status:{' '}
          <span
            id='active-status'
            className={`${connectionStatusOptions[connectionStatus].className} ${
              connectionStatusOptions[connectionStatus].pulse ? 'animate-pulse' : ''
            }`}
          >
            {connectionStatusOptions[connectionStatus].text}
          </span>
        </p>
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
      </motion.div>
      {!isMouseMoving && (
        // TODO: Cursor hiding doesn't work over iframe, this does not resolve the issue
        <div className='fixed inset-0 z-50 cursor-none opacity-0'></div>
      )}
    </div>
  );
};

export default SessionFrame;
