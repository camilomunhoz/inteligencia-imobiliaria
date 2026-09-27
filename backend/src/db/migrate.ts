import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index.js';

async function runMigrate() {
  console.log('Executando migrations do Drizzle...');
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations aplicadas com sucesso!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Erro ao executar migrations:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigrate();
