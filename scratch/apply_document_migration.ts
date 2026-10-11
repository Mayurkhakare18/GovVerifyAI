import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('[Notice] DATABASE_URL is not configured in .env; skipping direct PostgreSQL migration application.');
    return;
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('[PostgreSQL] Connected to database.');

    const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20261010000002_document_verification.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('[PostgreSQL] Executing 20261010000002_document_verification.sql...');
    await client.query(sql);
    console.log('[PostgreSQL] Migration 20261010000002_document_verification.sql successfully applied!');
  } catch (err: any) {
    console.error('[PostgreSQL] Migration execution note:', err.message);
  } finally {
    await client.end();
  }
}

main();
