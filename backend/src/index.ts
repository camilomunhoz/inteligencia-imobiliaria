import 'dotenv/config';
import { buildServer } from './server.js';

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || '0.0.0.0';

const server = buildServer();

server.listen({ port, host }, (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
  console.log(`[Servidor] Backend rodando em ${address}`);
});
