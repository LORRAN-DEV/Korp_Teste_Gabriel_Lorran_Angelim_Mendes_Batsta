# Estudo (Passo a Passo) - Do Clique ao Banco

Objetivo: explicar, com rastreabilidade, o que acontece quando voce clica em **"Finalizar e Imprimir"** e como isso percorre HTML -> TypeScript -> Services -> HTTP -> Go -> MySQL.

## 1) Onde esta o botao (HTML)

Arquivo:

- `korp-test/src/app/modules/billing/pages/nota-form/nota-form.component.html`

Ponto-chave:

- O botao aparece somente quando a nota esta `ABERTA` e ja tem `id` (ou seja, foi salva).
- No clique, chama `printNote()`.

## 2) O que acontece no clique (TypeScript)

Arquivo:

- `korp-test/src/app/modules/billing/pages/nota-form/nota-form.component.ts`

Resumo do fluxo em `printNote()`:

1. Faz guards:
   - bloqueia se ja esta processando (`loading`)
   - bloqueia se status diferente de `ABERTA`
   - exige que a nota tenha `id` e itens
2. Dispara baixas de estoque em paralelo (um request por item) usando `forkJoin`:
   - cada item chama `inventoryService.deductStock(produtoId, quantidade, numeroNF)`
3. Se algum item falhar:
   - o fluxo para
   - (quando aplicavel) estorna o que ja foi baixado com `inventoryService.restoreStock(...)`
4. Se todos baixarem com sucesso:
   - chama `billingService.printNote(id)` para marcar a nota como `IMPRESSA`
5. Final:
   - atualiza UI (status e mensagem)
   - chama `window.print()`

## 3) Como o TypeScript chama a API (Services)

### 3.1 InventoryService

Arquivo:

- `korp-test/src/app/modules/inventory/services/inventory.service.ts`

Responsabilidade:

- expor metodos do estoque para as telas (ex.: `deductStock`, `restoreStock`)
- delegar para o `ApiService`

### 3.2 BillingService

Arquivo:

- `korp-test/src/app/modules/billing/services/billing.service.ts`

Responsabilidade:

- expor metodos de faturamento para as telas (ex.: `printNote`, `finalizeAndPrint`)
- delegar para o `ApiService`

### 3.3 ApiService (central)

Arquivo:

- `korp-test/src/app/core/services/api.service.ts`

Responsabilidade:

- centralizar URLs base:
  - `http://localhost:8081/api` (faturamento)
  - `http://localhost:8082/api` (estoque)
- construir os endpoints:
  - baixa: `POST /api/produtos/:id/baixar-saldo`
  - estorno: `POST /api/produtos/:id/estornar-saldo`
  - imprimir: `PUT /api/notas/:id/imprimir`

## 4) O que acontece no backend Go

### 4.1 MS-Estoque (porta 8082)

Arquivo:

- `microservice-estoque/main.go`

Endpoint principal:

- `POST /api/produtos/:id/baixar-saldo`

Regras importantes:

- Concorrencia:
  - baixa atomica com `UPDATE ... WHERE quantidade_estoque >= ?` (nao fica negativo)
- Idempotencia (opcional, quando `numero_nota_fiscal` vem no payload):
  - registra uma movimentacao `SAIDA` ligada a NF
  - uma repeticao da mesma NF+produto nao baixa novamente (quando a unique constraint esta aplicada)

### 4.2 MS-Faturamento (porta 8081)

Arquivo:

- `microservice-faturamento/main.go`

Endpoints envolvidos:

- Criacao:
  - `POST /api/notas` gera numero sequencial e salva com status `ABERTA`
- Impressao:
  - `PUT /api/notas/:id/imprimir` valida status `ABERTA` e marca como `IMPRESSA`

Opcional:

- `POST /api/notas/:id/finalizar` (orquestracao no backend: baixa estoque + imprime)

## 5) O que entra no MySQL (Persistencia)

### Estoque (`schema estoque`)

- `produtos.quantidade_estoque` diminui ao imprimir
- `movimentacoes_estoque` registra saidas (e entradas quando estornar)

### Faturamento (`schema faturamento`)

- `notas_fiscais.status` muda de `ABERTA` para `IMPRESSA`
- `notas_fiscais_itens` guarda produto/quantidade/valor

## 6) Onde entram interceptors e notificacoes

- Interceptors:
  - ligam/desligam loading global
  - traduzem erros HTTP em mensagens amigaveis
- NotificationService:
  - mostra toast de sucesso/erro

Arquivos:

- `korp-test/src/app/core/interceptors/loading.interceptor.ts`
- `korp-test/src/app/core/interceptors/error.interceptor.ts`
- `korp-test/src/app/shared/services/notification.service.ts`

