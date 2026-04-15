import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private baseUrl = 'http://localhost:8082/api';

  constructor(private http: HttpClient) {}

  getAllProducts(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/produtos`);
  }

  getProduct(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/produtos/${id}`);
  }

  createProduct(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/produtos`, data);
  }

  updateProduct(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/produtos/${id}`, data);
  }

  deleteProduct(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/produtos/${id}`);
  }
}
