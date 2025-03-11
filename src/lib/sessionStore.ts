import { z } from 'astro:schema';
import { map } from 'nanostores';

// Schema definitions
export const SessionIdSchema = z.string();
export const ConfigSchema = z.object({
  iframeUrl: z.string().url(),
  // lastActive: z.number().optional(),
});
export type Config = z.infer<typeof ConfigSchema>;

// Default configuration
export const defaultConfig: Config = {
  iframeUrl: 'https://default.url',
};

// Create a nanostore map for session configs
export const $sessionConfigs = map<Record<string, Config>>({});

// Create wrapper functions to interact with the store and add logging
export const sessionStore = {
  get: (sessionId: string): Config | undefined => {
    const configs = $sessionConfigs.get();
    return configs[sessionId];
  },
  
  set: (sessionId: string, config: Config): void => {
    console.log(`[SessionStore] Setting config for session ${sessionId}:`, config);
    $sessionConfigs.setKey(sessionId, config);
  },
  
  has: (sessionId: string): boolean => {
    const configs = $sessionConfigs.get();
    return sessionId in configs;
  },
  
  delete: (sessionId: string): boolean => {
    const existed = sessionStore.has(sessionId);
    if (existed) {
      console.log(`[SessionStore] Deleting config for session ${sessionId}`);
      // @ts-ignore: nanostores typings are incorrect, doesn't allow undefined
      $sessionConfigs.setKey(sessionId, undefined);
    }
    return existed;
  },
  
  // For debugging
  getAll: () => $sessionConfigs.get()
};

// Subscribe to store changes for logging
$sessionConfigs.listen((value, prevValue, changed) => {
  console.log(`[SessionStore] Store '${changed}' changed to:`, value[changed]);
});