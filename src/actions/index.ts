import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { randomUUID } from 'crypto';
import { ConfigSchema, SessionIdSchema, TaskIdSchema, TaskNameSchema, UrlEntrySchema, type SessionData } from '../lib/schemas';
import { sessionStore } from '@/lib/nanostores/sessionStore';
import { urlHistory } from '../lib/nanostores/urlHistoryStore';
import { taskQueue } from '../lib/nanostores/taskQueue';

function standardNotFoundActionError() {
  console.error('Session not found in sessionStore');
  return new ActionError({
    code: 'NOT_FOUND',
    message: 'Session not found',
  });
}

export const server = {
  // == Session Actions ==

  getAllSessions: defineAction({
    handler: () => {
      const sessions = sessionStore.getAllSorted();
      return { sessions };
    },
  }),

  getSession: defineAction({
    input: z.object({
      sessionId: SessionIdSchema.optional(),
    }),
    handler: ({ sessionId }) => {
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
        session: session as SessionData,
      };
    },
  }),

  // Heartbeat endpoint to keep a session marked as active and return current config
  heartbeat: defineAction({
    input: z.object({
      sessionId: SessionIdSchema,
    }),
    handler: ({ sessionId }) => {
      if (!sessionStore.has(sessionId)) throw standardNotFoundActionError();

      // Mark the session as active
      sessionStore.markActive(sessionId);

      // Return the current session config to allow the client to check for updates
      const session = sessionStore.get(sessionId) as SessionData;

      // Return any outstanding tasks past their scheduled time
      const tasks = taskQueue.getSessionsTasks(sessionId, false, false);

      return { session, tasks };
    },
  }),

  // Mark a session as inactive
  markInactive: defineAction({
    input: z.object({
      sessionId: SessionIdSchema,
    }),
    handler: ({ sessionId }) => {
      if (!sessionStore.has(sessionId)) throw standardNotFoundActionError();
      sessionStore.markInactive(sessionId);
      return;
    },
  }),

  checkActive: defineAction({
    input: z.object({
      sessionId: SessionIdSchema,
    }),
    handler: ({ sessionId }) => {
      const session = sessionStore.get(sessionId);
      if (!session) throw standardNotFoundActionError();
      return {
        isActive: session.isActive,
        lastActiveAt: session.lastActiveAt,
      };
    },
  }),

  updateSessionForm: defineAction({
    accept: 'form',
    input: ConfigSchema.extend({
      sessionId: SessionIdSchema,
    }),
    handler: ({ sessionId, ...config }) => {
      const session = sessionStore.get(sessionId);

      if (!session) throw standardNotFoundActionError();

      const updatedSession: SessionData = {
        ...session,
        ...config,
      };
      sessionStore.set(sessionId, updatedSession);
      return;
    },
  }),

  deleteSession: defineAction({
    input: z.object({
      sessionId: SessionIdSchema,
    }),
    handler: ({ sessionId }) => {
      const session = sessionStore.get(sessionId);
      if (!session) throw standardNotFoundActionError();
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

  // == Task Queue Actions ==

  getUrlHistory: defineAction({
    handler: () => ({ urls: urlHistory.getAllSorted() }),
  }),

  addUrlsToHistory: defineAction({
    input: z.object({
      urls: UrlEntrySchema.array(),
    }),
    handler: ({ urls }) => {
      urls.forEach((entry) => urlHistory.add(entry.url, entry.timestamp));
      return;
    },
  }),

  // == Task Actions ==

  getTasksOverdue: defineAction({
    input: z.object({
      sessionId: SessionIdSchema,
    }),
    handler: ({ sessionId }) => ({
      tasks: taskQueue.getSessionsTasks(sessionId, false, false),
    }),
  }),

  markTaskCompleted: defineAction({
    input: z.object({
      taskId: TaskIdSchema,
    }),
    handler: ({ taskId }) => {
      const task = taskQueue.get(taskId);
      if (!task) throw standardNotFoundActionError();
      taskQueue.markCompleted(taskId);
      return;
    },
  }),

  createTask: defineAction({
    input: z.object({
      sessionId: SessionIdSchema,
      task: TaskNameSchema,
      scheduledAt: z.number().optional(),
    }),
    handler: ({ sessionId, task, scheduledAt = Date.now() }) => {
      if (!sessionStore.has(sessionId)) throw standardNotFoundActionError();
      taskQueue.create(sessionId, task, scheduledAt);
      return;
    },
  }),
};
