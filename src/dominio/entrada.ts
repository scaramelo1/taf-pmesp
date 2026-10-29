import { lerValor } from './formato.ts';
import type { Medida } from './tipos.ts';

/**
 * Como o valor é digitado:
 * - inteiro: repetições
 * - decimal: tempos curtos com centésimos (50 m, isometria) → "8,25"
 * - minseg: tempos longos em dois campos (2400 m, natação) → 12 : 30
 */
export type TipoEntrada = 'inteiro' | 'decimal' | 'minseg';

export interface Entrada {
  texto: string;
  min: string;
  seg: string;
}

export const ENTRADA_VAZIA: Entrada = { texto: '', min: '', seg: '' };

export function tipoEntrada(medida: Medida): TipoEntrada {
  if (medida.unidade === 'reps') return 'inteiro';
  return medida.exercicio === 'corrida2400' || medida.exercicio === 'natacao50' ? 'minseg' : 'decimal';
}

/** undefined = campo vazio; null = preenchido com valor inválido. */
export function lerEntrada(regra: Medida, e: Entrada): number | null | undefined {
  let valor: number | null;

  if (tipoEntrada(regra) === 'minseg') {
    const min = e.min.trim();
    const seg = e.seg.trim();
    if (!min && !seg) return undefined;
    if (!/^\d*$/.test(min) || !/^\d{1,2}$/.test(seg) || Number(seg) >= 60) return null;
    valor = Number(min || 0) * 60 + Number(seg);
  } else {
    if (!e.texto.trim()) return undefined;
    valor = lerValor(regra.unidade, e.texto);
  }

  // Tempo zerado não existe, exceto onde 0 marca "não realizado".
  if (valor !== null && regra.direcao === 'menor' && (regra.aceitaZero ? valor < 0 : valor <= 0)) return null;
  return valor;
}
