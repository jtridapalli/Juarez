import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requisicaoInvalida } from '../lib/erros.js';
import { ANEXOS, gerarAnexo } from '../servicos/anexos.js';
import { paraCsv, paraPdf, paraXlsx } from '../servicos/exportadores.js';
import { gerarProjetoLei } from '../servicos/projeto-lei.js';
import { carregarSnapshot } from '../servicos/snapshot.js';

const paramsAno = z.object({ ano: z.coerce.number().int().min(2000).max(2100) });
const formatoSchema = z.object({ formato: z.enum(['json', 'csv', 'xlsx', 'pdf']).default('json') });

export async function rotasRelatorios(app: FastifyInstance) {
  app.get('/api/exercicios/:ano/anexos', async () =>
    ANEXOS.map((a) => ({
      codigo: a.codigo,
      titulo: a.titulo,
      formatos: ['json', 'csv', 'xlsx', 'pdf'],
    })),
  );

  app.get('/api/exercicios/:ano/anexos/:codigo', async (requisicao, resposta) => {
    const { ano } = paramsAno.parse(requisicao.params);
    const { codigo } = z.object({ codigo: z.string().min(3) }).parse(requisicao.params);
    const { formato } = formatoSchema.parse(requisicao.query);
    if (!ANEXOS.some((a) => a.codigo === codigo)) throw requisicaoInvalida(`Anexo desconhecido: ${codigo}`);

    const snapshot = await carregarSnapshot(ano);
    const tabela = gerarAnexo(codigo, snapshot);
    const nomeArquivo = `LOA${ano}-${codigo}`;

    if (formato === 'json') return tabela;

    if (formato === 'csv') {
      return resposta
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${nomeArquivo}.csv"`)
        .send(paraCsv(tabela));
    }

    if (formato === 'xlsx') {
      const buffer = await paraXlsx([tabela], { exercicio: ano, titulo: tabela.titulo });
      return resposta
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${nomeArquivo}.xlsx"`)
        .send(buffer);
    }

    const buffer = await paraPdf(tabela, { exercicio: ano, titulo: tabela.titulo });
    return resposta
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="${nomeArquivo}.pdf"`)
      .send(buffer);
  });

  /** Pacote unico com todos os anexos em uma planilha, uma aba por anexo. */
  app.get('/api/exercicios/:ano/anexos-completos.xlsx', async (requisicao, resposta) => {
    const { ano } = paramsAno.parse(requisicao.params);
    const snapshot = await carregarSnapshot(ano);
    const tabelas = ANEXOS.map((a) => a.gerar(snapshot));
    const buffer = await paraXlsx(tabelas, { exercicio: ano, titulo: `Anexos da LOA ${ano}` });
    return resposta
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="LOA${ano}-anexos-completos.xlsx"`)
      .send(buffer);
  });

  app.get('/api/exercicios/:ano/projeto-lei', async (requisicao, resposta) => {
    const { ano } = paramsAno.parse(requisicao.params);
    const { formato } = z.object({ formato: z.enum(['json', 'txt']).default('json') }).parse(requisicao.query);
    const snapshot = await carregarSnapshot(ano);
    const projeto = gerarProjetoLei(snapshot);

    if (formato === 'txt') {
      return resposta
        .header('Content-Type', 'text/plain; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="LOA${ano}-projeto-de-lei.txt"`)
        .send(projeto.texto);
    }
    return projeto;
  });
}
