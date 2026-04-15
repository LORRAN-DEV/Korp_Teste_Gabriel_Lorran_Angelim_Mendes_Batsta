import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  // Ajustado para bater com o backend Go (:8082)
  private baseUrl = 'http://localhost:8082/api/produtos';

  constructor(private http: HttpClient) {}

  // --- MÉTODOS EXISTENTES ---

  getAllProducts(): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl);
  }

  getProduct(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${id}`);
  }

  createProduct(data: any): Observable<any> {
    return this.http.post<any>(this.baseUrl, data);
  }

  updateProduct(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, data);
  }

  deleteProduct(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/${id}`);
  }

  // --- NOVOS MÉTODOS PARA O FLUXO DE NOTA FISCAL ---

  /**
   * Baixa o saldo de um produto no MS-Estoque.
   * Rota Go: POST /api/produtos/:id/baixar-saldo
   */
  deductStock(produtoId: number, quantity: number, numeroNF: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/${produtoId}/baixar-saldo`, {
      quantity: quantity,
      numero_nota_fiscal: numeroNF
    });
  }

  /**
   * Estorna o saldo de um produto no MS-Estoque (Compensação).
   * Rota Go: POST /api/produtos/:id/estornar-saldo
   */
  restoreStock(produtoId: number, quantity: number, numeroNF: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/${produtoId}/estornar-saldo`, {
      quantity: quantity,
      numero_nota_fiscal: numeroNF
    });
  }
}
