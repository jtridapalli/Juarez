import { useState } from 'react';
import { EXERCICIO } from '../api';
import { useAutenticacao } from '../autenticacao';
import { Aviso, Botao } from '../componentes/base';

const ACESSOS = [
  { email: 'orcamento@sepl.pr.gov.br', descricao: 'Órgão central de orçamento (SEPL)' },
  { email: 'gos@sesa.pr.gov.br', descricao: 'Unidade orçamentária (SESA)' },
  { email: 'auditoria@cge.pr.gov.br', descricao: 'Controle interno (CGE)' },
  { email: 'consulta@pr.gov.br', descricao: 'Consulta' },
];

export function PaginaLogin() {
  const { entrar } = useAutenticacao();
  const [email, setEmail] = useState('orcamento@sepl.pr.gov.br');
  const [senha, setSenha] = useState('loa2027');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function submeter(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível autenticar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-linear-to-br from-parana-900 via-parana-800 to-parana-600 p-6">
      <div className="w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl md:grid md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-parana-900 p-8 text-white md:flex">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-parana-200">Governo do Estado do Paraná</p>
            <h1 className="mt-3 text-2xl font-semibold leading-tight">
              Sistema de Elaboração da Lei Orçamentária Anual
            </h1>
            <p className="mt-2 text-sm text-parana-100">Exercício financeiro de {EXERCICIO}</p>
          </div>
          <ul className="mt-8 space-y-2 text-xs text-parana-100">
            <li>· Captação das propostas das unidades orçamentárias</li>
            <li>· Verificação dos mínimos constitucionais e dos limites da LRF</li>
            <li>· Geração dos anexos da Lei 4.320/1964 e do projeto de lei</li>
          </ul>
          <p className="mt-8 text-[0.6875rem] text-parana-300">
            Secretaria de Estado do Planejamento · Secretaria de Estado da Fazenda
          </p>
        </div>

        <form onSubmit={submeter} className="p-8">
          <h2 className="text-base font-semibold text-slate-900">Identificação do usuário</h2>
          <p className="mt-1 text-xs text-slate-500">Informe as credenciais institucionais para acessar o sistema.</p>

          <label className="mt-5 block text-xs font-semibold text-slate-700" htmlFor="email">
            Endereço de e-mail
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-parana-600 focus:outline-none"
          />

          <label className="mt-3 block text-xs font-semibold text-slate-700" htmlFor="senha">
            Senha
          </label>
          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-parana-600 focus:outline-none"
          />

          {erro && (
            <div className="mt-3">
              <Aviso>{erro}</Aviso>
            </div>
          )}

          <div className="mt-5">
            <Botao type="submit" disabled={enviando}>
              {enviando ? 'Autenticando...' : 'Entrar no sistema'}
            </Botao>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400">
              Perfis disponíveis na carga de referência
            </p>
            <ul className="mt-2 space-y-1">
              {ACESSOS.map((acesso) => (
                <li key={acesso.email}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(acesso.email);
                      setSenha('loa2027');
                    }}
                    className="text-left text-xs text-parana-700 hover:underline"
                  >
                    {acesso.descricao} — {acesso.email}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[0.6875rem] text-slate-400">Senha padrão da carga de referência: loa2027</p>
          </div>
        </form>
      </div>
    </div>
  );
}
