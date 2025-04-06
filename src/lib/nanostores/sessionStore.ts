import { map } from 'nanostores';
import { urlHistory } from './urlHistoryStore';
import {
  SessionDataSchema,
  type SessionData,
  type SessionId,
  type Config,
  DEFAULT_IFRAME_URL,
  SESSION_INACTIVE_TIMEOUT,
} from '../schemas';
import { getPreloadforMapStore, getWriteListener, get } from './adaptors/redis';

// =====================================================================================

// Create a nanostore map for session configs
const $sessionsMeta = {
  key: 'sessions:',
  encode: (value: SessionData) => JSON.stringify(value),
  decode: (value: string) => {
    const parsed = JSON.parse(value);
    return SessionDataSchema.parse(parsed);
  },
};
const $sessionsPreload = await getPreloadforMapStore($sessionsMeta.key, $sessionsMeta.decode);
const $sessions = map<Record<SessionId, SessionData>>($sessionsPreload ?? {});
$sessions.listen(getWriteListener($sessionsMeta.key, $sessionsMeta.encode));

// ======================================================================================

// Create wrapper functions to interact with the store and add logging
export const sessionStore = {
  get: (sessionId: SessionId): SessionData | undefined => {
    const sessions = $sessions.get();
    if (sessionId in sessions) {
      return sessions[sessionId];
    }
  },

  set: (sessionId: SessionId, session: SessionData): void => {
    // console.log(`[SessionStore] Setting session for ${sessionId}:`, session);
    $sessions.setKey(sessionId, session);
  },

  setConfig: (sessionId: SessionId, config: Config): boolean => {
    // console.log(`[SessionStore] Setting config for session ${sessionId}:`, config);
    // merge with existing session if it exists
    const existing = sessionStore.get(sessionId);
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
    const found = sessionStore.get(sessionId);
    // console.info("[SessionStore] Checking if session exists:", sessionId, Object.keys(configs)); //DEBUG
    return !!found;
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
  getAllLocal: () => $sessions.get(),

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
    const configs = sessionStore.getAllLocal();
    return Object.entries(configs).sort(([, sessionA], [, sessionB]) => {
      // First sort by active status (active first)
      if (sessionA.isActive && !sessionB.isActive) return -1;
      if (!sessionA.isActive && sessionB.isActive) return 1;

      // Then sort by createdAt timestamp (most recent first)
      return sessionB.createdAt - sessionA.createdAt;
    });
  },

  // Check for inactive sessions
  cleanupInactiveSessions: () => {
    const now = Date.now();
    const sessions = sessionStore.getAllLocal();

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

  // Sync the session store with Redis
  pullSync: async () => {
    const presyncStore = sessionStore.getAllLocal();
    const upstreamSessions = await get($sessionsMeta.key, $sessionsMeta.decode);
    if (!upstreamSessions) {
      console.warn(`[SessionStore] No sessions found in Redis`);
      return;
    }
    Object.entries(upstreamSessions).forEach(([sessionId, session]) => {
      console.log(`[SessionStore] Syncing session ${sessionId}:`, session);
      sessionStore.set(sessionId, session);
    });
    Object.entries(presyncStore).forEach(([sessionId, _]) => {
      if (!(sessionId in upstreamSessions)) {
        console.log(`[SessionStore] Deleting session ${sessionId} from local store`);
        sessionStore.delete(sessionId);
      }
    });
  },

  // Subscribe to changes to the URL
  subscribeToUrlChanges: (sessionId: SessionId, callback: (session: SessionData) => void) => {
    return $sessions.subscribe((state, prevState, changedKey) => {
      if (changedKey === sessionId) {
        const session = state[sessionId];
        if (session && session.iframeUrl !== (prevState?.[sessionId]?.iframeUrl ?? null)) {
          callback(session);
        }
      }
    });
  },

  // Subscribe to changes in session activity status
  subscribeToActivityChanges: (sessionId: SessionId, callback: (session: SessionData) => void) => {
    return $sessions.subscribe((state, prevState, changedKey) => {
      if (changedKey === sessionId) {
        const session = state[sessionId];
        const prevSession = prevState?.[sessionId];

        // Call callback if isActive changed or lastActiveAt changed
        if (
          session &&
          prevSession &&
          (session.isActive !== prevSession.isActive ||
            session.lastActiveAt !== prevSession.lastActiveAt)
        ) {
          callback(session);
        }
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
