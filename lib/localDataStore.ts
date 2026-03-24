// lib/localDataStore.ts
// 本地data store - 離線模式用

import { Project, ProjectModule, ProjectTask, TaskAssignment, Resource, Holiday, IndividualHoliday, ResourceAllocation, LogEntry } from '../types';

interface LocalDataStore {
  projects: Project[];
  modules: ProjectModule[];
  tasks: ProjectTask[];
  assignments: TaskAssignment[];
  resources: Resource[];
  holidays: Holiday[];
  allocations: ResourceAllocation[];
}

// 初始化空data
const emptyStore: LocalDataStore = {
  projects: [],
  modules: [],
  tasks: [],
  assignments: [],
  resources: [],
  holidays: [],
  allocations: [],
};

class LocalDataManager {
  private store: LocalDataStore;
  private storageKey = 'oms_local_data_store';

  constructor() {
    this.store = this.loadFromLocalStorage();
  }

  private loadFromLocalStorage(): LocalDataStore {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : emptyStore;
    } catch {
      console.warn('⚠️ Failed to load from localStorage, using empty store');
      return emptyStore;
    }
  }

  public saveToLocalStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.store));
      console.log('✅ Data saved to localStorage');
    } catch (error) {
      console.error('❌ Failed to save to localStorage:', error);
    }
  }

  public importFromJSON(data: LocalDataStore): void {
    this.store = data;
    this.saveToLocalStorage();
    console.log('✅ Data imported from JSON');
  }

  public exportToJSON(): LocalDataStore {
    return this.store;
  }

  public getStore(): LocalDataStore {
    return this.store;
  }

  public clearAll(): void {
    this.store = emptyStore;
    localStorage.removeItem(this.storageKey);
    console.log('✅ All local data cleared');
  }
}

export const localDataManager = new LocalDataManager();
