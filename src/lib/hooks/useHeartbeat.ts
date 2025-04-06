import { useState, useEffect, useRef } from 'react';
import { type Task, type Config, type SessionId, heartbeatResponseDataSchema } from '@/lib/schemas';
import { actions, getActionPath } from 'astro:actions';

type ConnectionStatus = 'connecting' | 'active' | 'pulse' | 'error';

interface HeartbeatHookResult {
  config: Config;
  connectionStatus: ConnectionStatus;
  tasks: Task[];
  isConnected: boolean;
  markTaskCompleted: (taskId: string) => Promise<void>;
  markInactive: () => Promise<void>;
}

export function useHeartbeat(sessionId: SessionId, initialConfig: Config): HeartbeatHookResult {
  const [sessionConfig, updateSessionConfig] = useState<Config>(initialConfig);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Cleanup function for the event source
  const cleanupEventSource = () => {
    if (eventSourceRef.current) {
      console.log('[SSE] Closing EventSource connection');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  // Mark session as inactive
  const markInactive = async (useBeacon = false) => {
    if (useBeacon && navigator.sendBeacon) {
      const url = getActionPath(actions.markInactive);
      const data = new Blob([JSON.stringify({ sessionId })], { type: 'application/json' });
      navigator.sendBeacon(url, data);
      console.log('[Heartbeat] Marked inactive using Beacon API');
      return;
    }

    try {
      await actions.markInactive.orThrow({ sessionId });
      console.log('[Heartbeat] Session marked as inactive');
    } catch (e) {
      console.error('[Heartbeat] Failed to mark session as inactive:', e);
    }
  };

  // Function to mark a task as completed
  const markTaskCompleted = async (taskId: string) => {
    try {
      await actions.markTaskCompleted.orThrow({ taskId });
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
    } catch (e) {
      console.error('[Heartbeat] Failed to mark task as completed:', e);
    }
  };

  // Effect to handle EventSource initialization and cleanup
  useEffect(() => {
    const eventSource = new EventSource(`/api/sse/heartbeat?sessionId=${sessionId}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[SSE] Connection opened');
      setConnectionStatus('active');
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const _data = JSON.parse(event.data);
        console.log('[SSE] Received data:', _data);

        const data = heartbeatResponseDataSchema.parse(_data);

        setConnectionStatus('pulse');
        setTimeout(() => setConnectionStatus('active'), 1000);

        if (data.session) {
          const newConfig = { iframeUrl: data.session.iframeUrl };
          updateSessionConfig(newConfig);
        }

        if ('tasks' in data && data.tasks) {
          setTasks(data.tasks);
        }
      } catch (error) {
        console.error('[SSE] Error parsing event data:', error);
        setConnectionStatus('error');
      }
    };

    eventSource.onerror = (error) => {
      console.error('[SSE] Error:', error);
      setConnectionStatus('error');
      setIsConnected(false);

      setTimeout(() => {
        cleanupEventSource();
      }, 5000);
    };

    const handleBeforeUnload = () => {
      cleanupEventSource();
      markInactive(true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      markInactive();
      cleanupEventSource();
    };
  }, [sessionId]);

  // Effect to handle visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected) {
        cleanupEventSource();
        eventSourceRef.current = new EventSource(`/api/sse/heartbeat?sessionId=${sessionId}`);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionId, isConnected]);

  return {
    config: sessionConfig,
    connectionStatus,
    tasks,
    isConnected,
    markTaskCompleted,
    markInactive,
  };
}
