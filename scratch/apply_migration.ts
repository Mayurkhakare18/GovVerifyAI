import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not configured in .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database.');

    const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20261010000001_action_guidance.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing migration 20261010000001_action_guidance.sql...');
    await client.query(sql);
    console.log('Migration successfully applied! action_guidance table is ready.');
  } catch (err: any) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

main();
