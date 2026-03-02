export type Task = () => Promise<void>;

export function createLaneQueue() {
  const queues = new Map<string, Task[]>();
  const running = new Set<string>();

  async function enqueue(sessionKey: string, task: Task): Promise<void> {
    const queue = queues.get(sessionKey) ?? [];
    queues.set(sessionKey, queue);
    queue.push(task);

    if (!running.has(sessionKey)) {
      running.add(sessionKey);
      try {
        while (queue.length > 0) {
          const next = queue.shift()!;
          await next();
        }
      } finally {
        running.delete(sessionKey);
        if (queue.length === 0) queues.delete(sessionKey);
      }
    }
  }

  return { enqueue };
}
