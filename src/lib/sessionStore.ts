import { z } from 'astro:schema';
import { map } from 'nanostores';
import { urlHistory } from './urlHistoryStore';

// ====================================================================================

// Schema definitions
export const SessionIdSchema = z.string().uuid();
export type SessionId = z.infer<typeof SessionIdSchema>;
export const ConfigSchema = z.object({
  iframeUrl: z.string().url(),
});
export const ActivitySchema = z.object({
  createdAt: z.number(), // Timestamp of session creation
  lastActiveAt: z.number(), // Timestamp of last activity
  isActive: z.boolean(), // Whether the session is currently active
});
export type Config = z.infer<typeof ConfigSchema>;
export const SessionDataSchema = ConfigSchema.merge(ActivitySchema);
export type SessionData = z.infer<typeof SessionDataSchema>;

// =====================================================================================

// Create a nanostore map for session configs
const $sessions = map<Record<SessionId, SessionData>>({});
const SESSION_INACTIVE_TIMEOUT = 30 * 1000;
export const DEFAULT_IFRAME_URL = 'https://default.url';

// Create wrapper functions to interact with the store and add logging
export const sessionStore = {
  get: (sessionId: SessionId): SessionData | undefined => {
    const sessions = $sessions.get();
    return sessions[sessionId];
  },

  set: (sessionId: SessionId, session: SessionData): void => {
    // console.log(`[SessionStore] Setting session for ${sessionId}:`, session);
    $sessions.setKey(sessionId, session);
  },

  setConfig: (sessionId: SessionId, config: Config): boolean => {
    // console.log(`[SessionStore] Setting config for session ${sessionId}:`, config);
    // merge with existing session if it exists
    let existing = sessionStore.get(sessionId);
    if (!existing) {
      console.warn(`[SessionStore] Session ${sessionId} not found, creating new session`);
    }
    $sessions.setKey(sessionId, { ...(existing ?? sessionStore.getDefaultSession()), ...config });
    return !!existing;
  },

  getDefaultSession: (): SessionData => {
    const now = Date.now();
    return {
      iframeUrl: DEFAULT_IFRAME_URL,
      createdAt: now,
      lastActiveAt: now,
      isActive: true,
    };
  },

  create: (sessionId: SessionId): boolean => {
    if (sessionStore.has(sessionId)) {
      console.warn(`[SessionStore] Session ${sessionId} already exists`);
      return false;
    }
    console.log(`[SessionStore] Creating session ${sessionId}`);
    sessionStore.set(sessionId, sessionStore.getDefaultSession());
    return true;
  },

  has: (sessionId: SessionId): boolean => {
    const configs = $sessions.get();
    return sessionId in configs;
  },

  delete: (sessionId: SessionId): boolean => {
    const existed = sessionStore.has(sessionId);
    if (existed) {
      console.log(`[SessionStore] Deleting session ${sessionId}`);
      // @ts-ignore: nanostores typings are incorrect, doesn't allow undefined
      $sessions.setKey(sessionId, undefined);
    }
    return existed;
  },

  // For debugging
  getAll: () => $sessions.get(),

  // Mark a session as active and update last activity
  markActive: (sessionId: SessionId): boolean => {
    const session = sessionStore.get(sessionId);
    if (session) {
      sessionStore.set(sessionId, {
        ...session,
        isActive: true,
        lastActiveAt: Date.now(),
      });
    }
    return !!session;
  },

  // Mark a session as inactive
  markInactive: (sessionId: SessionId): boolean => {
    const session = sessionStore.get(sessionId);
    if (session) {
      sessionStore.set(sessionId, {
        ...session,
        isActive: false,
        lastActiveAt: Date.now(),
      });
    }
    return !!session;
  },

  // Get all sessions sorted by activity (active first, then by lastActive timestamp)
  getAllSorted: () => {
    const configs = sessionStore.getAll();
    return Object.entries(configs).sort(([, sessionA], [, sessionB]) => {
      // First sort by active status (active first)
      if (sessionA.isActive && !sessionB.isActive) return -1;
      if (!sessionA.isActive && sessionB.isActive) return 1;

      // Then sort by last active timestamp (most recent first)
      const timeA = sessionA.lastActiveAt || 0;
      const timeB = sessionB.lastActiveAt || 0;
      return timeB - timeA;
    });
  },

  // Check for inactive sessions
  cleanupInactiveSessions: () => {
    const now = Date.now();
    const sessions = sessionStore.getAll();

    Object.entries(sessions).forEach(([sessionId, session]) => {
      // If last activity is older than the timeout and session is marked active
      if (
        session.isActive &&
        session.lastActiveAt &&
        now - session.lastActiveAt > SESSION_INACTIVE_TIMEOUT
      ) {
        console.log(`[SessionStore] Auto marking session ${sessionId} as inactive due to timeout`);
        sessionStore.markInactive(sessionId);
      }
    });
  },
};

// =====================================================================================

// Subscribe to store changes for logging
$sessions.listen((state, prevState, changed) => {
  if (changed && state[changed]) {
    // console.log(`[SessionStore] Session '${changed}' updated:`, state[changed]);

    // Check if this was a config change
    const prev = prevState[changed];
    const current = state[changed];

    if (prev && current) {
      if (prev.iframeUrl !== current.iframeUrl) {
        console.log(`[SessionStore] Iframe URL changed for session ${changed}:`, {
          from: prev.iframeUrl,
          to: current.iframeUrl,
        });

        // Add the new URL to the history
        urlHistory.add(current.iframeUrl);
      }
      if (prev.isActive !== current.isActive) {
        console.log(
          `[SessionStore] Session ${changed} is now ${current.isActive ? 'active' : 'inactive'}!`
        );
      }
    }
  } else if (changed && !state[changed]) {
    console.log(`[SessionStore] Session '${changed}' was deleted`);
  }
});

// Periodically check for inactive sessions
if (typeof setInterval !== 'undefined') {
  setInterval(() => sessionStore.cleanupInactiveSessions(), SESSION_INACTIVE_TIMEOUT / 2);
} else {
  console.warn('[SessionStore] setInterval not available, skipping periodic cleanup');
}
