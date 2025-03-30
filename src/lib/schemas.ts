import { z } from 'astro:schema';


// ===============================================================================

export const SESSION_INACTIVE_TIMEOUT = 30 * 1000;
export const DEFAULT_IFRAME_URL = 'https://default.url';

export const SessionIdSchema = z.string().uuid();
export type SessionId = z.infer<typeof SessionIdSchema>;
export const ConfigSchema = z.object({
  iframeUrl: z.string().url().default(DEFAULT_IFRAME_URL), // URL of the iframe to be loaded
});
export const ActivitySchema = z.object({
  createdAt: z.number(), // Timestamp of session creation
  lastActiveAt: z.number(), // Timestamp of last activity
  isActive: z.boolean(), // Whether the session is currently active
});
export type Config = z.infer<typeof ConfigSchema>;
export const SessionDataSchema = ConfigSchema.merge(ActivitySchema);
export type SessionData = z.infer<typeof SessionDataSchema>;

// ===============================================================================

export const UrlEntrySchema = z.object({
  url: z.string().url(), // URL string
  timestamp: z.number(), // Timestamp of when the URL was added
});
export type UrlEntry = z.infer<typeof UrlEntrySchema>;

// ===============================================================================

export const TaskIdSchema = z.string().uuid();
export const TaskSchema = z
  .object({
    id: TaskIdSchema,
    sessionId: SessionIdSchema, // Session ID to which the task belongs
    scheduledAt: z.number(), // Timestamp of when the task is scheduled
    completed: z.boolean().default(false), // Whether the task is completed
  })
  .and(
    z.union([
      z.object({
        task: z.literal("refresh"),
      }),
      z.object({
        task: z.literal("fullscreen"), // not implemented
      }),
      z.object({
        task: z.literal("screenshot"), // not implemented
      }),
    ])
  );
export type Task = z.infer<typeof TaskSchema>;
export const TaskNameSchema = z.enum(["refresh", "fullscreen", "screenshot"]); // manual enum
export type TaskName = z.infer<typeof TaskNameSchema>;