import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { randomUUID } from 'crypto';
import { ConfigSchema, sessionStore, SessionIdSchema, type SessionData } from '../lib/sessionStore';
import { UrlEntrySchema, urlHistory } from '../lib/urlHistoryStore';

function standardNotFoundActionError() {
  return new ActionError({
    code: 'NOT_FOUND',
    message: 'Session not found',
  });
}

export const server = {

  getAllSessions: defineAction({
    handler: async () => {
      const sessions = sessionStore.getAllSorted();
      return { sessions };
    },
  }),

  getSession: defineAction({
    input: z.object({
      sessionId: SessionIdSchema.optional(),
    }),
    handler: async ({ sessionId }) => {
      // Generate a new session ID if not provided
      if (!sessionId) {
        sessionId = randomUUID();
      }

      if (!sessionStore.has(sessionId)) {
        // If this is a new session ID, create a default config
        sessionStore.create(sessionId);
      } else {
        // Mark existing session as active
        sessionStore.markActive(sessionId);
      }

      const session = sessionStore.get(sessionId);
      if (!session) throw standardNotFoundActionError();

      return { 
        sessionId, 
        session: (session as SessionData)
      };
    },
  }),
  
  // Heartbeat endpoint to keep a session marked as active and return current config
  heartbeat: defineAction({
    input: z.object({
      sessionId: SessionIdSchema,
    }),
    handler: async ({ sessionId }) => {
      if (!sessionStore.has(sessionId)) throw standardNotFoundActionError();

      // Mark the session as active
      sessionStore.markActive(sessionId);
      
      // Return the current session config to allow the client to check for updates
      const session = sessionStore.get(sessionId) as SessionData;
      return { session };
    },
  }),
  
  // Mark a session as inactive
  markInactive: defineAction({
    input: z.object({
      sessionId: SessionIdSchema,
    }),
    handler: async ({ sessionId }) => {
      if (!sessionStore.has(sessionId)) throw standardNotFoundActionError();
      sessionStore.markInactive(sessionId);
      return;
    },
  }),

  checkActive: defineAction({
    input: z.object({
      sessionId: SessionIdSchema,
    }),
    handler: async ({ sessionId }) => {
      const session = sessionStore.get(sessionId);
      if (!session) throw standardNotFoundActionError();
      return { 
        isActive: session.isActive,
        lastActiveAt: session.lastActiveAt
      };
    },
  }),
  
  updateSessionForm: defineAction({
    accept: 'form',
    input: ConfigSchema.extend({
      sessionId: SessionIdSchema,
    }),
    handler: async ({ sessionId, ...config }) => {
      const session = sessionStore.get(sessionId);

      if (!session) throw standardNotFoundActionError();

      const updatedSession: SessionData = { 
        ...session, 
        ...config
      };
      sessionStore.set(sessionId, updatedSession);
      return;
    },
  }),

  deleteSession: defineAction({
    input: z.object({
      sessionId: SessionIdSchema,
    }),
    handler: async ({ sessionId }) => {
      if (!sessionStore.has(sessionId)) throw standardNotFoundActionError();
      const session = sessionStore.get(sessionId) as SessionData;
      if (session.isActive) {
        throw new ActionError({
          code: 'FORBIDDEN',
          message: 'Cannot delete an active session',
        });
      }
      sessionStore.delete(sessionId);
      return;
    },
  }),

  getUrlHistory: defineAction({
    handler: async () => {
      return { urls: urlHistory.getAllSorted() };
    },
  }),

  addUrlsToHistory: defineAction({
    input: z.object({
      urls: UrlEntrySchema.array(),
    }),
    handler: async ({ urls }) => {
      urls.forEach(entry => urlHistory.add(entry.url, entry.timestamp));
      return;
    },
  }),
};