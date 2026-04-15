-- ========================================
-- MIGRACOES OTIMIZADAS - PROJETO KORP TEST
-- ========================================
-- Arquivo unificado de migrations (ESTOQUE + FATURAMENTO)
-- ========================================

-- ========================================
-- BANCO DE DADOS: ESTOQUE
-- ========================================

CREATE DATABASE IF NOT EXISTS estoque;
USE estoque;

-- ========================================
-- Tabela de Produtos
-- ========================================

CREATE TABLE IF NOT EXISTS produtos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  preco_unitario DECIMAL(12, 2) NOT NULL,
  quantidade_estoque INT DEFAULT 0 NOT NULL,
  quantidade_minima INT DEFAULT 10 NOT NULL,
  ativo BOOLEAN DEFAULT TRUE NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ========================================
-- Tabela de Movimentacao de Estoque
-- ========================================

CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
  id INT PRIMARY KEY AUTO_INCREMENT,
  produto_id INT NOT NULL,
  tipo ENUM('ENTRADA', 'SAIDA') NOT NULL,
  quantidade INT NOT NULL,
  motivo VARCHAR(255),
  numero_nota_fiscal VARCHAR(20),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
  INDEX idx_produto_data (produto_id, criado_em),
  -- Idempotencia (opcional): evita dupla baixa do mesmo produto para a mesma nota fiscal.
  UNIQUE KEY uniq_nf_produto_tipo (produto_id, tipo, numero_nota_fiscal)
);

-- ========================================
-- Indices Otimizados - ESTOQUE
-- ========================================

CREATE INDEX idx_produtos_nome ON produtos(nome);
CREATE INDEX idx_produtos_ativo ON produtos(ativo);
CREATE INDEX idx_movimentacoes_tipo ON movimentacoes_estoque(tipo);
CREATE INDEX idx_movimentacoes_nf ON movimentacoes_estoque(numero_nota_fiscal);
CREATE INDEX idx_produtos_criado ON produtos(criado_em);

CREATE INDEX idx_produtos_ativo_criado ON produtos(ativo, criado_em DESC);
CREATE INDEX idx_movimentacoes_tipo_data ON movimentacoes_estoque(tipo, criado_em DESC);

-- ========================================
-- DADOS DE EXEMPLO - ESTOQUE
-- ========================================

INSERT INTO produtos (codigo, nome, descricao, preco_unitario, quantidade_estoque, quantidade_minima) VALUES
('P001', 'Notebook Dell', 'Notebook Dell Inspiron 15', 3500.00, 10, 2),
('P002', 'Mouse Logitech', 'Mouse sem fio Logitech M705', 150.00, 50, 10),
('P003', 'Teclado Mecanico', 'Teclado mecanico RGB Corsair', 450.00, 25, 5),
('P004', 'Monitor LG 24"', 'Monitor LG 24 polegadas Full HD', 800.00, 8, 2),
('P005', 'Webcam HD', 'Webcam 1080p com microfone', 250.00, 15, 3);

-- ========================================
-- BANCO DE DADOS: FATURAMENTO
-- ========================================

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
-- Indices Otimizados - FATURAMENTO
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
-- DADOS DE EXEMPLO - FATURAMENTO
-- ========================================

INSERT INTO notas_fiscais (numero_nf, cliente_nome, cliente_cpf_cnpj, valor_total, status) VALUES
('#00001', 'Joao Silva', '111.111.111-11', 1000.00, 'ABERTA'),
('#00002', 'Maria Santos', '222.222.222-22', 2500.00, 'IMPRESSA');

-- ========================================
-- FIM DAS MIGRACOES
-- ========================================
