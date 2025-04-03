import { useState, useEffect, useRef } from 'react';
import { type SessionData, type Task, type Config, type SessionId, heartbeatDataSchema } from '@/lib/schemas';
import { actions } from 'astro:actions';

type ConnectionStatus = 'connecting' | 'active' | 'pulse' | 'error';

type HeartbeatResult = {
  config: Config;
  connectionStatus: ConnectionStatus;
  tasks: Task[];
  isConnected: boolean;
  markTaskCompleted: (taskId: string) => Promise<void>;
  markInactive: () => Promise<void>;
};

export function useHeartbeat(sessionId: SessionId, initialConfig: Config): HeartbeatResult {
  const [sessionConfig, updateSessionConfig] = useState<Config>(initialConfig);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isConnected, setIsConnected] = useState(false);
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
    const eventSource = new EventSource(`/api/sse/heartbeat?sessionId=${sessionId}`);
    eventSourceRef.current = eventSource;

    // Set up event handlers
    eventSource.onopen = () => {
      console.log('[SSE] Connection opened');
      setConnectionStatus('active');
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const _data = JSON.parse(event.data);
        console.log('[SSE] Received data:', _data);

        // Validate the data structure
        const data = heartbeatDataSchema.parse(_data);

        // Update connection status to show a pulse
        setConnectionStatus('pulse');
        setTimeout(() => setConnectionStatus('active'), 1000);

        // Update config if it has changed
        if (data.session) {
          const newConfig = {
            iframeUrl: data.session.iframeUrl,
          };
          
          // Only update if config actually changed
          // if (newConfig.iframeUrl !== sessionConfig.iframeUrl) {
            updateSessionConfig(newConfig);
          // }
        }

        // Update tasks
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
          eventSourceRef.current = new EventSource(`/api/sse/heartbeat?sessionId=${sessionId}`);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionId, isConnected]);

  // Function to mark a task as completed
  const markTaskCompleted = async (taskId: string) => {
    try {
      await actions.markTaskCompleted.orThrow({ taskId });
      // Update local tasks list to remove the completed task
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
    } catch (e) {
      console.error('[Heartbeat] Failed to mark task as completed:', e);
    }
  };

  // Function to mark session as inactive
  const markInactive = async () => {
    try {
      await actions.markInactive.orThrow({ sessionId });
    } catch (e) {
      console.error('[Heartbeat] Failed to mark session as inactive:', e);
    }
  };

  return {
    config: sessionConfig,
    connectionStatus,
    tasks,
    isConnected,
    markTaskCompleted,
    markInactive,
  };
}
