import { createClient } from "redis";

import { REDIS_URL } from "astro:env/server";

const redis = createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      // Retry with exponential backoff
      return Math.min(retries * 50, 2000);
    }
  }
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
})

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err);
});

await redis.connect();

export default redis;