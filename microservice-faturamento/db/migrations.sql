-- ========================================
-- BANCO DE DADOS: FATURAMENTO (OTIMIZADO)
-- ========================================
-- NOTA: Veja migrations-otimizado.sql para versão master consolidada
-- Este arquivo é apenas para referência do microserviço

CREATE DATABASE IF NOT EXISTS faturamento;
USE faturamento;

-- ========================================
-- Tabela de Notas Fiscais
-- ========================================

CREATE TABLE IF NOT EXISTS notas_fiscais (
  id INT PRIMARY KEY AUTO_INCREMENT,
  numero_nf VARCHAR(20) UNIQUE NOT NULL,
  cliente_nome VARCHAR(255) NOT NULL,
  cliente_cpf_cnpj VARCHAR(20),
  data_emissao DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  valor_total DECIMAL(12, 2) NOT NULL,
  status ENUM('ABERTA', 'IMPRESSA', 'CANCELADA') DEFAULT 'ABERTA' NOT NULL,
  estoque_deduzido BOOLEAN DEFAULT FALSE NOT NULL,
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ========================================
-- Tabela de Itens da Nota
-- ========================================

CREATE TABLE IF NOT EXISTS notas_fiscais_itens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nota_id INT NOT NULL,
  produto_id INT NOT NULL,
  quantidade INT NOT NULL,
  valor_unitario DECIMAL(12, 2) NOT NULL,
  valor_total DECIMAL(12, 2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (nota_id) REFERENCES notas_fiscais(id) ON DELETE CASCADE,
  INDEX idx_nota_criado (nota_id, criado_em)
);

-- ========================================
-- Índices Otimizados
-- ========================================

CREATE INDEX idx_notas_cliente ON notas_fiscais(cliente_cpf_cnpj);
CREATE INDEX idx_notas_data ON notas_fiscais(data_emissao);
CREATE INDEX idx_notas_status ON notas_fiscais(status);
CREATE INDEX idx_itens_produto ON notas_fiscais_itens(produto_id);
CREATE INDEX idx_notas_status_data ON notas_fiscais(status, data_emissao DESC);
CREATE INDEX idx_notas_cliente_status ON notas_fiscais(cliente_cpf_cnpj, status, data_emissao DESC);
CREATE INDEX idx_itens_nota_produto ON notas_fiscais_itens(nota_id, produto_id);
CREATE INDEX idx_notas_status_criado ON notas_fiscais(status, criado_em DESC);

-- ========================================
-- DADOS DE EXEMPLO
-- ========================================

INSERT INTO notas_fiscais (numero_nf, cliente_nome, cliente_cpf_cnpj, valor_total, status) VALUES
('#00001', 'João Silva', '111.111.111-11', 1000.00, 'ABERTA'),
('#00002', 'Maria Santos', '222.222.222-22', 2500.00, 'IMPRESSA');
