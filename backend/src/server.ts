import { criarApp } from './app.js';

const porta = Number(process.env.PORT ?? 3333);
const host = process.env.HOST ?? '0.0.0.0';

const app = await criarApp();

try {
  await app.listen({ port: porta, host });
  app.log.info(`API da LOA disponivel em http://${host}:${porta}`);
} catch (erro) {
  app.log.error(erro);
  process.exit(1);
}
