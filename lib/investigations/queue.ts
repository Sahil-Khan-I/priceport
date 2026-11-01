/** Bounded concurrency queue — TinyFish standard account limit is 2 concurrent agents. */

type QueueItem = {
  fn: () => unknown | Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

export function createQueue(limit = 2) {
  let active = 0;
  const waiting: QueueItem[] = [];

  const pump = () => {
    while (active < limit && waiting.length > 0) {
      const next = waiting.shift();
      if (!next) break;
      active += 1;
      Promise.resolve()
        .then(next.fn)
        .then(next.resolve, next.reject)
        .finally(() => {
          active -= 1;
          pump();
        });
    }
  };

  return {
    push(fn: () => unknown | Promise<unknown>) {
      return new Promise((resolve, reject) => {
        waiting.push({ fn, resolve, reject });
        pump();
      });
    },
    stats() {
      return { active, waiting: waiting.length, limit };
    },
  };
}

export const agentQueue = createQueue(2);
