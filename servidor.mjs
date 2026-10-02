#!/usr/bin/env node
/**
 * Servidor estático do painel. Sem dependência: o `node:http` da plataforma basta.
 *
 * Ele serve o repositório inteiro porque a interface importa os módulos de
 * `nucleo/` e `dados/` DIRETAMENTE, como ES modules, sem empacotador. O que o
 * navegador executa é o mesmo arquivo que os testes executam — não há build entre
 * os dois, e por isso não há como a tela divergir do que foi conferido.
 *
 *   node servidor.mjs [--porta 8080]
 */

import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const RAIZ = resolve(import.meta.dirname);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.csv': 'text/csv; charset=utf-8',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const args = process.argv.slice(2);
const pega = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : padrao;
};
const porta = Number(pega('porta', process.env.PORTA ?? 8080));

function responde(res, codigo, corpo, tipo = 'text/plain; charset=utf-8') {
  res.writeHead(codigo, {
    'content-type': tipo,
    'cache-control': 'no-store',
  });
  res.end(corpo);
}

const servidor = createServer((req, res) => {
  let caminho;
  try {
    caminho = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  } catch {
    responde(res, 400, 'URL inválida');
    return;
  }

  if (caminho === '/' || caminho === '') {
    res.writeHead(302, { location: '/publico/index.html' });
    res.end();
    return;
  }

  // Normalizar ANTES de juntar com a raiz. Sem isso, "/../../etc/passwd" sai do
  // repositório, e um servidor de painel não tem nenhuma razão para ler fora dele.
  const relativo = normalize(caminho).replace(/^([/\\]|\.\.[/\\])+/, '');
  const alvo = join(RAIZ, relativo);
  if (alvo !== RAIZ && !alvo.startsWith(RAIZ + sep)) {
    responde(res, 403, 'fora da raiz');
    return;
  }

  // Nada que comece com ponto. O repositório tem `.git` dentro da raiz servida, e
  // um painel não tem nenhuma razão para publicar o histórico e a configuração do
  // próprio repositório na porta em que publica a projeção.
  if (relativo.split(/[/\\]/).some((parte) => parte.startsWith('.'))) {
    responde(res, 403, 'caminho oculto');
    return;
  }

  let info;
  try {
    info = statSync(alvo);
  } catch {
    responde(res, 404, `não encontrado: ${caminho}`);
    return;
  }
  if (info.isDirectory()) {
    responde(res, 403, 'listagem de diretório desabilitada');
    return;
  }

  res.writeHead(200, {
    'content-type': TIPOS[extname(alvo).toLowerCase()] ?? 'application/octet-stream',
    'content-length': info.size,
    'cache-control': 'no-store',
  });
  createReadStream(alvo).pipe(res);
});

servidor.listen(porta, () => {
  console.log(`Painel da folha do Paraná em http://localhost:${porta}/`);
  console.log(`raiz: ${RAIZ}`);
});
