/**
 * Fila de requisições com controle de concorrência e rate-limiting
 * para evitar rajadas e bloqueios por scraping nos portais imobiliários.
 */

type Task<T> = () => Promise<T>;

interface QueueItem<T> {
  task: Task<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export class TaskQueue {
  private queue: QueueItem<unknown>[] = [];
  private activeCount = 0;
  private readonly concurrency: number;
  private readonly intervalMs: number;
  private lastExecutedAt = 0;

  constructor(options: { concurrency?: number; intervalMs?: number } = {}) {
    this.concurrency = options.concurrency ?? 1;
    this.intervalMs = options.intervalMs ?? 1500;
  }

  public add<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task: task as Task<unknown>,
        resolve: resolve as (val: unknown) => void,
        reject,
      });
      this.next();
    });
  }

  private async next(): Promise<void> {
    if (this.activeCount >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const now = Date.now();
    const timeSinceLast = now - this.lastExecutedAt;
    if (timeSinceLast < this.intervalMs) {
      const waitTime = this.intervalMs - timeSinceLast;
      setTimeout(() => this.next(), waitTime);
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.activeCount++;
    this.lastExecutedAt = Date.now();

    try {
      const result = await item.task();
      item.resolve(result);
    } catch (err) {
      item.reject(err);
    } finally {
      this.activeCount--;
      this.next();
    }
  }

  public get pending(): number {
    return this.activeCount;
  }

  public get size(): number {
    return this.queue.length;
  }
}

// Instância singleton para a fila de scraping
export const scraperQueue = new TaskQueue({
  concurrency: 1, // 1 requisição de scraping ativa por vez
  intervalMs: 1500, // intervalo mínimo de 1.5s entre scrapes
});
