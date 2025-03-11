import { z } from 'astro:schema';
import { map } from 'nanostores';

// Schema definitions
export const SessionIdSchema = z.string();
export const ConfigSchema = z.object({
  iframeUrl: z.string().url(),
});
export const ActivitySchema = z.object({
  lastActive: z.number().optional(), // Timestamp of last activity
  isActive: z.boolean().optional(), // Whether the session is currently active
});
export type Config = z.infer<typeof ConfigSchema>;
export const SessionSchema = ConfigSchema.merge(ActivitySchema);
export type Session = z.infer<typeof SessionSchema>;

// Default configuration
export const getDefaultSession = (): Session => ({
  iframeUrl: 'https://default.url',
  lastActive: Date.now(),
  isActive: true,
});

// Timeout for inactivity (in milliseconds)
export const SESSION_INACTIVE_TIMEOUT = 30 * 1000;

// Create a nanostore map for session configs
export const $sessions = map<Record<string, Session>>({});

// Create wrapper functions to interact with the store and add logging
export const sessionStore = {
  get: (sessionId: string): Session | undefined => {
    const sessions = $sessions.get();
    return sessions[sessionId];
  },

  set: (sessionId: string, session: Session): void => {
    console.log(`[SessionStore] Setting session for ${sessionId}:`, session);
    $sessions.setKey(sessionId, session);
  },
  
  setConfig: (sessionId: string, config: Config): void => {
    console.log(`[SessionStore] Setting config for session ${sessionId}:`, config);
    // merge with existing session if it exists
    const existing = sessionStore.get(sessionId);
    $sessions.setKey(sessionId, { ...existing, ...config });
  },
  
  has: (sessionId: string): boolean => {
    const configs = $sessions.get();
    return sessionId in configs;
  },
  
  delete: (sessionId: string): boolean => {
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
  markActive: (sessionId: string): void => {
    const session = sessionStore.get(sessionId);
    if (session) {
      sessionStore.set(sessionId, {
        ...session,
        isActive: true,
        lastActive: Date.now(),
      });
    }
  },
  
  // Mark a session as inactive
  markInactive: (sessionId: string): void => {
    const session = sessionStore.get(sessionId);
    if (session) {
      sessionStore.set(sessionId, {
        ...session,
        isActive: false,
        lastActive: Date.now(),
      });
    }
  },
  
  // Get all sessions sorted by activity (active first, then by lastActive timestamp)
  getAllSorted: () => {
    const configs = sessionStore.getAll();
    return Object.entries(configs).sort(([, sessionA], [, sessionB]) => {
      // First sort by active status (active first)
      if (sessionA.isActive && !sessionB.isActive) return -1;
      if (!sessionA.isActive && sessionB.isActive) return 1;
      
      // Then sort by last active timestamp (most recent first)
      const timeA = sessionA.lastActive || 0;
      const timeB = sessionB.lastActive || 0;
      return timeB - timeA;
    });
  },
  
  // Check for inactive sessions
  cleanupInactiveSessions: () => {
    const now = Date.now();
    const sessions = sessionStore.getAll();
    
    Object.entries(sessions).forEach(([sessionId, session]) => {
      // If last activity is older than the timeout and session is marked active
      if (session.isActive && session.lastActive && 
          (now - session.lastActive > SESSION_INACTIVE_TIMEOUT)) {
        console.log(`[SessionStore] Auto marking session ${sessionId} as inactive due to timeout`);
        sessionStore.markInactive(sessionId);
      }
    });
  }
};

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
          to: current.iframeUrl
        });
      }
      if (prev.isActive !== current.isActive) {
        console.log(`[SessionStore] Session ${changed} is now ${current.isActive ? 'active' : 'inactive'}!`);
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