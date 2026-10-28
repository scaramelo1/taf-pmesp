/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  descreverDiferenca,
  formatarPercentual,
  formatarTempo,
  formatarValor,
  lerTempo,
  lerValor,
} from '../formato.ts';
import { regrasCandidato } from '../regras/candidato.ts';

describe('lerTempo', () => {
  it('formatos aceitos', () => {
    assert.equal(lerTempo('12:30'), 750);
    assert.equal(lerTempo("12'30\""), 750);
    assert.equal(lerTempo('1:05'), 65);
    assert.equal(lerTempo('1m05s'), 65);
    assert.equal(lerTempo('8,25'), 8.25);
    assert.equal(lerTempo('8.25'), 8.25);
    assert.equal(lerTempo('8s25'), 8.25);
    assert.equal(lerTempo('9,5'), 9.5);
    assert.equal(lerTempo(' 13 '), 13);
    assert.equal(lerTempo('12:30,5'), 750.5);
  });

  it('formatos inválidos', () => {
    assert.equal(lerTempo(''), null);
    assert.equal(lerTempo('abc'), null);
    assert.equal(lerTempo('12:75'), null);
    assert.equal(lerTempo('8,255'), null);
  });
});

describe('formatarTempo', () => {
  it('minutos e segundos', () => {
    assert.equal(formatarTempo(750), '12:30');
    assert.equal(formatarTempo(65), '1:05');
    assert.equal(formatarTempo(780), '13:00');
    assert.equal(formatarTempo(8.25), '8,25 s');
    assert.equal(formatarTempo(9.5), '9,50 s');
    assert.equal(formatarTempo(7), '7 s');
  });

  it('ida e volta', () => {
    for (const t of ['12:30', '1:05', '8,25 s', '0,01 s']) {
      assert.equal(formatarTempo(lerTempo(t.replace(' s', ''))!), t);
    }
  });
});

describe('lerValor e formatarValor', () => {
  it('repetições só inteiras', () => {
    assert.equal(lerValor('reps', '36'), 36);
    assert.equal(lerValor('reps', '3.5'), null);
    assert.equal(lerValor('reps', ''), null);
    assert.equal(formatarValor('reps', 1), '1 rep');
    assert.equal(formatarValor('reps', 4), '4 reps');
  });
});

describe('descreverDiferenca', () => {
  const m = regrasCandidato('M', 'soldado');
  const abdominal = m.find((r) => r.exercicio === 'abdominal')!;
  const corrida = m.find((r) => r.exercicio === 'corrida2400')!;

  it('sobra, falta e limite', () => {
    assert.equal(descreverDiferenca(abdominal, 4), 'sobram 4 reps');
    assert.equal(descreverDiferenca(abdominal, -1), 'falta 1 rep');
    assert.equal(descreverDiferenca(corrida, -6), 'faltam 6 s');
    assert.equal(descreverDiferenca(corrida, 70), 'sobram 1:10');
    assert.equal(descreverDiferenca(corrida, 0), 'no limite');
  });

  it('percentual', () => {
    assert.equal(formatarPercentual(4 / 36), '+11,1%');
    assert.equal(formatarPercentual(-0.05), '-5%');
    assert.equal(formatarPercentual(0), '0%');
  });
});
