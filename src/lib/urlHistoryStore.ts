import { z } from "astro:schema";
import { map } from "nanostores";

export const UrlEntrySchema = z.object({
  url: z.string().url(),
  timestamp: z.number(),
});
export type UrlEntry = z.infer<typeof UrlEntrySchema>;


const $urlHistory = map<Record<string, UrlEntry>>({}); // Map of URL entries by URL

export const urlHistory = {
  get: (url: string): UrlEntry | undefined => {
    return $urlHistory.get()[url];
  },

  add: (url: string, timestamp?: number): boolean => {
    try {
      const _url = z.string().url().parse(url); 
      $urlHistory.setKey(_url, { 
        url: _url, 
        timestamp: timestamp ?? Date.now() 
      });
      return true;
    } catch (e: any) {
      console.error(`Failed to add URL to history: ${e.message}`);
      return false;
    }
  },

  getAll: (): UrlEntry[] => {
    return Object.values($urlHistory.get());
  },

  getAllSorted: (): UrlEntry[] => {
    return urlHistory.getAll().sort((a, b) => b.timestamp - a.timestamp);
  },

  clear: (): void => {
    $urlHistory.set({});
  },

  has: (url: string): boolean => {
    const history = $urlHistory.get();
    return url in history;
  },

  remove: (url: string): boolean => {
    if (!urlHistory.has(url)) return false;
    // @ts-ignore - nanostores typings are incorrect
    $urlHistory.setKey(url, undefined);
    return true;
  },
};

// =====================================================================================

// listener for new Urls being added
$urlHistory.listen((history, prevHistory, changedKey) => {
  if (changedKey) {
    console.log(`[UrlHistory] Added URL:`, changedKey);
  }
});
