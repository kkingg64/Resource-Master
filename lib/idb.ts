import { openDB, DBSchema } from 'idb';
import { Project, Holiday } from '../types';

const DB_NAME = 'OMS-Resource-Master-DB';
const DB_VERSION = 1;
const STORE_NAME = 'versions';

export interface IDBVersion {
  id?: number;
  name: string;
  timestamp: number;
  data: {
    projects: Project[];
    holidays: Holiday[];
  };
}

interface MyDB extends DBSchema {
  [STORE_NAME]: {
    key: number;
    value: IDBVersion;
    indexes: { 'timestamp': number };
  };
}

const dbPromise = openDB<MyDB>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    const store = db.createObjectStore(STORE_NAME, {
      keyPath: 'id',
      autoIncrement: true,
    });
    store.createIndex('timestamp', 'timestamp');
  },
});

export const saveVersion = async (version: Omit<IDBVersion, 'id'>): Promise<void> => {
  const db = await dbPromise;
  await db.add(STORE_NAME, version as IDBVersion);
};

export const getAllVersions = async (): Promise<IDBVersion[]> => {
  const db = await dbPromise;
  // Get all and sort by timestamp descending
  const versions = await db.getAllFromIndex(STORE_NAME, 'timestamp');
  return versions.reverse();
};

export const getVersionById = async (id: number): Promise<IDBVersion | undefined> => {
  const db = await dbPromise;
  return db.get(STORE_NAME, id);
};

export const deleteVersion = async (id: number): Promise<void> => {
  const db = await dbPromise;
  await db.delete(STORE_NAME, id);
};