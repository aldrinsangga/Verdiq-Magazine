import fs from 'fs/promises';
import path from 'path';
import { UserAccount, Review } from '../types';

const DB_FILE = path.resolve('db.json');

interface DatabaseSchema {
  users: UserAccount[];
}

async function getDb(): Promise<DatabaseSchema> {
  try {
    const data = await fs.readFile(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    // Initial data if file doesn't exist
    const initialData: DatabaseSchema = {
      users: [
        {
          id: 'admin-001',
          email: 'admin@verdiq.ai',
          password: 'admin123',
          name: 'Verdiq Admin',
          credits: 9999,
          history: [],
          purchases: [],
          role: 'admin'
        }
      ]
    };
    await saveDb(initialData);
    return initialData;
  }
}

async function saveDb(data: DatabaseSchema) {
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

export const db = {
  users: {
    find: async () => {
      const { users } = await getDb();
      return users;
    },
    findOne: async (query: Partial<UserAccount>) => {
      const { users } = await getDb();
      return users.find(u => {
        return Object.entries(query).every(([key, value]) => (u as any)[key] === value);
      });
    },
    insertOne: async (user: UserAccount) => {
      const data = await getDb();
      data.users.push(user);
      await saveDb(data);
      return user;
    },
    updateOne: async (query: Partial<UserAccount>, update: Partial<UserAccount>) => {
      const data = await getDb();
      const index = data.users.findIndex(u => {
        return Object.entries(query).every(([key, value]) => (u as any)[key] === value);
      });
      if (index !== -1) {
        data.users[index] = { ...data.users[index], ...update };
        await saveDb(data);
        return data.users[index];
      }
      return null;
    },
    deleteOne: async (query: Partial<UserAccount>) => {
      const data = await getDb();
      const initialLength = data.users.length;
      data.users = data.users.filter(u => {
        return !Object.entries(query).every(([key, value]) => (u as any)[key] === value);
      });
      if (data.users.length !== initialLength) {
        await saveDb(data);
        return true;
      }
      return false;
    }
  }
};

export async function ensureDbReady(): Promise<void> {
  try {
    await getDb();
  } catch (error) {
    console.error("Database initialization error:", error);
    throw error;
  }
}
