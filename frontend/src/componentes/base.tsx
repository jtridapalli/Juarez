import type { ReactNode } from 'react';

export function Cartao({
  titulo,
  descricao,
  acoes,
  children,
  className = '',
}: {
  titulo?: string;
  descricao?: string;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {(titulo || acoes) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            {titulo && <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>}
            {descricao && <p className="mt-0.5 text-xs text-slate-500">{descricao}</p>}
          </div>
          {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Indicador({
  rotulo,
  valor,
  detalhe,
  tom = 'neutro',
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  tom?: 'neutro' | 'positivo' | 'atencao' | 'negativo' | 'destaque';
}) {
  const tons: Record<string, string> = {
    neutro: 'border-slate-200 bg-white',
    destaque: 'border-parana-200 bg-parana-50',
    positivo: 'border-emerald-200 bg-emerald-50',
    atencao: 'border-amber-200 bg-amber-50',
    negativo: 'border-rose-200 bg-rose-50',
  };
  const corValor: Record<string, string> = {
    neutro: 'text-slate-900',
    destaque: 'text-parana-800',
    positivo: 'text-emerald-700',
    atencao: 'text-amber-700',
    negativo: 'text-rose-700',
  };
  return (
    <div className={`rounded-lg border px-4 py-3 shadow-sm ${tons[tom]}`}>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${corValor[tom]}`}>{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-slate-500">{detalhe}</p>}
    </div>
  );
}

export function Etiqueta({
  children,
  tom = 'neutro',
}: {
  children: ReactNode;
  tom?: 'neutro' | 'positivo' | 'atencao' | 'negativo' | 'info';
}) {
  const tons: Record<string, string> = {
    neutro: 'bg-slate-100 text-slate-700 ring-slate-200',
    positivo: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    atencao: 'bg-amber-50 text-amber-800 ring-amber-200',
    negativo: 'bg-rose-50 text-rose-700 ring-rose-200',
    info: 'bg-parana-50 text-parana-700 ring-parana-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ring-1 ${tons[tom]}`}>
      {children}
    </span>
  );
}

export function Botao({
  children,
  onClick,
  tipo = 'primario',
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  tipo?: 'primario' | 'secundario' | 'perigo' | 'sucesso';
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const tipos: Record<string, string> = {
    primario: 'bg-parana-700 text-white hover:bg-parana-800',
    secundario: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    perigo: 'bg-rose-600 text-white hover:bg-rose-700',
    sucesso: 'bg-emerald-600 text-white hover:bg-emerald-700',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${tipos[tipo]}`}
    >
      {children}
    </button>
  );
}

export function Carregando({ mensagem = 'Carregando informações...' }: { mensagem?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-parana-600 border-t-transparent" />
      {mensagem}
    </div>
  );
}

export function Aviso({ children, tom = 'erro' }: { children: ReactNode; tom?: 'erro' | 'info' | 'sucesso' }) {
  const tons: Record<string, string> = {
    erro: 'border-rose-200 bg-rose-50 text-rose-800',
    info: 'border-parana-200 bg-parana-50 text-parana-800',
    sucesso: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
  return <div className={`rounded-md border px-3 py-2 text-xs ${tons[tom]}`}>{children}</div>;
}

export function Vazio({ mensagem }: { mensagem: string }) {
  return <p className="px-4 py-8 text-center text-sm text-slate-500">{mensagem}</p>;
}

export function TituloPagina({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{titulo}</h1>
        {descricao && <p className="mt-0.5 max-w-3xl text-xs text-slate-500">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

export function BarraProgresso({ percentual }: { percentual: number }) {
  const limitado = Math.min(Math.max(percentual, 0), 100);
  const cor = limitado >= 99.5 ? 'bg-rose-500' : limitado >= 90 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${limitado}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-600">{limitado.toFixed(1).replace('.', ',')}%</span>
    </div>
  );
}
