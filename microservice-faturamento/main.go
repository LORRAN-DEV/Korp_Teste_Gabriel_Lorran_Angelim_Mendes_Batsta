package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	_ "github.com/go-sql-driver/mysql"
)

var db *sql.DB

const estoqueURL = "http://localhost:8082"

var estoqueDeduzidoColExists bool

func init() {
	var err error
	db, err = sql.Open("mysql", "root:1234@tcp(localhost:3306)/faturamento")
	if err != nil {
		log.Fatal("❌ Erro ao conectar ao banco:", err)
	}
	if err := db.Ping(); err != nil {
		log.Fatal("❌ Erro ao testar conexão:", err)
	}
	log.Println("✅ Conectado ao banco de faturamento")

	// Compatibilidade: se o schema não tiver a coluna `estoque_deduzido`, evitamos SQLs que a referenciem.
	var count int
	if err := db.QueryRow(`
		SELECT COUNT(1)
		FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE()
		  AND TABLE_NAME = 'notas_fiscais'
		  AND COLUMN_NAME = 'estoque_deduzido'
	`).Scan(&count); err == nil {
		estoqueDeduzidoColExists = count > 0
	}
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

// GET /api/notas
func getNotas(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id, numero_nf, cliente_nome, valor_total, status FROM notas_fiscais")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	notas := []map[string]interface{}{}
	for rows.Next() {
		var id int
		var numero_nf, cliente_nome, status string
		var valor_total float64
		if err := rows.Scan(&id, &numero_nf, &cliente_nome, &valor_total, &status); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		notas = append(notas, map[string]interface{}{
			"id":           id,
			"numero_nf":    numero_nf,
			"cliente_nome": cliente_nome,
			"valor_total":  valor_total,
			"status":       status,
		})
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(notas)
}

// POST /api/notas
func createNota(w http.ResponseWriter, r *http.Request) {
	var nota map[string]interface{}
	json.NewDecoder(r.Body).Decode(&nota)

	// Numeração sequencial (concorrente-safe).
	// Gera no backend para evitar dependência do frontend e garantir sequencialidade real.
	var gotLock int
	if err := db.QueryRow("SELECT GET_LOCK('nf_numero_seq', 5)").Scan(&gotLock); err != nil || gotLock != 1 {
		http.Error(w, "Não foi possível gerar numeração da nota. Tente novamente.", http.StatusConflict)
		return
	}
	defer func() { _, _ = db.Exec("SELECT RELEASE_LOCK('nf_numero_seq')") }()

	var next int
	if err := db.QueryRow("SELECT COALESCE(MAX(CAST(REPLACE(numero_nf, '#', '') AS UNSIGNED)), 0) + 1 FROM notas_fiscais").Scan(&next); err != nil {
		http.Error(w, "Erro ao gerar numeração da nota", http.StatusInternalServerError)
		return
	}
	numeroNF := fmt.Sprintf("#%05d", next)

	result, err := db.Exec(
		"INSERT INTO notas_fiscais (numero_nf, cliente_nome, cliente_cpf_cnpj, valor_total, status) VALUES (?, ?, ?, ?, ?)",
		numeroNF, nota["cliente_nome"], nota["cliente_cpf_cnpj"], nota["valor_total"], "ABERTA",
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	id, _ := result.LastInsertId()
	nota["id"] = id
	nota["status"] = "ABERTA"
	nota["numero_nf"] = numeroNF
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(nota)
}

// GET /api/notas/:id
func getNota(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/notas/")
	var numero_nf, cliente_nome, status string
	var valor_total float64
	err := db.QueryRow("SELECT numero_nf, cliente_nome, valor_total, status FROM notas_fiscais WHERE id = ?", id).
		Scan(&numero_nf, &cliente_nome, &valor_total, &status)
	if err != nil {
		http.Error(w, "Nota não encontrada", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id": id, "numero_nf": numero_nf, "cliente_nome": cliente_nome,
		"valor_total": valor_total, "status": status,
	})
}

// PUT /api/notas/:id
func updateNota(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/notas/")
	var nota map[string]interface{}
	json.NewDecoder(r.Body).Decode(&nota)
	_, err := db.Exec(
		"UPDATE notas_fiscais SET numero_nf=?, cliente_nome=?, cliente_cpf_cnpj=?, valor_total=?, status=? WHERE id=?",
		nota["numero_nf"], nota["cliente_nome"], nota["cliente_cpf_cnpj"], nota["valor_total"], nota["status"], id,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	nota["id"] = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(nota)
}

// DELETE /api/notas/:id
func deleteNota(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/notas/")
	_, err := db.Exec("DELETE FROM notas_fiscais WHERE id = ?", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "message": "Nota deletada com sucesso"})
}

// POST /api/notas/:id/itens
func addNotaItem(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/notas/")
	id = strings.TrimSuffix(id, "/itens")
	var item map[string]interface{}
	json.NewDecoder(r.Body).Decode(&item)
	result, err := db.Exec(
		"INSERT INTO notas_fiscais_itens (nota_id, produto_id, quantidade, valor_unitario) VALUES (?, ?, ?, ?)",
		id, int(item["produto_id"].(float64)), int(item["quantidade"].(float64)), item["valor_unitario"].(float64),
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	itemID, _ := result.LastInsertId()
	item["id"] = itemID
	item["nota_id"] = id
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(item)
}

// GET /api/notas/:id/itens
func getNotaItems(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/notas/")
	id = strings.TrimSuffix(id, "/itens")
	rows, err := db.Query(
		"SELECT id, nota_id, produto_id, quantidade, valor_unitario, valor_total FROM notas_fiscais_itens WHERE nota_id = ?", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	items := []map[string]interface{}{}
	for rows.Next() {
		var itemID, notaID, produtoID, quantidade int
		var valorUnitario, valorTotal float64
		if err := rows.Scan(&itemID, &notaID, &produtoID, &quantidade, &valorUnitario, &valorTotal); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		items = append(items, map[string]interface{}{
			"id": itemID, "nota_id": notaID, "produto_id": produtoID,
			"quantidade": quantidade, "valor_unitario": valorUnitario, "valor_total": valorTotal,
		})
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// POST /api/notas/:id/finalizar
// Orquestra: verifica status → deduz estoque no MS-Estoque → fecha a nota
func finalizarNota(w http.ResponseWriter, r *http.Request) {
	// Extrai o ID da URL: /api/notas/42/finalizar
	path := strings.TrimPrefix(r.URL.Path, "/api/notas/")
	path = strings.TrimSuffix(path, "/finalizar")
	id, err := strconv.Atoi(path)
	if err != nil {
		http.Error(w, "ID inválido", http.StatusBadRequest)
		return
	}

	// Concorrência/Idempotência (opcional): garante apenas 1 finalização por nota por vez.
	lockName := fmt.Sprintf("nf_finalizar_%d", id)
	var gotLock int
	if err := db.QueryRow("SELECT GET_LOCK(?, 5)", lockName).Scan(&gotLock); err != nil || gotLock != 1 {
		http.Error(w, "Nota em processamento. Tente novamente.", http.StatusConflict)
		return
	}
	defer func() { _, _ = db.Exec("SELECT RELEASE_LOCK(?)", lockName) }()

	// 1. Verifica se a nota existe e está ABERTA
	var status string
	estoqueDeduzido := false
	var numeroNF string
	if estoqueDeduzidoColExists {
		err = db.QueryRow("SELECT status, estoque_deduzido, numero_nf FROM notas_fiscais WHERE id = ?", id).Scan(&status, &estoqueDeduzido, &numeroNF)
	} else {
		err = db.QueryRow("SELECT status, numero_nf FROM notas_fiscais WHERE id = ?", id).Scan(&status, &numeroNF)
	}
	if err == sql.ErrNoRows {
		http.Error(w, "Nota não encontrada", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "Erro ao buscar nota", http.StatusInternalServerError)
		return
	}
	if status != "ABERTA" {
		// Idempotência: se já foi impressa, não tentar deduzir estoque novamente.
		if status == "IMPRESSA" || estoqueDeduzido {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"id":      id,
				"status":  "IMPRESSA",
				"message": "Nota já estava impressa",
			})
			return
		}
		http.Error(w, fmt.Sprintf("Nota já está %s — operação não permitida", status), http.StatusBadRequest)
		return
	}

	// 2. Busca os itens da nota
	rows, err := db.Query(
		"SELECT produto_id, quantidade FROM notas_fiscais_itens WHERE nota_id = ?", id)
	if err != nil {
		http.Error(w, "Erro ao buscar itens da nota", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Item struct {
		ProdutoID  int
		Quantidade int
	}
	var itens []Item
	for rows.Next() {
		var item Item
		if err := rows.Scan(&item.ProdutoID, &item.Quantidade); err != nil {
			http.Error(w, "Erro ao ler itens", http.StatusInternalServerError)
			return
		}
		itens = append(itens, item)
	}

	if len(itens) == 0 {
		http.Error(w, "Nota sem itens — não é possível finalizar", http.StatusBadRequest)
		return
	}

	// 3. Deduz estoque no MS-Estoque para cada item
	// Se qualquer dedução falhar, aborta — nota continua ABERTA (sem inconsistência)
	for _, item := range itens {
		// MS-Estoque expõe o endpoint /api/produtos/:id/baixar-saldo e espera { "quantity": N }.
		payload := map[string]interface{}{"quantity": item.Quantidade}
		if strings.TrimSpace(numeroNF) != "" {
			payload["numero_nota_fiscal"] = numeroNF
		}
		body, _ := json.Marshal(payload)

		resp, err := http.Post(
			fmt.Sprintf("%s/api/produtos/%d/baixar-saldo", estoqueURL, item.ProdutoID),
			"application/json",
			bytes.NewBuffer(body),
		)
		if err != nil {
			http.Error(w, fmt.Sprintf("Falha ao conectar no MS-Estoque (produto %d). Tente novamente.", item.ProdutoID), http.StatusServiceUnavailable)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			http.Error(w, fmt.Sprintf("Estoque insuficiente ou erro ao baixar saldo (produto %d)", item.ProdutoID), http.StatusBadRequest)
			return
		}
	}

	// 4. Todas as deduções OK → marca como impressa (fechada) e, se existir, registra que o estoque foi deduzido
	if estoqueDeduzidoColExists {
		_, err = db.Exec("UPDATE notas_fiscais SET status = 'IMPRESSA', estoque_deduzido = true WHERE id = ?", id)
	} else {
		_, err = db.Exec("UPDATE notas_fiscais SET status = 'IMPRESSA' WHERE id = ?", id)
	}
	if err != nil {
		http.Error(w, "Erro ao fechar nota", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":      id,
		"status":  "IMPRESSA",
		"message": "Nota impressa e estoque deduzido com sucesso",
	})
}

// PUT /api/notas/:id/imprimir
// Marca a nota como FECHADA (impressa). A baixa de estoque pode ser orquestrada no frontend ou via /finalizar.
func imprimirNota(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/notas/")
	path = strings.TrimSuffix(path, "/imprimir")
	id, err := strconv.Atoi(path)
	if err != nil {
		http.Error(w, "ID inválido", http.StatusBadRequest)
		return
	}

	var status string
	estoqueDeduzido := false
	if estoqueDeduzidoColExists {
		err = db.QueryRow("SELECT status, estoque_deduzido FROM notas_fiscais WHERE id = ?", id).Scan(&status, &estoqueDeduzido)
	} else {
		err = db.QueryRow("SELECT status FROM notas_fiscais WHERE id = ?", id).Scan(&status)
	}
	if err == sql.ErrNoRows {
		http.Error(w, "Nota não encontrada", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "Erro ao buscar nota", http.StatusInternalServerError)
		return
	}
	if status != "ABERTA" {
		// Idempotência: se já foi impressa, retornar sucesso sem efeitos colaterais.
		if status == "IMPRESSA" || estoqueDeduzido {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"id":      id,
				"status":  "IMPRESSA",
				"message": "Nota já estava impressa",
			})
			return
		}
		http.Error(w, fmt.Sprintf("Nota já está %s — operação não permitida", status), http.StatusBadRequest)
		return
	}

	if estoqueDeduzidoColExists {
		_, err = db.Exec("UPDATE notas_fiscais SET status = 'IMPRESSA', estoque_deduzido = true WHERE id = ?", id)
	} else {
		_, err = db.Exec("UPDATE notas_fiscais SET status = 'IMPRESSA' WHERE id = ?", id)
	}
	if err != nil {
		http.Error(w, "Erro ao fechar nota", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":      id,
		"status":  "IMPRESSA",
		"message": "Nota impressa com sucesso",
	})
}

func main() {
	http.HandleFunc("/api/notas", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			getNotas(w, r)
		} else if r.Method == http.MethodPost {
			createNota(w, r)
		}
	}))

	http.HandleFunc("/api/notas/", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.Contains(r.URL.Path, "/finalizar"):
			// POST /api/notas/:id/finalizar — deduz estoque + fecha nota
			if r.Method == http.MethodPost {
				finalizarNota(w, r)
			}
		case strings.Contains(r.URL.Path, "/imprimir"):
			// PUT /api/notas/:id/imprimir — fecha nota (baixa de estoque pode ser no frontend)
			// POST mantido para compatibilidade (rota antiga fazia a orquestração completa)
			if r.Method == http.MethodPut {
				imprimirNota(w, r)
			} else if r.Method == http.MethodPost {
				finalizarNota(w, r)
			}
		case strings.Contains(r.URL.Path, "/itens"):
			if r.Method == http.MethodPost {
				addNotaItem(w, r)
			} else if r.Method == http.MethodGet {
				getNotaItems(w, r)
			}
		default:
			if r.Method == http.MethodGet {
				getNota(w, r)
			} else if r.Method == http.MethodPut {
				updateNota(w, r)
			} else if r.Method == http.MethodDelete {
				deleteNota(w, r)
			}
		}
	}))

	fmt.Println("🚀 MS-Faturamento rodando em http://localhost:8081")
	log.Fatal(http.ListenAndServe(":8081", nil))
}
