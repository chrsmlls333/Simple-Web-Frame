import { map } from "nanostores";
import { z } from "astro:schema";
import { UrlEntrySchema, type UrlEntry } from "../schemas";
import { getPreloadforMapStore, getWriteListener } from "./adaptors/redis";

// =====================================================================================

// Map of URL entries by URL
const $urlHistoryMeta = {
  key: 'urlhistory:',
  encode: (value: UrlEntry) => JSON.stringify(value),
  decode: (value: string) => {
    const parsed = JSON.parse(value);
    return UrlEntrySchema.parse(parsed);
  }
};
const $urlHistoryPreload = await getPreloadforMapStore($urlHistoryMeta.key, $urlHistoryMeta.decode);
const $urlHistory = map<Record<string, UrlEntry>>($urlHistoryPreload ?? {}); 
$urlHistory.listen(getWriteListener($urlHistoryMeta.key, $urlHistoryMeta.encode));

// ========================================================================================


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
$urlHistory.listen((_history, _prevHistory, changedKey) => {
  if (changedKey) {
    console.log(`[UrlHistory] Added URL:`, changedKey);
  }
});
