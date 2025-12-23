import Dexie from 'dexie';

export const db = new Dexie('LocalDocsDB');

db.version(1).stores({
    documents: '++id, customerId, type, created_at' // Primary key and indexed props
});
