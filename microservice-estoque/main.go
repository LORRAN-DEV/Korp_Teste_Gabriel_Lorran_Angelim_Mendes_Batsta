package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	_ "github.com/go-sql-driver/mysql"
)

var db *sql.DB

func init() {
	var err error
	// Mude "password" pela sua senha MySQL se for diferente
	db, err = sql.Open("mysql", "root:1234@tcp(localhost:3306)/estoque")
	if err != nil {
		log.Fatal("❌ Erro ao conectar ao banco:", err)
	}
	
	if err := db.Ping(); err != nil {
		log.Fatal("❌ Erro ao testar conexão:", err)
	}
	
	log.Println("✅ Conectado ao banco de estoque")
}

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		next(w, r)
	}
}

// GET /api/produtos
func getProdutos(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id, codigo, nome, preco_unitario, quantidade_estoque FROM produtos WHERE ativo = true")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	produtos := []map[string]interface{}{}
	for rows.Next() {
		var id int
		var codigo, nome string
		var preco float64
		var quantidade int

		err := rows.Scan(&id, &codigo, &nome, &preco, &quantidade)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		produto := map[string]interface{}{
			"id":                    id,
			"codigo":                codigo,
			"nome":                  nome,
			"preco_unitario":        preco,
			"quantidade_estoque":    quantidade,
		}
		produtos = append(produtos, produto)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(produtos)
}

// POST /api/produtos
func createProduto(w http.ResponseWriter, r *http.Request) {
	var produto map[string]interface{}
	json.NewDecoder(r.Body).Decode(&produto)

	result, err := db.Exec(
		"INSERT INTO produtos (codigo, nome, preco_unitario, quantidade_estoque, ativo) VALUES (?, ?, ?, ?, true)",
		produto["codigo"],
		produto["nome"],
		produto["preco_unitario"],
		produto["quantidade_estoque"],
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	id, _ := result.LastInsertId()
	produto["id"] = id
	produto["ativo"] = true

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(produto)
}

// GET /api/produtos/:id
func getProduto(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/produtos/")
	
	var codigo, nome string
	var preco float64
	var quantidade int
	
	err := db.QueryRow("SELECT codigo, nome, preco_unitario, quantidade_estoque FROM produtos WHERE id = ?", id).
		Scan(&codigo, &nome, &preco, &quantidade)
	
	if err != nil {
		http.Error(w, "Produto não encontrado", http.StatusNotFound)
		return
	}

	produto := map[string]interface{}{
		"id":                    id,
		"codigo":                codigo,
		"nome":                  nome,
		"preco_unitario":        preco,
		"quantidade_estoque":    quantidade,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(produto)
}

// PUT /api/produtos/:id
func updateProduto(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/produtos/")
	
	var produto map[string]interface{}
	json.NewDecoder(r.Body).Decode(&produto)

	_, err := db.Exec(
		"UPDATE produtos SET codigo = ?, nome = ?, preco_unitario = ?, quantidade_estoque = ? WHERE id = ?",
		produto["codigo"],
		produto["nome"],
		produto["preco_unitario"],
		produto["quantidade_estoque"],
		id,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	produto["id"] = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(produto)
}

// DELETE /api/produtos/:id
func deleteProduto(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/produtos/")
	
	_, err := db.Exec("DELETE FROM produtos WHERE id = ?", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"id":      id,
		"message": "Produto deletado com sucesso",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// POST /api/produtos/:id/baixar-saldo
func baixarSaldo(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/produtos/")
	id = strings.TrimSuffix(id, "/baixar-saldo")

	var qtd map[string]interface{}
	json.NewDecoder(r.Body).Decode(&qtd)
	quantidade := int(qtd["quantity"].(float64))

	var numeroNF string
	if v, ok := qtd["numero_nota_fiscal"]; ok {
		if s, ok := v.(string); ok {
			numeroNF = strings.TrimSpace(s)
		}
	}

	// Concorrência: baixa atômica (não deixa estoque ficar negativo).
	// Idempotência (opcional): quando vier numero_nota_fiscal, evita dupla baixa por NF+produto (unique index).
	if numeroNF != "" {
		tx, err := db.Begin()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer tx.Rollback()

		// 1) Registra movimentação; se já existe (unique), considera idempotente e sai sem baixar novamente.
		_, err = tx.Exec(
			"INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, motivo, numero_nota_fiscal) VALUES (?, 'SAIDA', ?, 'NF', ?)",
			id, quantidade, numeroNF,
		)
		if err != nil {
			// Erro 1062 (duplicate key) -> já baixou antes para essa NF+produto.
			if strings.Contains(err.Error(), "1062") {
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(map[string]interface{}{
					"id":        id,
					"message":   "Baixa de estoque já havia sido aplicada (idempotente)",
					"numero_nf": numeroNF,
				})
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// 2) Baixa (concorrente-safe)
		res, err := tx.Exec(
			"UPDATE produtos SET quantidade_estoque = quantidade_estoque - ? WHERE id = ? AND quantidade_estoque >= ?",
			quantidade, id, quantidade,
		)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			var exists int
			_ = tx.QueryRow("SELECT COUNT(1) FROM produtos WHERE id = ?", id).Scan(&exists)
			if exists == 0 {
				http.Error(w, "Produto não encontrado", http.StatusNotFound)
				return
			}
			http.Error(w, "Estoque insuficiente", http.StatusBadRequest)
			return
		}

		if err := tx.Commit(); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		res, err := db.Exec(
			"UPDATE produtos SET quantidade_estoque = quantidade_estoque - ? WHERE id = ? AND quantidade_estoque >= ?",
			quantidade, id, quantidade,
		)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			var exists int
			_ = db.QueryRow("SELECT COUNT(1) FROM produtos WHERE id = ?", id).Scan(&exists)
			if exists == 0 {
				http.Error(w, "Produto não encontrado", http.StatusNotFound)
				return
			}
			http.Error(w, "Estoque insuficiente", http.StatusBadRequest)
			return
		}
	}

	response := map[string]interface{}{
		"id":       id,
		"message": "Estoque decrementado com sucesso",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// POST /api/produtos/:id/estornar-saldo
func estornarSaldo(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/produtos/")
	id = strings.TrimSuffix(id, "/estornar-saldo")

	var qtd map[string]interface{}
	json.NewDecoder(r.Body).Decode(&qtd)
	quantidade := int(qtd["quantity"].(float64))

	var numeroNF string
	if v, ok := qtd["numero_nota_fiscal"]; ok {
		if s, ok := v.(string); ok {
			numeroNF = strings.TrimSpace(s)
		}
	}

	// Compensação + Idempotência: se vier numero_nota_fiscal, remove a marcação da SAIDA para permitir retry.
	if numeroNF != "" {
		tx, err := db.Begin()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer tx.Rollback()

		res, err := tx.Exec("UPDATE produtos SET quantidade_estoque = quantidade_estoque + ? WHERE id = ?", quantidade, id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			http.Error(w, "Produto não encontrado", http.StatusNotFound)
			return
		}

		// Remove um registro de SAIDA daquela NF (se existir).
		_, _ = tx.Exec(
			"DELETE FROM movimentacoes_estoque WHERE produto_id = ? AND tipo = 'SAIDA' AND numero_nota_fiscal = ? ORDER BY id DESC LIMIT 1",
			id, numeroNF,
		)

		if err := tx.Commit(); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		res, err := db.Exec("UPDATE produtos SET quantidade_estoque = quantidade_estoque + ? WHERE id = ?", quantidade, id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			http.Error(w, "Produto não encontrado", http.StatusNotFound)
			return
		}
	}

	response := map[string]interface{}{
		"id":       id,
		"message": "Estoque estornado com sucesso",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// POST /api/produtos/sugerir-reposicao
func sugerirReposicao(w http.ResponseWriter, r *http.Request) {
	// Buscar produtos com estoque baixo
	rows, err := db.Query(`
		SELECT id, codigo, nome, quantidade_estoque, quantidade_minima, preco_unitario 
		FROM produtos 
		WHERE ativo = true AND quantidade_estoque < quantidade_minima
		ORDER BY quantidade_estoque ASC
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Produto struct {
		ID              int    `json:"id"`
		Codigo          string `json:"codigo"`
		Nome            string `json:"nome"`
		EstoqueAtual    int    `json:"estoque_atual"`
		EstoqueMinimo   int    `json:"estoque_minimo"`
		PrecoUnitario   float64 `json:"preco_unitario"`
		FaltaQuantidade int    `json:"falta_quantidade"`
	}

	var produtos []Produto
	for rows.Next() {
		var p Produto
		err := rows.Scan(&p.ID, &p.Codigo, &p.Nome, &p.EstoqueAtual, &p.EstoqueMinimo, &p.PrecoUnitario)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		p.FaltaQuantidade = p.EstoqueMinimo - p.EstoqueAtual
		produtos = append(produtos, p)
	}

	if len(produtos) == 0 {
		response := map[string]interface{}{
			"message": "Nenhum produto com estoque baixo",
			"produtos": []Produto{},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// Enviar para API DeepSeek
	apiKey := os.Getenv("DEEPSEEK_API_KEY")
	if apiKey == "" {
		http.Error(w, "DEEPSEEK_API_KEY não configurada", http.StatusInternalServerError)
		return
	}

	// Preparar mensagem para DeepSeek
	produtosJSON, _ := json.MarshalIndent(produtos, "", "  ")
	prompt := fmt.Sprintf(`
Você é um consultor de logística. Analise os seguintes produtos com estoque baixo e sugira quais devem ser repostos imediatamente e em qual quantidade:

PRODUTOS COM ESTOQUE BAIXO:
%s

Considere:
- Qual produto é mais crítico (aquele que está mais longe do estoque mínimo)
- Qual produto tem maior custo de estoque parado
- Qual produto teoricamente mais vendido

Forneça uma resposta em JSON com este formato:
{
  "urgentes": [
    {
      "id": 1,
      "codigo": "P001",
      "motivo": "Produto X-vendido, estoque crítico"
    }
  ],
  "importante": [
    {
      "id": 2,
      "codigo": "P002",
      "motivo": "Produto com alto valor"
    }
  ],
  "resumo": "Recomendação geral"
}
`, string(produtosJSON))

	// Preparar request para DeepSeek (compatible com OpenAI)
	payload := map[string]interface{}{
		"model": "deepseek-chat",
		"max_tokens": 1024,
		"temperature": 0.7,
		"messages": []map[string]string{
			{
				"role": "user",
				"content": prompt,
			},
		},
	}

	payloadBytes, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "https://api.deepseek.com/chat/completions", bytes.NewBuffer(payloadBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, fmt.Sprintf("Erro ao conectar à API DeepSeek: %v", err), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		http.Error(w, fmt.Sprintf("Erro da API DeepSeek: %s", string(body)), http.StatusInternalServerError)
		return
	}

	// Parse response da DeepSeek (formato OpenAI)
	var deepseekResp map[string]interface{}
	json.Unmarshal(body, &deepseekResp)

	// Extrair conteúdo da análise
	var analise string
	if choices, ok := deepseekResp["choices"].([]interface{}); ok && len(choices) > 0 {
		if choice, ok := choices[0].(map[string]interface{}); ok {
			if message, ok := choice["message"].(map[string]interface{}); ok {
				if content, ok := message["content"].(string); ok {
					analise = content
				}
			}
		}
	}

	// Tentar fazer parse do JSON retornado
	var sugestoes map[string]interface{}
	
	// Se a resposta está em bloco de código markdown, extrair o JSON
	if strings.Contains(analise, "```json") {
		start := strings.Index(analise, "```json") + 7
		end := strings.LastIndex(analise, "```")
		if end > start {
			jsonStr := strings.TrimSpace(analise[start:end])
			json.Unmarshal([]byte(jsonStr), &sugestoes)
		}
	} else {
		json.Unmarshal([]byte(analise), &sugestoes)
	}

	response := map[string]interface{}{
		"produtos_com_estoque_baixo": produtos,
		"sugestoes_ia": sugestoes,
		"analise_completa": analise,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func main() {
	http.HandleFunc("/api/produtos", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			getProdutos(w, r)
		} else if r.Method == http.MethodPost {
			createProduto(w, r)
		}
	}))

	http.HandleFunc("/api/produtos/sugerir-reposicao", corsMiddleware(sugerirReposicao))

	http.HandleFunc("/api/produtos/", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/baixar-saldo") {
			baixarSaldo(w, r)
		} else if strings.Contains(r.URL.Path, "/estornar-saldo") {
			estornarSaldo(w, r)
		} else if r.Method == http.MethodGet {
			getProduto(w, r)
		} else if r.Method == http.MethodPut {
			updateProduto(w, r)
		} else if r.Method == http.MethodDelete {
			deleteProduto(w, r)
		}
	}))

	fmt.Println("🚀 MS-Estoque rodando em http://localhost:8082")
	log.Fatal(http.ListenAndServe(":8082", nil))
}
