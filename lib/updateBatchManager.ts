/**
 * Update Batch Manager
 * Debounces and batches multiple updates together to reduce network calls and re-renders
 */

export interface BatchedUpdate {
  table: string;
  id: string;
  data: Record<string, any>;
  timestamp: number;
}

export class UpdateBatchManager {
  private batches: Map<string, BatchedUpdate[]> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private batchDelay: number = 300; // ms
  private onBatchReady: (updates: BatchedUpdate[]) => Promise<void>;
  private maxBatchSize: number = 50;

  constructor(onBatchReady: (updates: BatchedUpdate[]) => Promise<void>, batchDelay = 300) {
    this.onBatchReady = onBatchReady;
    this.batchDelay = batchDelay;
  }

  /**
   * Add update to batch
   */
  addUpdate(table: string, id: string, data: Record<string, any>) {
    const key = `${table}:${id}`;
    
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
    }

    // Get or create batch for this table
    if (!this.batches.has(table)) {
      this.batches.set(table, []);
    }

    const batch = this.batches.get(table)!;
    
    // Remove existing update for this ID if present
    const existingIndex = batch.findIndex(u => u.id === id);
    if (existingIndex !== -1) {
      // Merge with existing update
      batch[existingIndex].data = { ...batch[existingIndex].data, ...data };
      batch[existingIndex].timestamp = Date.now();
    } else {
      batch.push({
        table,
        id,
        data,
        timestamp: Date.now(),
      });
    }

    // Set timer to flush if batch reaches max size or delay expires
    const timer = setTimeout(() => {
      if (batch.length >= this.maxBatchSize) {
        this.flush();
      } else {
        this.flushTable(table);
      }
    }, this.batchDelay);

    this.timers.set(key, timer);

    // Auto-flush if batch is full
    if (batch.length >= this.maxBatchSize) {
      clearTimeout(timer);
      this.timers.delete(key);
      this.flush();
    }
  }

  /**
   * Immediately flush all pending updates
   */
  async flush() {
    const allUpdates: BatchedUpdate[] = [];

    for (const [table, updates] of this.batches) {
      allUpdates.push(...updates);
    }

    if (allUpdates.length === 0) return;

    try {
      await this.onBatchReady(allUpdates);
      this.batches.clear();
      this.timers.forEach(timer => clearTimeout(timer));
      this.timers.clear();
    } catch (error) {
      console.error('Error flushing batch updates:', error);
    }
  }

  /**
   * Flush updates for a specific table
   */
  async flushTable(table: string) {
    const updates = this.batches.get(table) || [];
    if (updates.length === 0) return;

    try {
      await this.onBatchReady(updates);
      this.batches.delete(table);
      
      // Clear timers for this table
      for (const [key, _] of this.timers) {
        if (key.startsWith(`${table}:`)) {
          this.timers.delete(key);
        }
      }
    } catch (error) {
      console.error(`Error flushing batch updates for ${table}:`, error);
    }
  }

  /**
   * Get pending update count
   */
  getPendingCount(): number {
    let count = 0;
    for (const updates of this.batches.values()) {
      count += updates.length;
    }
    return count;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.batches.clear();
  }
}

/**
 * Debounce function for expensive operations
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function (...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Throttle function for high-frequency events
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
