import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { randomUUID } from 'crypto';
import { ConfigSchema, sessionStore, SessionIdSchema, getDefaultSession } from '../lib/sessionStore';

export const server = {
  getSession: defineAction({
    input: z.object({
      sessionId: SessionIdSchema.optional(),
    }),
    handler: async ({ sessionId }) => {
      // Generate a new session ID if not provided
      if (!sessionId) {
        sessionId = randomUUID();
      }

      // If this is a new session ID, create a default config
      const sessionDefaults = getDefaultSession();
      if (!sessionStore.has(sessionId)) {
        sessionStore.set(sessionId, sessionDefaults);
      } else {
        // Mark existing session as active
        sessionStore.markActive(sessionId);
      }

      // Ensure the config is never undefined
      const session = sessionStore.get(sessionId) || sessionDefaults;

      return { 
        success: true, 
        sessionId, 
        session
      };
    },
  }),
  
  // Heartbeat endpoint to keep a session marked as active and return current config
  heartbeat: defineAction({
    input: z.object({
      sessionId: SessionIdSchema,
    }),
    handler: async ({ sessionId }) => {
      if (sessionStore.has(sessionId)) {
        // Mark the session as active
        sessionStore.markActive(sessionId);
        
        // Return the current session config to allow the client to check for updates
        const session = sessionStore.get(sessionId);
        return { success: true, session };
      }
      return { success: false, error: "Session not found" };
    },
  }),
  
  // Mark a session as inactive
  markInactive: defineAction({
    input: z.object({
      sessionId: SessionIdSchema,
    }),
    handler: async ({ sessionId }) => {
      if (sessionStore.has(sessionId)) {
        sessionStore.markInactive(sessionId);
        return { success: true };
      }
      return { success: false, error: "Session not found" };
    },
  }),
  
  updateSessionForm: defineAction({
    accept: 'form',
    input: ConfigSchema.extend({
      sessionId: SessionIdSchema,
    }),
    handler: async ({ sessionId, iframeUrl }) => {
      const session = sessionStore.get(sessionId);
      if (session) {
        const updatedSession = { 
          ...session, 
          iframeUrl,
          lastActive: session.lastActive || Date.now() 
        };
        sessionStore.set(sessionId, updatedSession);
        return { success: true };
      }
      return { success: false };
    },
  }),
  
  deleteSessionForm: defineAction({
    accept: 'form',
    input: z.object({
      sessionId: SessionIdSchema,
    }),
    handler: async ({ sessionId }) => {
      const existed = sessionStore.delete(sessionId);
      return { success: existed };
    },
  }),
};