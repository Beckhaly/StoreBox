import { Pool, QueryResult } from 'pg';
import { mockDb } from './db-mock';

let useMock = false;
let connectionTested = false;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://storebox:TelePro2026!@localhost:5432/storebox_ci',
  max:            10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

// Logguer les erreurs idle du pool sans basculer en mock
pool.on('error', (err) => {
  console.error('Pool error (idle client):', err.message);
});

export const db = {
  query: async <T extends Record<string, any> = Record<string, any>>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> => {
    // Test connection on first query if not tested yet
    if (!connectionTested) {
      connectionTested = true;
      try {
        await pool.query('SELECT 1');
      } catch (err: any) {
        console.error('⚠️ PostgreSQL unavailable. Running in MOCK mode (demo only)');
        useMock = true;
      }
    }

    if (useMock) {
      return mockDb.query<T>(text, params);
    }

    // Ne pas basculer en mock sur erreur individuelle — laisser l'erreur remonter
    // Le mock ne connaît pas les nouvelles tables (caisses, sessions_caisse, etc.)
    return pool.query<T>(text, params);
  },

  connect: async () => {
    if (useMock) {
      return mockDb.connect();
    }
    return pool.connect();
  },
};
