import type { APIRoute } from 'astro';
import { SessionDataSchema, SessionIdSchema, TaskSchema, type HeartbeatData } from '@/lib/schemas';
import { sessionStore } from '@/lib/nanostores/sessionStore';
import { taskQueue } from '@/lib/nanostores/taskQueue';
import { z } from 'astro:schema';



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
      // Flag to track if the connection is active
      let isConnectionActive = true;

      // Mark session as active
      sessionStore.markActive(sessionId);

      // Send initial data
      const session = sessionStore.get(sessionId);
      // const tasks = taskQueue.getSessionsTasks(sessionId, false, false);

      if (!session) {
        console.error(`[SSE] Session ${sessionId} not found`);
        controller.close();
        return;
      }

      const initialData: HeartbeatData = {
        type: 'initial',
        session,
        timestamp: Date.now(),
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`));

      // Function to safely send data to the stream
      const safeEnqueue = (data: any) => {
        if (isConnectionActive) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (error) {
            console.error(`[SSE] Error sending data to stream: ${error}`);
            isConnectionActive = false;
          }
        }
      };

      // Set up interval to send heartbeat and check for tasks
      const interval = setInterval(() => {
        // Skip if connection is closed
        if (!isConnectionActive || request.signal.aborted) {
          clearInterval(interval);
          return;
        }

        try {
          // Mark session as active
          sessionStore.markActive(sessionId);

          // Get updated session and tasks
          const session = sessionStore.get(sessionId);
          const tasks = taskQueue.getSessionsTasks(sessionId, false, false);

          if (!session) {
            console.error(`[SSE] Session ${sessionId} not found`);
            clearInterval(interval);
            return;
          }

          // Send update
          const updateData: HeartbeatData = {
            type: 'update',
            session,
            tasks,
            timestamp: Date.now(),
          };
          safeEnqueue(updateData);
        } catch (error) {
          console.error(`[SSE] Error in heartbeat interval: ${error}`);
          isConnectionActive = false;
          clearInterval(interval);
        }
      }, 15000);

      // Set up listeners for nanostores
      const urlListener = sessionStore.subscribeToUrlChanges(sessionId, (session) => {
        if (!isConnectionActive) {
          urlListener(); // Unsubscribe if connection is inactive
          return;
        }

        try {
          const urlData: HeartbeatData = {
            type: 'update',
            session,
            timestamp: Date.now(),
          };
          safeEnqueue(urlData);
        } catch (error) {
          console.error(`[SSE] Error in URL listener: ${error}`);
          isConnectionActive = false;
          urlListener(); // Unsubscribe
        }
      });

      const taskListener = taskQueue.subscribeToSessionsTasks(sessionId, (tasks) => {
        if (!isConnectionActive) {
          taskListener(); // Unsubscribe if connection is inactive
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
          isConnectionActive = false;
          taskListener(); // Unsubscribe
        }
      });

      // Clean up when client disconnects
      request.signal.addEventListener('abort', () => {
        isConnectionActive = false;
        clearInterval(interval);
        urlListener(); // Unsubscribe from URL changes
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
