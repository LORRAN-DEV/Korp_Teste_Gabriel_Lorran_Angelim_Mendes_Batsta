-- ========================================
-- BANCO DE DADOS: ESTOQUE (OTIMIZADO)
-- ========================================
-- NOTA: Veja migrations-otimizado.sql para versão master consolidada
-- Este arquivo é apenas para referência do microserviço

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
-- Tabela de Movimentação de Estoque
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
  UNIQUE KEY uniq_nf_produto_tipo (produto_id, tipo, numero_nota_fiscal)
);

-- ========================================
-- Índices Otimizados
-- ========================================

CREATE INDEX idx_produtos_nome ON produtos(nome);
CREATE INDEX idx_produtos_ativo ON produtos(ativo);
CREATE INDEX idx_movimentacoes_tipo ON movimentacoes_estoque(tipo);
CREATE INDEX idx_movimentacoes_nf ON movimentacoes_estoque(numero_nota_fiscal);
CREATE INDEX idx_produtos_criado ON produtos(criado_em);
CREATE INDEX idx_produtos_ativo_criado ON produtos(ativo, criado_em DESC);
CREATE INDEX idx_movimentacoes_tipo_data ON movimentacoes_estoque(tipo, criado_em DESC);

-- ========================================
-- DADOS DE EXEMPLO
-- ========================================

INSERT INTO produtos (codigo, nome, descricao, preco_unitario, quantidade_estoque, quantidade_minima) VALUES
('P001', 'Notebook Dell', 'Notebook Dell Inspiron 15', 3500.00, 10, 2),
('P002', 'Mouse Logitech', 'Mouse sem fio Logitech M705', 150.00, 50, 10),
('P003', 'Teclado Mecânico', 'Teclado mecânico RGB Corsair', 450.00, 25, 5),
('P004', 'Monitor LG 24"', 'Monitor LG 24 polegadas Full HD', 800.00, 8, 2),
('P005', 'Webcam HD', 'Webcam 1080p com microfone', 250.00, 15, 3);
