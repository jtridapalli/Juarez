import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api, EXERCICIO, type Proposta } from '../api';
import { useAutenticacao } from '../autenticacao';
import { Aviso, BarraProgresso, Botao, Cartao, Carregando, Etiqueta, Indicador, TituloPagina, Vazio } from '../componentes/base';
import { formatarDataHora, formatarMoeda, formatarResumo, rotuloStatus } from '../formato';

const TOM_STATUS: Record<string, 'positivo' | 'atencao' | 'negativo' | 'neutro'> = {
  HOMOLOGADA: 'positivo',
  ENVIADA: 'atencao',
  EM_ANALISE: 'atencao',
  DEVOLVIDA: 'negativo',
  EM_ELABORACAO: 'neutro',
};

const ACOES: { acao: string; rotulo: string; deStatus: string[]; tipo: 'primario' | 'secundario' | 'sucesso' | 'perigo' }[] = [
  { acao: 'enviar', rotulo: 'Enviar', deStatus: ['EM_ELABORACAO', 'DEVOLVIDA'], tipo: 'primario' },
  { acao: 'analisar', rotulo: 'Colocar em análise', deStatus: ['ENVIADA'], tipo: 'secundario' },
  { acao: 'homologar', rotulo: 'Homologar', deStatus: ['ENVIADA', 'EM_ANALISE'], tipo: 'sucesso' },
  { acao: 'devolver', rotulo: 'Devolver', deStatus: ['ENVIADA', 'EM_ANALISE'], tipo: 'perigo' },
  { acao: 'reabrir', rotulo: 'Reabrir', deStatus: ['HOMOLOGADA', 'ENVIADA', 'EM_ANALISE'], tipo: 'secundario' },
];

export function PaginaPropostas() {
  const { podeEditar } = useAutenticacao();
  const clienteQuery = useQueryClient();
  const [filtro, setFiltro] = useState('');
  const [status, setStatus] = useState('');
  const [mensagem, setMensagem] = useState<{ tom: 'erro' | 'sucesso'; texto: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['propostas', EXERCICIO],
    queryFn: () => api.get<Proposta[]>(`/exercicios/${EXERCICIO}/propostas`),
  });

  const transicao = useMutation({
    mutationFn: ({ id, acao }: { id: number; acao: string }) => api.post(`/propostas/${id}/${acao}`, {}),
    onSuccess: (_, variaveis) => {
      setMensagem({ tom: 'sucesso', texto: `Proposta atualizada com a operação "${variaveis.acao}".` });
      clienteQuery.invalidateQueries({ queryKey: ['propostas'] });
      clienteQuery.invalidateQueries({ queryKey: ['painel'] });
    },
    onError: (erro: Error) => setMensagem({ tom: 'erro', texto: erro.message }),
  });

  const filtradas = useMemo(() => {
    if (!data) return [];
    const termo = filtro.trim().toLowerCase();
    return data.filter(
      (p) =>
        (!status || p.status === status) &&
        (!termo || p.unidade.nome.toLowerCase().includes(termo) || p.unidade.codigo.includes(termo) || p.unidade.sigla.toLowerCase().includes(termo)),
    );
  }, [data, filtro, status]);

  const resumo = useMemo(() => {
    const itens = data ?? [];
    return {
      total: itens.length,
      homologadas: itens.filter((p) => p.status === 'HOMOLOGADA').length,
      pendentes: itens.filter((p) => p.status !== 'HOMOLOGADA').length,
      valor: itens.reduce((t, p) => t + p.total, 0),
    };
  }, [data]);

  if (isLoading) return <Carregando />;
  if (error || !data) return <Aviso>Não foi possível carregar as propostas setoriais.</Aviso>;

  return (
    <>
      <TituloPagina
        titulo="Propostas setoriais"
        descricao="Acompanhamento da tramitação das propostas das unidades orçamentárias: elaboração, envio, análise do órgão central e homologação."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador rotulo="Propostas recebidas" valor={String(resumo.total)} />
        <Indicador rotulo="Homologadas" valor={String(resumo.homologadas)} tom="positivo" />
        <Indicador rotulo="Pendentes de homologação" valor={String(resumo.pendentes)} tom={resumo.pendentes > 0 ? 'atencao' : 'positivo'} />
        <Indicador rotulo="Despesa proposta" valor={formatarResumo(resumo.valor)} tom="destaque" />
      </div>

      {mensagem && (
        <div className="mt-3">
          <Aviso tom={mensagem.tom}>{mensagem.texto}</Aviso>
        </div>
      )}

      <Cartao
        className="mt-4"
        titulo={`Propostas (${filtradas.length})`}
        acoes={
          <>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-xs">
              <option value="">Todas as situações</option>
              {['EM_ELABORACAO', 'ENVIADA', 'EM_ANALISE', 'DEVOLVIDA', 'HOMOLOGADA'].map((s) => (
                <option key={s} value={s}>
                  {rotuloStatus(s)}
                </option>
              ))}
            </select>
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Filtrar por unidade"
              className="w-52 rounded-md border border-slate-300 px-2 py-1 text-xs"
            />
          </>
        }
      >
        <div className="max-h-[34rem] overflow-auto">
          <table className="tabela-orcamento">
            <thead>
              <tr>
                <th>U.O.</th>
                <th>Unidade orçamentária</th>
                <th>Situação</th>
                <th className="numero">Dotações</th>
                <th className="numero">Proposta (R$)</th>
                <th className="numero">Teto (R$)</th>
                <th>Utilização do teto</th>
                <th>Envio</th>
                {podeEditar && <th>Tramitação</th>}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono">{p.unidade.codigo}</td>
                  <td>
                    {p.unidade.sigla}
                    <p className="text-[0.6875rem] text-slate-500">{p.unidade.nome}</p>
                  </td>
                  <td>
                    <Etiqueta tom={TOM_STATUS[p.status] ?? 'neutro'}>{rotuloStatus(p.status)}</Etiqueta>
                    {p.parecer && <p className="mt-1 max-w-64 text-[0.6875rem] text-slate-500">{p.parecer}</p>}
                  </td>
                  <td className="numero">{p.quantidadeDotacoes}</td>
                  <td className="numero">{formatarMoeda(p.total)}</td>
                  <td className="numero">{p.teto === null ? '-' : formatarMoeda(p.teto)}</td>
                  <td>{p.teto ? <BarraProgresso percentual={(p.total / p.teto) * 100} /> : '-'}</td>
                  <td className="text-[0.6875rem] text-slate-600">{formatarDataHora(p.enviadaEm)}</td>
                  {podeEditar && (
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {ACOES.filter((a) => a.deStatus.includes(p.status)).map((a) => (
                          <Botao
                            key={a.acao}
                            tipo={a.tipo}
                            disabled={transicao.isPending}
                            onClick={() => transicao.mutate({ id: p.id, acao: a.acao })}
                          >
                            {a.rotulo}
                          </Botao>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtradas.length === 0 && <Vazio mensagem="Nenhuma proposta atende ao filtro informado." />}
        </div>
      </Cartao>
    </>
  );
}
