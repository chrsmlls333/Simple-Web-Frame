import { z } from "astro:schema";
import { SessionIdSchema, type SessionId } from "./sessionStore";
import { atom } from "nanostores";
import { randomUUID } from "crypto";


export const TaskIdSchema = z.string().uuid();
export const TaskSchema = z
  .object({
    id: TaskIdSchema,
    sessionId: SessionIdSchema,
    scheduledAt: z.number(),
    completed: z.boolean().default(false),
  })
  .and(
    z.union([
      z.object({
        task: z.literal("refresh"),
      }),
      z.object({
        task: z.literal("fullscreen"),
      }),
      z.object({
        task: z.literal("screenshot"), // not implemented
      }),
    ])
  );
export type Task = z.infer<typeof TaskSchema>;
export const TaskNameSchema = z.enum(["refresh", "fullscreen", "screenshot"]); // manual
export type TaskName = z.infer<typeof TaskNameSchema>;

// ================================================================

const $queue = atom<Task[]>([]);

export const taskQueue = {
  getAll: () => $queue.get(),

  get: (taskId: string): Task | undefined => {
    return $queue.get().find((task) => task.id === taskId);
  },

  getSessionsTasks: (sessionId: SessionId, includeFuture = false, includeCompleted = false): Task[] => {
    const now = Date.now();
    return $queue
      .get()
      .filter(
        (task) =>
          task.sessionId === sessionId &&
          (includeFuture || task.scheduledAt <= now) &&
          (includeCompleted || !task.completed)
      )
      .sort((a, b) => a.scheduledAt - b.scheduledAt);
  },

  create: (sessionId: SessionId | 'all', taskName: Task['task'], scheduledAt = Date.now(), other?: Partial<Task> ): Task[] => {
    const sessionIds: SessionId[] = [];
    if (sessionId === 'all') {
      // Add task for all sessions
      sessionIds.push(...new Set($queue.get().map((task) => task.sessionId)));
    } else {
      sessionIds.push(sessionId);
    }
    const newTasks = sessionIds.map((sessionId) =>
      TaskSchema.parse({
        id: randomUUID(),
        sessionId,
        scheduledAt,
        task: taskName,
        ...other,
      })
    );
    $queue.set([...$queue.get(), ...newTasks]);
    return newTasks;
  },

  add: (task: Task) => {
    $queue.set([...$queue.get(), task]);
  },

  markCompleted: (taskId: string): Boolean => {
    // check if exists
    const queue = $queue.get();
    const task = queue.find((task) => task.id === taskId);
    if (!task) return false;
    $queue.set($queue.get().map(t => t.id === taskId ? {
      ...t,
      completed: true,
    } : t));
    return true;
  },

  cleanupCompleted: () => {
    const queue = $queue.get();
    if (queue.length === 0) return;
    $queue.set(queue.filter((task) => !task.completed));
  },
};

// ================================================================

// Notify about changes to the task queue
$queue.listen((tasks, prevTasks) => {
  console.log(tasks);
  
  // Check for completed tasks
  const completedTasks = tasks.filter((task) => !prevTasks.find((ptask) => ptask.id === task.id && !ptask.completed));
  for (const task of completedTasks) {
    console.log(`[TaskQueue] Task ${task.id} completed`);
  }

  // Check for new tasks
  const newTasks = tasks.filter((task) => !prevTasks.find((t) => t.id === task.id));
  for (const task of newTasks) {
    console.log(`[TaskQueue] New task ${task.id} for session ${task.sessionId}`);
  }
});

// Periodically check for completed tasks and remove them
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    taskQueue.cleanupCompleted();
  }, 10000); // Check every second
} else {
  console.warn(`[TaskQueue] setInterval not available in this environment`);
}
