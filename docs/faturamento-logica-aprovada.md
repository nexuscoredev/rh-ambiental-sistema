# Lógica de faturamento — racional aprovado (congelado)

**Versão:** `2026-05-22.v1`  
**Estado:** aprovado pelo negócio como racional final do módulo Faturamento.

Este documento é a **memória oficial** do projeto. Agentes, revisões de PR e alterações de código devem tratá-lo como contrato de produto.

---

## Objetivo das três visões de valor

### 1. Total referência (contrato/regra) — Ajuste de valores

- **Ficheiros:** `faturamentoPrecoContrato.ts`, `faturamentoConsolidacaoMtr.ts` (`calcularPrecoContratoMtrConsolidado`).
- **Escopo:** uma **MTR consolidada** (vários tickets na mesma MTR).
- **Regra:**
  - Caminhão + equipamento faturados **uma vez** por MTR.
  - Cada ticket/resíduo soma valor com **faturamento mínimo por tipo de resíduo** no contrato.
- **Uso:** comparar com o valor informado manualmente; **não** é o total do relatório nem da NF do lote inteiro.

### 2. Relatório de medição — lote do cliente

- **Ficheiros:** `faturamentoRelatorioMedicao.ts`, `faturamentoEsteira.ts` (agrupamento ~30 dias).
- **Escopo:** todas as coletas elegíveis do cliente no período (várias MTRs).
- **Regra:**
  - Uma linha por coleta.
  - **Frete** (caminhão + equipamento) apenas na **primeira coleta de cada MTR** (`coletasComFretePorMtr`).
  - Demais coletas da mesma MTR: só resíduo (peso × taxa + mínimo na linha).
  - Total do relatório = soma das linhas (ex.: cenário ACTEGA: referência ~R$ 4.604 numa MTR ≠ R$ 10.014 no lote de 8 coletas — **correto**).

### 3. Total a faturar — resumo editável

- **Ficheiros:** `faturamentoDesvinculacao.ts`, `faturamentoDetalheConta.ts`, persistência em `faturamento_registros`.
- Valor operacional/financeiro após ajustes, acréscimos e descontos; pode divergir da referência por decisão humana.

---

## Esteira (ordem conceptual)

1. Controle de massa / conferência de peso  
2. Fila operacional → ajuste de valores (por MTR consolidada quando aplicável)  
3. Relatório de medição (cliente) → aprovação  
4. NF / contas a receber  

Não inverter agregações entre etapas (ex.: somar relatório inteiro no modal de uma MTR).

---

## Ficheiros protegidos

Lista mantida em código: `src/lib/faturamentoLogicaCongelada.manifest.ts`.

Alterações exigem:

1. Decisão explícita do responsável de produto/faturamento.  
2. Atualização deste documento (nova versão `YYYY-MM-DD.vN`).  
3. Atualização de `faturamentoLogicaCongelada.manifest.ts` e testes em `faturamentoLogicaCongelada.test.ts`.  
4. CI / local com aprovação explícita:
   - `FATURAMENTO_LOGICA_APROVADA=1 npm run guard:faturamento`, ou
   - mensagem de commit contendo `[faturamento-logica]` (o workflow de CI reconhece este marcador).

---

## Comandos de segurança

```bash
npm run test:faturamento-guard   # testes de contrato (obrigatório passar)
npm run guard:faturamento        # aviso/bloqueio se ficheiros protegidos mudaram
```

Em PRs que tocam faturamento, o CI executa estes passos após `npm test`.
