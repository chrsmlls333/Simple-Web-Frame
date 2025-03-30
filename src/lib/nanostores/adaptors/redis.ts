import redis from '../../redis';
import { type MapStore } from 'nanostores';

export const NANOSTORE_REDIS_PREFIX = 'nanostore:';


const keybuilder = (storeKey: string, itemKey: string) => {
  return `${NANOSTORE_REDIS_PREFIX}${storeKey}${itemKey}`;
};

export async function listKeys(storeKey: string): Promise<string[]> {
  const combinedPrefix = `${NANOSTORE_REDIS_PREFIX}${storeKey}`;
  const keys = await redis.keys(`${combinedPrefix}*`);
  return keys.map((key) => key.replace(`${combinedPrefix}`, ''));
}

export async function getKey<T>(
  storeKey: string,
  itemKey = '',
  decode: (value: string) => T = JSON.parse
): Promise<T | undefined> {
  const key = keybuilder(storeKey, itemKey);
  try {
    const value = await redis.get(key);
    console.log(`[Redis] Fetched value for ${key}:`, value);
    if (value) {
      return decode(value);
    }
  } catch (error) {
    console.error(`[Redis] Error getting key ${key}:`, error);
  }
  return undefined;
}

export async function get<T>(
  storeKey: string,
  decode: (value: string) => T = JSON.parse
): Promise<Record<string, T>> {
  try {
    const keys = await listKeys(storeKey);
    if (keys.length === 0) {
      return {};
    }
    const values = await Promise.all(keys.map((key) => getKey(storeKey, key, decode)));
    return Object.fromEntries(
      keys.map((key, index) => [key, values[index]]).filter(([_, value]) => value !== undefined)
    );
  } catch (error) {
    console.error(`[Redis] Error getting all keys for ${storeKey}:`, error);
    return {};
  }
}

export async function getPreloadforMapStore<T>(storeKey: string, decode: (value: string) => T = JSON.parse): Promise<Record<string, T>> {
  const data = await get(storeKey, decode);
  console.log(`[Redis] Number of pre-existing keys for '${storeKey.replaceAll(':','')}':`, Object.keys(data).length);
  return data;
}

export async function setKey(
  storeKey: string,
  itemKey = '',
  value: any,
  encode: (value: any) => string = JSON.stringify
): Promise<void> {
  const key = keybuilder(storeKey, itemKey);
  try {
    await redis.set(key, encode(value));
    // console.log(`[Redis] Set value for ${key}:`, value);
  } catch (error) {
    console.error(`[Redis] Error setting key ${key}:`, error);
  }
}

export async function set(
  storeKey: string,
  value: Record<string, any>,
  encode = JSON.stringify
): Promise<void> {
  const keys = Object.keys(value);
  await Promise.all(keys.map((key) => setKey(storeKey, key, value[key], encode)));
}

export async function delKey(storeKey: string, itemKey = ''): Promise<void> {
  const key = keybuilder(storeKey, itemKey);
  try {
    await redis.del(key);
    console.log(`[Redis] Deleted key ${key}`);
  } catch (error) {
    console.error(`[Redis] Error deleting key ${key}:`, error);
  }
}

export async function del(storeKey: string): Promise<void> {
  const keys = await listKeys(storeKey);
  await Promise.all(keys.map((key) => delKey(storeKey, key)));
}

export function getWriteListener(
  storeKey: string,
  encode = JSON.stringify
): Parameters<MapStore['subscribe']>[0] {
  return (value, oldValue, _changedKey) => {
    const changedKey = _changedKey as string;

    // Large Changes

    if (oldValue && !value) {
      console.log(`[Redis] Deleted all keys in ${storeKey}`);
      del(storeKey);
      return;
    }

    if (changedKey === undefined) {
      console.log(`[Redis] Changed all keys in ${storeKey}:`, value);
      for (const key in value) {
        setKey(storeKey, key, value[key], encode);
      }
      return;
    }

    // Small Changes

    if (changedKey) {
      if (value[changedKey] === undefined) {
        console.log(`[Redis] Deleted key ${changedKey} in ${storeKey}`);
        delKey(storeKey, changedKey);
        return;
      }
      if (value[changedKey] !== oldValue[changedKey]) {
        // console.log(`[Redis] Changed key ${changedKey} in ${storeKey}:`, value[changedKey]);
        setKey(storeKey, changedKey, value[changedKey], encode);
        return;
      }
    } 

    console.warn(`[Redis] No changes detected for ${storeKey}`);
  };
}
