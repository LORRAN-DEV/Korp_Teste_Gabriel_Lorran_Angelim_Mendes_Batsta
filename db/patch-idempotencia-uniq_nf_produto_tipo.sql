-- Idempotencia "de verdade" no banco (ESTOQUE)
-- Objetivo: impedir dupla baixa do mesmo produto para a mesma NF.
--
-- Regra implementada:
--   UNIQUE (produto_id, tipo, numero_nota_fiscal)
--
-- Como usar:
--   Execute este script no seu MySQL (Workbench/CLI).

USE estoque;

-- 1) Diagnostico: existem duplicidades que impedem criar a UNIQUE?
-- (A UNIQUE permite varios NULL, por isso filtramos NF vazia/NULL.)
SELECT
  produto_id,
  tipo,
  numero_nota_fiscal,
  COUNT(*) AS total
FROM movimentacoes_estoque
WHERE numero_nota_fiscal IS NOT NULL
  AND numero_nota_fiscal <> ''
GROUP BY produto_id, tipo, numero_nota_fiscal
HAVING COUNT(*) > 1;

-- 2) Se a query acima nao retornar linhas, pode aplicar a constraint:
ALTER TABLE movimentacoes_estoque
  ADD UNIQUE KEY uniq_nf_produto_tipo (produto_id, tipo, numero_nota_fiscal);

-- 3) Se der erro de duplicidade (1062), voce precisa limpar os duplicados primeiro.
-- Exemplo (AJUSTE ANTES DE RODAR):
--   DELETE m
--   FROM movimentacoes_estoque m
--   JOIN (
--     SELECT MIN(id) AS keep_id, produto_id, tipo, numero_nota_fiscal
--     FROM movimentacoes_estoque
--     WHERE numero_nota_fiscal IS NOT NULL AND numero_nota_fiscal <> ''
--     GROUP BY produto_id, tipo, numero_nota_fiscal
--     HAVING COUNT(*) > 1
--   ) d
--     ON d.produto_id = m.produto_id
--    AND d.tipo = m.tipo
--    AND d.numero_nota_fiscal = m.numero_nota_fiscal
--    AND m.id <> d.keep_id;
