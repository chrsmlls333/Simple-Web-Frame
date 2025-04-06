import type { APIRoute } from 'astro';
import { SessionIdSchema, type SessionActiveResponseData } from '@/lib/schemas';
import { sessionStore } from '@/lib/nanostores/sessionStore';

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

      // Send initial status
      const session = sessionStore.get(sessionId);
      if (!session) {
        console.error(`[SSE] Session ${sessionId} not found`);
        controller.close();
        return;
      }

      const initialData: SessionActiveResponseData = {
        type: 'status',
        isActive: session.isActive,
        lastActiveAt: session.lastActiveAt,
        timestamp: Date.now(),
      };

      safeEnqueue(initialData);

      // Set up a listener for activity changes
      const activityListener = sessionStore.subscribeToActivityChanges(sessionId, (session) => {
        if (!isConnectionActive) {
          activityListener(); // Unsubscribe if connection is inactive
          return;
        }

        try {
          const activityData: SessionActiveResponseData = {
            type: 'status',
            isActive: session.isActive,
            lastActiveAt: session.lastActiveAt,
            timestamp: Date.now(),
          };
          safeEnqueue(activityData);
        } catch (error) {
          console.error(`[SSE] Error in activity listener: ${error}`);
          isConnectionActive = false;
          activityListener(); // Unsubscribe
        }
      });

      // Set up a polling interval as a fallback
      const interval = setInterval(() => {
        // Skip if connection is closed
        if (!isConnectionActive || request.signal.aborted) {
          clearInterval(interval);
          return;
        }

        try {
          const session = sessionStore.get(sessionId);
          if (!session) {
            console.error(`[SSE] Session ${sessionId} not found`);
            clearInterval(interval);
            return;
          }

          const statusData: SessionActiveResponseData = {
            type: 'status',
            isActive: session.isActive,
            lastActiveAt: session.lastActiveAt,
            timestamp: Date.now(),
          };
          safeEnqueue(statusData);
        } catch (error) {
          console.error(`[SSE] Error in status interval: ${error}`);
          isConnectionActive = false;
          clearInterval(interval);
        }
      }, 15000); // Check every 15 seconds

      // Clean up when client disconnects
      request.signal.addEventListener('abort', () => {
        isConnectionActive = false;
        clearInterval(interval);
        activityListener(); // Unsubscribe from activity changes
        console.log(`[SSE] Activity monitor disconnected for session ${sessionId}`);
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
