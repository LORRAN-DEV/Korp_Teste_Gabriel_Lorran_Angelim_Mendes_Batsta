# Detalhamento Tecnico

## Angular

### Estrutura (alto nivel)

- `core/services/api.service.ts`: centraliza endpoints dos microsservicos
- `core/interceptors/*`: interceptors globais (loading/erro)
- `shared/services/notification.service.ts`: feedback ao usuario (toasts)
- `modules/inventory/*`: telas/servicos de produtos
- `modules/billing/*`: telas/servicos de notas fiscais

### Ciclos de vida usados

- `ngOnInit`: carregar dados iniciais (produtos/notas/detalhes)
- `DestroyRef` + `takeUntilDestroyed`: cancelar subscriptions ao destruir componente

### RxJS (como e onde)

- `forkJoin`: paralelismo (ex.: baixar saldo de multiplos itens)
- `switchMap`: encadear passos (estoque -> faturamento)
- `catchError`: tratar erro por item e decidir compensacao/retorno
- `finalize`: encerrar estados de loading independentemente de sucesso/erro
- `timeout`: proteger chamadas longas (ex.: sugestoes de IA, se habilitado)

### HttpClient + Interceptors

- Interceptors registram e exibem:
  - indicador de processamento
  - mensagens amigaveis por status HTTP (0/400/404/500)
- `provideHttpClient(withFetch(), withInterceptorsFromDi())` no root (melhor compatibilidade com SSR/hydration)

## Golang

### Dependencias

- `go.mod` / `go.sum` (Go Modules)
- Driver MySQL: `github.com/go-sql-driver/mysql`

### Frameworks

- API HTTP com `net/http` (sem framework adicional)
- Persistencia com `database/sql`

### Tratamento de erros

- Validacao de entrada (campos obrigatorios)
- Respostas HTTP consistentes:
  - `400` para regra de negocio (ex.: estoque insuficiente / nota sem itens / status invalido)
  - `404` para recurso inexistente
  - `409` para conflito (ex.: nota em processamento via lock)
  - `500` para erro inesperado

### Concorrencia e idempotencia (opcionais)

- Concorrencia no estoque:
  - baixa atomica via `UPDATE ... WHERE quantidade_estoque >= ?`
- Idempotencia no estoque:
  - constraint unica por `numero_nota_fiscal + produto_id + tipo`
- Concorrencia na finalizacao de nota:
  - lock por nota (MySQL `GET_LOCK`) para evitar dupla finalizacao simultanea

## Banco de Dados

### Estoque

- Tabelas:
  - `produtos`
  - `movimentacoes_estoque`
- Indices:
  - busca por nome/ativo e historico por produto/data
- Opcional (idempotencia):
  - `UNIQUE KEY uniq_nf_produto_tipo (produto_id, tipo, numero_nota_fiscal)`

### Faturamento

- Tabelas:
  - `notas_fiscais` (status: `ABERTA | IMPRESSA | CANCELADA`)
  - `notas_fiscais_itens`

