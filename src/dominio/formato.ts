import type { Medida, Modo, Unidade } from './tipos.ts';

/**
 * Lê um tempo digitado e devolve segundos.
 * Aceita "12:30", "12'30\"", "1:05", "8,25", "8.25", "8s25", "13".
 */
export function lerTempo(texto: string): number | null {
  const t = texto
    .trim()
    .replace(/\s+/g, '')
    .replace(/["”]/g, '')
    .replace(/['’m]/g, ':')
    .replace(/s(?=\d)/, ',')
    .replace(/s$/, '');
  const m = /^(?:(\d+):)?(\d+)(?:[.,](\d{1,2}))?$/.exec(t);
  if (!m) return null;

  const minutos = m[1] ? Number(m[1]) : 0;
  const segundos = Number(m[2]);
  if (m[1] && segundos >= 60) return null;
  const centesimos = m[3] ? Number(m[3].padEnd(2, '0')) : 0;
  return minutos * 60 + segundos + centesimos / 100;
}

/** 750 → "12:30" | 8.25 → "8,25 s" | 65 → "1:05" | 7 → "7 s" */
export function formatarTempo(segundos: number): string {
  const total = Math.round(segundos * 100);
  const min = Math.floor(total / 6000);
  const resto = total - min * 6000;
  const s = Math.floor(resto / 100);
  const c = resto % 100;
  const fracao = c ? ',' + String(c).padStart(2, '0') : '';
  return min > 0 ? `${min}:${String(s).padStart(2, '0')}${fracao}` : `${s}${fracao} s`;
}

export function lerValor(unidade: Unidade, texto: string): number | null {
  if (unidade === 'segundos') return lerTempo(texto);
  const t = texto.trim();
  return /^\d+$/.test(t) ? Number(t) : null;
}

export function formatarValor(unidade: Unidade, valor: number): string {
  if (unidade === 'segundos') return formatarTempo(valor);
  return `${valor} ${valor === 1 ? 'rep' : 'reps'}`;
}

/** Ex.: "faltam 6 s", "sobram 4 reps", "no limite". */
export function descreverDiferenca(regra: Pick<Medida, 'unidade'>, diferenca: number): string {
  if (diferenca === 0) return 'no limite';
  const quanto = formatarValor(regra.unidade, Math.abs(diferenca));
  const plural = Math.abs(diferenca) === 1 ? '' : 'm';
  return diferenca > 0 ? `sobra${plural} ${quanto}` : `falta${plural} ${quanto}`;
}

export function formatarPercentual(fracao: number): string {
  const p = Math.round(fracao * 1000) / 10;
  return `${p > 0 ? '+' : ''}${String(p).replace('.', ',')}%`;
}

/** Nota geral de um treino: margem média (candidato) ou soma de pontos (efetivo). */
export function formatarNota(modo: Modo, nota: number): string {
  return modo === 'candidato' ? formatarPercentual(nota) : `${Math.round(nota)} pts`;
}

/** Diferença de nota entre treinos, sempre com sinal: "+1,5%", "-10 pts". */
export function formatarVariacao(modo: Modo, variacao: number): string {
  if (modo === 'candidato') return formatarPercentual(variacao);
  const v = Math.round(variacao);
  return `${v > 0 ? '+' : ''}${v} pts`;
}

/** Marca curta para eixo de gráfico: "12", "8,25 s", "13:00". */
export function formatarEixo(unidade: Unidade, valor: number): string {
  return unidade === 'segundos' ? formatarTempo(valor) : String(Math.round(valor));
}
