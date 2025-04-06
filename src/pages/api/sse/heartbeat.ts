import type { APIRoute } from 'astro';
import { SessionIdSchema, type HeartbeatResponseData } from '@/lib/schemas';
import { sessionStore } from '@/lib/nanostores/sessionStore';
import { taskQueue } from '@/lib/nanostores/taskQueue';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const _sessionId = url.searchParams.get('sessionId');
  let sessionId: string;

  // Validate sessionId
  try {
    sessionId = SessionIdSchema.parse(_sessionId);
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid session ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!sessionStore.has(sessionId)) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Set up SSE response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let isConnectionActive = true;

      // Helper function to close the stream
      function closeStream() {
        isConnectionActive = false;
        controller.close();
        sessionStore.markInactive(sessionId);
        console.log(`[SSE] Stream closed for session ${sessionId}`);
      }

      // Helper function to safely send data to the stream
      const safeEnqueue = (data: any) => {
        if (!isConnectionActive) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (error) {
          console.error(`[SSE] Error sending data to stream: ${error}`);
          closeStream();
          throw error;
        }
      };

      // Mark session as active
      sessionStore.markActive(sessionId);

      // Send initial data
      const session = sessionStore.get(sessionId);
      if (!session) {
        console.error(`[SSE] Session ${sessionId} not found`);
        closeStream();
        return;
      }

      const initialData: HeartbeatResponseData = {
        type: 'initial',
        session,
        timestamp: Date.now(),
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`));

      // Set up interval to send heartbeat and check for tasks
      const interval = setInterval(() => {
        if (!isConnectionActive || request.signal.aborted) {
          clearInterval(interval);
          return;
        }

        try {
          sessionStore.markActive(sessionId);

          const session = sessionStore.get(sessionId);
          const tasks = taskQueue.getSessionsTasks(sessionId, false, false);

          if (!session) {
            console.error(`[SSE] Session ${sessionId} not found`);
            clearInterval(interval);
            return;
          }

          const updateData: HeartbeatResponseData = {
            type: 'update',
            session,
            tasks,
            timestamp: Date.now(),
          };
          safeEnqueue(updateData);
        } catch (error) {
          console.error(`[SSE] Error in heartbeat interval: ${error}`);
          clearInterval(interval);
        }
      }, 15000);

      // Set up listeners for nanostores
      const unsubscribeToUrlChanges = sessionStore.subscribeToUrlChanges(sessionId, (session) => {
        if (!isConnectionActive) {
          unsubscribeToUrlChanges();
          return;
        }

        try {
          const urlData: HeartbeatResponseData = {
            type: 'update',
            session,
            timestamp: Date.now(),
          };
          safeEnqueue(urlData);
        } catch (error) {
          console.error(`[SSE] Error in URL listener: ${error}`);
          unsubscribeToUrlChanges();
        }
      });

      const unsubscribeToSessionsTasks = taskQueue.subscribeToSessionsTasks(sessionId, (tasks) => {
        if (!isConnectionActive) {
          unsubscribeToSessionsTasks();
          return;
        }

        try {
          const taskData = {
            type: 'update',
            session: sessionStore.get(sessionId),
            tasks,
            timestamp: Date.now(),
          };
          safeEnqueue(taskData);
        } catch (error) {
          console.error(`[SSE] Error in task listener: ${error}`);
          unsubscribeToSessionsTasks();
        }
      });

      // Clean up when client disconnects
      request.signal.addEventListener('abort', () => {
        closeStream();
        clearInterval(interval);
        unsubscribeToUrlChanges();
        unsubscribeToSessionsTasks();
        console.log(`[SSE] Client disconnected for session ${sessionId}`);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
};
