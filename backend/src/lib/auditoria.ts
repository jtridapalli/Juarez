import { prisma } from './prisma.js';

export async function registrarAuditoria(entrada: {
  usuarioId?: number | null;
  acao: string;
  entidade: string;
  entidadeId?: string | number | null;
  detalhes?: unknown;
}) {
  await prisma.auditoria.create({
    data: {
      usuarioId: entrada.usuarioId ?? null,
      acao: entrada.acao,
      entidade: entrada.entidade,
      entidadeId: entrada.entidadeId === undefined || entrada.entidadeId === null ? null : String(entrada.entidadeId),
      detalhes: entrada.detalhes === undefined ? null : JSON.stringify(entrada.detalhes),
    },
  });
}
