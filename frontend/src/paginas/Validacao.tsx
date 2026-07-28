import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, EXERCICIO, type RelatorioValidacao, type ResultadoValidacao } from '../api';
import { useAutenticacao } from '../autenticacao';
import { Aviso, Botao, Cartao, Carregando, Etiqueta, Indicador, TituloPagina } from '../componentes/base';
import { formatarDataHora, formatarMoeda } from '../formato';

function CartaoRegra({ resultado }: { resultado: ResultadoValidacao }) {
  const [detalhesVisiveis, setDetalhesVisiveis] = useState(false);
  const conforme = resultado.aprovado;
  const informativa = resultado.severidade === 'INFO';

  const borda = conforme
    ? informativa
      ? 'border-l-parana-500'
      : 'border-l-emerald-500'
    : resultado.severidade === 'ERRO'
      ? 'border-l-rose-500'
      : 'border-l-amber-500';

  const detalhes = resultado.detalhes;
  const temDetalhes = Array.isArray(detalhes) ? detalhes.length > 0 : detalhes !== null && detalhes !== undefined;

  return (
    <div className={`rounded-md border border-slate-200 border-l-4 bg-white p-3 shadow-sm ${borda}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">{resultado.regra}</p>
          <h3 className="text-sm font-semibold text-slate-900">{resultado.titulo}</h3>
        </div>
        <Etiqueta tom={conforme ? (informativa ? 'info' : 'positivo') : resultado.severidade === 'ERRO' ? 'negativo' : 'atencao'}>
          {conforme ? (informativa ? 'Informativo' : 'Conforme') : resultado.severidade === 'ERRO' ? 'Impedimento' : 'Alerta'}
        </Etiqueta>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-700">{resultado.mensagem}</p>

      {(resultado.valorApurado !== null || resultado.valorReferencia !== null) && (
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[0.6875rem]">
          {resultado.valorApurado !== null && (
            <div>
              <dt className="inline text-slate-500">Apurado: </dt>
              <dd className="inline font-semibold tabular-nums text-slate-800">{formatarMoeda(resultado.valorApurado)}</dd>
            </div>
          )}
          {resultado.valorReferencia !== null && (
            <div>
              <dt className="inline text-slate-500">Referência: </dt>
              <dd className="inline font-semibold tabular-nums text-slate-800">{formatarMoeda(resultado.valorReferencia)}</dd>
            </div>
          )}
        </dl>
      )}

      {resultado.fundamento && <p className="mt-2 text-[0.6875rem] italic text-slate-500">{resultado.fundamento}</p>}

      {temDetalhes && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setDetalhesVisiveis((visivel) => !visivel)}
            className="text-[0.6875rem] font-semibold text-parana-700 hover:underline"
          >
            {detalhesVisiveis ? 'Ocultar memória de apuração' : 'Ver memória de apuração'}
          </button>
          {detalhesVisiveis && (
            <pre className="mt-1 max-h-56 overflow-auto rounded bg-slate-50 p-2 text-[0.625rem] leading-snug text-slate-700">
              {JSON.stringify(detalhes, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function PaginaValidacao() {
  const { usuario } = useAutenticacao();
  const clienteQuery = useQueryClient();
  const [erroExecucao, setErroExecucao] = useState<string | null>(null);

  const podeExecutar = usuario ? ['ADMIN', 'ORGAO_CENTRAL', 'CONTROLE_INTERNO'].includes(usuario.perfil) : false;

  const { data, isLoading } = useQuery({
    queryKey: ['validacao', EXERCICIO],
    queryFn: () => api.get<RelatorioValidacao | null>(`/exercicios/${EXERCICIO}/validacao`),
  });

  const executar = useMutation({
    mutationFn: () => api.post<RelatorioValidacao>(`/exercicios/${EXERCICIO}/validacao`),
    onSuccess: (relatorio) => {
      setErroExecucao(null);
      clienteQuery.setQueryData(['validacao', EXERCICIO], relatorio);
      clienteQuery.invalidateQueries({ queryKey: ['painel'] });
    },
    onError: (erro: Error) => setErroExecucao(erro.message),
  });

  if (isLoading) return <Carregando />;

  const erros = data?.resultados.filter((r) => !r.aprovado && r.severidade === 'ERRO') ?? [];
  const alertas = data?.resultados.filter((r) => !r.aprovado && r.severidade === 'ALERTA') ?? [];
  const conformes = data?.resultados.filter((r) => r.aprovado) ?? [];

  return (
    <>
      <TituloPagina
        titulo="Validação legal da proposta orçamentária"
        descricao="Verificação automática do equilíbrio orçamentário, dos mínimos constitucionais de educação e saúde, dos limites da Lei de Responsabilidade Fiscal e da consistência das classificações."
        acoes={
          podeExecutar && (
            <Botao onClick={() => executar.mutate()} disabled={executar.isPending}>
              {executar.isPending ? 'Executando regras...' : 'Executar validação'}
            </Botao>
          )
        }
      />

      {erroExecucao && <Aviso>{erroExecucao}</Aviso>}

      {!data && (
        <Cartao>
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            Nenhuma validação registrada para o exercício. Execute a validação para apurar a conformidade da proposta.
          </p>
        </Cartao>
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador
              rotulo="Situação da proposta"
              valor={data.aprovado ? 'Apta ao envio' : 'Com impedimentos'}
              detalhe={`Executada em ${formatarDataHora(data.executadaEm)}`}
              tom={data.aprovado ? 'positivo' : 'negativo'}
            />
            <Indicador rotulo="Regras avaliadas" valor={String(data.totalRegras)} />
            <Indicador rotulo="Impedimentos" valor={String(data.totalErros)} tom={data.totalErros > 0 ? 'negativo' : 'positivo'} />
            <Indicador rotulo="Alertas" valor={String(data.totalAlertas)} tom={data.totalAlertas > 0 ? 'atencao' : 'positivo'} />
          </div>

          {erros.length > 0 && (
            <section className="mt-5">
              <h2 className="mb-2 text-sm font-semibold text-rose-700">Impedimentos que bloqueiam o envio à Assembleia Legislativa</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {erros.map((r) => (
                  <CartaoRegra key={r.regra} resultado={r} />
                ))}
              </div>
            </section>
          )}

          {alertas.length > 0 && (
            <section className="mt-5">
              <h2 className="mb-2 text-sm font-semibold text-amber-700">Alertas que exigem manifestação do órgão central</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {alertas.map((r) => (
                  <CartaoRegra key={r.regra} resultado={r} />
                ))}
              </div>
            </section>
          )}

          <section className="mt-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Regras atendidas</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {conformes.map((r) => (
                <CartaoRegra key={r.regra} resultado={r} />
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
