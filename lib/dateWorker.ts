/**
 * Date Calculation Worker
 * Run expensive date calculations in a Web Worker to keep UI thread responsive
 * This worker handles: date formatting, progress calculation, holiday lookups
 */

// Worker code to be executed in separate thread
export const dateWorkerCode = `
self.onmessage = function(e) {
  const { id, type, data } = e.data;

  try {
    let result;

    switch (type) {
      case 'calculateProgress':
        result = calculateProgress(data.startDate, data.endDate);
        break;

      case 'formatDate':
        result = data.date ? new Date(data.date.replace(/-/g, '/')).toISOString() : null;
        break;

      case 'getDateString':
        result = data.date instanceof Date 
          ? \`\${data.date.getFullYear()}-\${String(data.date.getMonth() + 1).padStart(2, '0')}-\${String(data.date.getDate()).padStart(2, '0')}\`
          : data.date;
        break;

      case 'batchCalculateProgress':
        result = data.assignments.map(a => ({
          id: a.id,
          progress: calculateProgress(a.startDate, a.endDate)
        }));
        break;

      default:
        result = null;
    }

    self.postMessage({ id, success: true, result });
  } catch (error) {
    self.postMessage({ id, success: false, error: error.message });
  }
};

function calculateProgress(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate.replace(/-/g, '/'));
  const end = new Date(endDate.replace(/-/g, '/'));
  const now = new Date();

  if (now < start) return 0;
  if (now > end) return 100;

  const total = end.getTime() - start.getTime();
  const current = now.getTime() - start.getTime();
  return Math.round((current / total) * 100);
}
`;

/**
 * DateWorker - Wrapper for using Web Worker for date calculations
 */
export class DateWorker {
  private worker: Worker | null = null;
  private messageId = 0;
  private pendingRequests = new Map<number, (value: any) => void>();

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      const blob = new Blob([dateWorkerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);

      this.worker.onmessage = (e) => {
        const { id, success, result, error } = e.data;
        const resolve = this.pendingRequests.get(id);
        if (resolve) {
          if (success) {
            resolve(result);
          } else {
            console.error(`Worker error: ${error}`);
            resolve(null);
          }
          this.pendingRequests.delete(id);
        }
      };

      this.worker.onerror = (error) => {
        console.error('Worker error:', error);
      };
    } catch (e) {
      console.warn('Web Workers not available, calculation will run on main thread', e);
    }
  }

  private send(type: string, data: any): Promise<any> {
    return new Promise((resolve) => {
      if (!this.worker) {
        // Fallback to main thread
        resolve(null);
        return;
      }

      const id = this.messageId++;
      this.pendingRequests.set(id, resolve);
      this.worker.postMessage({ id, type, data });

      // Timeout in case worker doesn't respond
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          resolve(null);
        }
      }, 5000);
    });
  }

  async calculateProgress(startDate: string, endDate: string): Promise<number> {
    const result = await this.send('calculateProgress', { startDate, endDate });
    return result || 0;
  }

  async formatDate(date: Date | string): Promise<string> {
    const result = await this.send('formatDate', { date });
    return result || '';
  }

  async batchCalculateProgress(assignments: Array<{ id: string; startDate: string; endDate: string }>): Promise<Record<string, number>> {
    const result = await this.send('batchCalculateProgress', { assignments });
    const map: Record<string, number> = {};
    if (result) {
      result.forEach((item: { id: string; progress: number }) => {
        map[item.id] = item.progress;
      });
    }
    return map;
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

// Singleton instance
let workerInstance: DateWorker | null = null;

export function getDateWorker(): DateWorker {
  if (!workerInstance) {
    workerInstance = new DateWorker();
  }
  return workerInstance;
}

export function terminateDateWorker() {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
}
