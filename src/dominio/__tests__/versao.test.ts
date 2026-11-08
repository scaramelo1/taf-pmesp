import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { compararVersoes, precisaAtualizar, versaoValida } from '../versao.ts';

describe('versões do app', () => {
  it('compara por número, não por texto', () => {
    assert.ok(compararVersoes('1.10.0', '1.9.0') > 0);
    assert.ok(compararVersoes('1.1.0', '1.2.0') < 0);
    assert.equal(compararVersoes('1.2', '1.2.0'), 0);
  });

  it('só pede para atualizar quando a publicada é mais nova', () => {
    assert.equal(precisaAtualizar('1.1.0', '1.2.0'), true);
    assert.equal(precisaAtualizar('1.2.0', '1.2.0'), false);
    assert.equal(precisaAtualizar('1.3.0', '1.2.0'), false);
    assert.equal(precisaAtualizar('1.1.0', null), false);
    assert.equal(precisaAtualizar(undefined, '1.2.0'), false);
  });

  it('recusa versão fora do formato', () => {
    assert.equal(versaoValida('1.2.0'), true);
    assert.equal(versaoValida('1.2.0<script>'), false);
    assert.equal(versaoValida(''), false);
  });
});
