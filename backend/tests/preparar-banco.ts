import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ARQUIVO_BANCO = 'loa2027-test.db';

/**
 * Cria um banco isolado para os testes e executa a carga de referencia,
 * de modo que os testes de integracao trabalhem sobre a proposta completa
 * da LOA 2027.
 */
export default async function preparar() {
  const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
  for (const sufixo of ['', '-journal']) {
    rmSync(join(raiz, 'prisma', `${ARQUIVO_BANCO}${sufixo}`), { force: true });
  }

  const env = { ...process.env, DATABASE_URL: `file:./${ARQUIVO_BANCO}` };
  execSync('npx prisma db push --skip-generate', { cwd: raiz, env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { cwd: raiz, env, stdio: 'pipe' });
}
