import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private billingUrl = 'http://localhost:8081/api';
  private inventoryUrl = 'http://localhost:8082/api';

  constructor(private http: HttpClient) { }

  // ========== BILLING (Faturamento) ==========
  
  getNotes(): Observable<any> {
    return this.http.get(`${this.billingUrl}/notas`);
  }

  createNote(data: any): Observable<any> {
    return this.http.post(`${this.billingUrl}/notas`, data);
  }

  getNote(id: number): Observable<any> {
    return this.http.get(`${this.billingUrl}/notas/${id}`);
  }

  updateNote(id: number, data: any): Observable<any> {
    return this.http.put(`${this.billingUrl}/notas/${id}`, data);
  }

  deleteNote(id: number): Observable<any> {
    return this.http.delete(`${this.billingUrl}/notas/${id}`);
  }

  // Método atômico que você solicitou para o backend
  finalizeAndPrint(id: number): Observable<any> {
    return this.http.post(`${this.billingUrl}/notas/${id}/finalizar`, {});
  }

  printNote(id: number): Observable<any> {
    return this.http.put(`${this.billingUrl}/notas/${id}/imprimir`, {});
  }

  addNoteItem(notaId: number, item: any): Observable<any> {
    return this.http.post(`${this.billingUrl}/notas/${notaId}/itens`, item);
  }

  getNoteItems(notaId: number): Observable<any> {
    return this.http.get(`${this.billingUrl}/notas/${notaId}/itens`);
  }

  // ========== INVENTORY (Estoque) ==========
  
  getProducts(): Observable<any> {
    return this.http.get(`${this.inventoryUrl}/produtos`);
  }

  createProduct(data: any): Observable<any> {
    return this.http.post(`${this.inventoryUrl}/produtos`, data);
  }

  getProduct(id: number): Observable<any> {
    return this.http.get(`${this.inventoryUrl}/produtos/${id}`);
  }

  updateProduct(id: number, data: any): Observable<any> {
    return this.http.put(`${this.inventoryUrl}/produtos/${id}`, data);
  }

  deleteProduct(id: number): Observable<any> {
    return this.http.delete(`${this.inventoryUrl}/produtos/${id}`);
  }

  deductStock(id: number, quantity: number, numeroNotaFiscal?: string): Observable<any> {
    const payload: any = { quantity };
    if (numeroNotaFiscal) payload.numero_nota_fiscal = numeroNotaFiscal;
    return this.http.post(`${this.inventoryUrl}/produtos/${id}/baixar-saldo`, payload);
  }

  restoreStock(id: number, quantity: number, numeroNotaFiscal?: string): Observable<any> {
    const payload: any = { quantity };
    if (numeroNotaFiscal) payload.numero_nota_fiscal = numeroNotaFiscal;
    return this.http.post(`${this.inventoryUrl}/produtos/${id}/estornar-saldo`, payload);
  }

  suggestReposition(): Observable<any> {
    return this.http.post(`${this.inventoryUrl}/produtos/sugerir-reposicao`, {});
  }
}
