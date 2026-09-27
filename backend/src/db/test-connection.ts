import { sql } from 'drizzle-orm';
import { db, pool } from './index.js';

async function main() {
  console.log('Testando conexao com o banco via Drizzle ORM...');
  try {
    const timeResult = await db.execute(sql`SELECT NOW() as current_time;`);
    console.log('Conexao estabelecida com sucesso!');
    console.log('Horario no banco:', (timeResult.rows[0] as { current_time: unknown }).current_time);

    const postgisResult = await db.execute(sql`SELECT postgis_version();`);
    console.log('PostGIS versao:', (postgisResult.rows[0] as { postgis_version: unknown }).postgis_version);

    await pool.end();
    console.log('Teste concluido com sucesso.');
    process.exit(0);
  } catch (error) {
    console.error('Erro ao conectar ao banco:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
