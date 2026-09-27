import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db, pool } from '../db/index.js';

async function main() {
  console.log('=== STATUS DOS PONTOS DE INTERESSE (POIs) ===\n');

  const counts = await db.execute(sql`
    SELECT
      categoria,
      origem,
      COUNT(*)::integer AS total
    FROM pontos_interesse
    GROUP BY categoria, origem
    ORDER BY categoria, origem;
  `);

  console.table(counts.rows);

  const total = await db.execute(sql`SELECT count(*)::integer as total FROM pontos_interesse;`);
  console.log(`Total geral: ${(total.rows[0] as { total: number }).total} POIs cadastrados.\n`);

  console.log('Exemplos de marcos fixos manuais:');
  const manuais = await db.execute(sql`
    SELECT nome, categoria, ST_AsText(geom) as coordenadas
    FROM pontos_interesse
    WHERE origem = 'manual'
    ORDER BY nome;
  `);
  console.table(manuais.rows);

  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Erro ao consultar status:', err);
  await pool.end();
  process.exit(1);
});
