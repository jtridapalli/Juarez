import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, EXERCICIO, type Consolidacao, type Emenda, type Painel } from '../api';
import { useAutenticacao } from '../autenticacao';
import { Aviso, Botao, Cartao, Carregando, Etiqueta, Indicador, TituloPagina, Vazio } from '../componentes/base';
import { formatarDataHora, formatarMoeda, formatarResumo } from '../formato';

export function PaginaConsolidacao() {
  const { usuario } = useAutenticacao();
  const clienteQuery = useQueryClient();
  const [mensagem, setMensagem] = useState<{ tom: 'erro' | 'sucesso'; texto: string } | null>(null);

  const podeConsolidar = usuario ? ['ADMIN', 'ORGAO_CENTRAL'].includes(usuario.perfil) : false;

  const painel = useQuery({ queryKey: ['painel', EXERCICIO], queryFn: () => api.get<Painel>(`/exercicios/${EXERCICIO}/painel`) });
  const consolidacoes = useQuery({
    queryKey: ['consolidacoes', EXERCICIO],
    queryFn: () => api.get<Consolidacao[]>(`/exercicios/${EXERCICIO}/consolidacoes`),
  });
  const emendas = useQuery({ queryKey: ['emendas', EXERCICIO], queryFn: () => api.get<Emenda[]>(`/exercicios/${EXERCICIO}/emendas`) });

  const consolidar = useMutation({
    mutationFn: () => api.post<Consolidacao>(`/exercicios/${EXERCICIO}/consolidacao`),
    onSuccess: (consolidacao) => {
      setMensagem({
        tom: 'sucesso',
        texto: `Versão ${consolidacao.versao} consolidada com receita e despesa de R$ ${formatarMoeda(consolidacao.despesaTotal)}.`,
      });
      clienteQuery.invalidateQueries({ queryKey: ['consolidacoes'] });
      clienteQuery.invalidateQueries({ queryKey: ['painel'] });
    },
    onError: (erro: Error) => setMensagem({ tom: 'erro', texto: erro.message }),
  });

  if (painel.isLoading || consolidacoes.isLoading) return <Carregando />;

  const totais = painel.data?.totais;
  const fiscal = totais?.porEsfera.find((e) => e.esfera === 'F');
  const seguridade = totais?.porEsfera.find((e) => e.esfera === 'S');

  return (
    <>
      <TituloPagina
        titulo="Consolidação do projeto de lei"
        descricao="Fechamento das propostas setoriais em uma versão numerada, com registro do resumo, do resultado da validação e do código de integridade da base consolidada."
        acoes={
          podeConsolidar && (
            <Botao onClick={() => consolidar.mutate()} disabled={consolidar.isPending}>
              {consolidar.isPending ? 'Consolidando...' : 'Consolidar nova versão'}
            </Botao>
          )
        }
      />

      {mensagem && (
        <div className="mb-3">
          <Aviso tom={mensagem.tom}>{mensagem.texto}</Aviso>
        </div>
      )}

      {totais && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Indicador rotulo="Receita a consolidar" valor={formatarResumo(totais.receitaTotal)} tom="destaque" />
          <Indicador rotulo="Despesa a consolidar" valor={formatarResumo(totais.despesaTotal)} tom="destaque" />
          <Indicador rotulo="Orçamento fiscal" valor={formatarResumo(fiscal?.despesa ?? 0)} />
          <Indicador rotulo="Orçamento da seguridade social" valor={formatarResumo(seguridade?.despesa ?? 0)} />
        </div>
      )}

      <Cartao className="mt-4" titulo="Versões consolidadas">
        {consolidacoes.data && consolidacoes.data.length > 0 ? (
          <div className="max-h-80 overflow-auto">
            <table className="tabela-orcamento">
              <thead>
                <tr>
                  <th>Versão</th>
                  <th>Gerada em</th>
                  <th>Responsável</th>
                  <th className="numero">Receita (R$)</th>
                  <th className="numero">Despesa (R$)</th>
                  <th>Equilíbrio</th>
                  <th>Validação</th>
                  <th>Integridade (SHA-256)</th>
                </tr>
              </thead>
              <tbody>
                {consolidacoes.data.map((c) => (
                  <tr key={c.id}>
                    <td className="font-semibold">{c.versao}</td>
                    <td>{formatarDataHora(c.geradaEm)}</td>
                    <td>{c.geradaPor ?? '-'}</td>
                    <td className="numero">{formatarMoeda(c.receitaTotal)}</td>
                    <td className="numero">{formatarMoeda(c.despesaTotal)}</td>
                    <td>
                      <Etiqueta tom={c.equilibrada ? 'positivo' : 'negativo'}>{c.equilibrada ? 'Equilibrada' : 'Desequilibrada'}</Etiqueta>
                    </td>
                    <td>
                      <Etiqueta tom={c.validacaoOk ? 'positivo' : 'negativo'}>
                        {c.validacaoOk ? 'Sem impedimentos' : `${c.resumo?.validacao.erros ?? 0} impedimento(s)`}
                      </Etiqueta>
                    </td>
                    <td className="font-mono text-[0.625rem] text-slate-600">{c.hash.slice(0, 24)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Vazio mensagem="Nenhuma versão consolidada até o momento." />
        )}
      </Cartao>

      <Cartao className="mt-4" titulo="Emendas parlamentares em análise" descricao="Proposições apresentadas durante a tramitação na Assembleia Legislativa.">
        {emendas.data && emendas.data.length > 0 ? (
          <table className="tabela-orcamento">
            <thead>
              <tr>
                <th>Número</th>
                <th>Autoria</th>
                <th>Objeto</th>
                <th>Município</th>
                <th>U.O.</th>
                <th>Situação</th>
                <th className="numero">Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              {emendas.data.map((e) => (
                <tr key={e.id}>
                  <td className="font-mono">{e.numero}</td>
                  <td>{e.autor}</td>
                  <td>{e.objeto}</td>
                  <td>{e.municipio ?? '-'}</td>
                  <td className="font-mono">{e.unidade.codigo}</td>
                  <td>
                    <Etiqueta tom={e.status === 'ACATADA' ? 'positivo' : e.status === 'REJEITADA' ? 'negativo' : 'atencao'}>{e.status}</Etiqueta>
                  </td>
                  <td className="numero">{formatarMoeda(e.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Vazio mensagem="Nenhuma emenda registrada." />
        )}
      </Cartao>
    </>
  );
}
