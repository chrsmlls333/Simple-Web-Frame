import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { randomUUID } from 'crypto';
import { ConfigSchema, defaultConfig, sessionStore, SessionIdSchema } from '../lib/sessionStore';

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
      if (!sessionStore.has(sessionId)) {
        sessionStore.set(sessionId, { ...defaultConfig });
      }

      // Ensure the config is never undefined
      const config = sessionStore.get(sessionId) || { ...defaultConfig };

      return { 
        success: true, 
        sessionId, 
        config 
      };
    },
  }),
  endSession: defineAction({
    input: z.object({
      sessionId: SessionIdSchema,
    }),
    handler: async ({ sessionId }) => {
      const existed = sessionStore.delete(sessionId);
      return { success: existed };
    },
  }),
  updateSessionForm: defineAction({
    accept: 'form',
    input: ConfigSchema.extend({
      sessionId: SessionIdSchema,
    }),
    handler: async ({ sessionId, iframeUrl }) => {
      const config = sessionStore.get(sessionId);
      if (config) {
        const updatedConfig = { ...config, iframeUrl };
        sessionStore.set(sessionId, updatedConfig);
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