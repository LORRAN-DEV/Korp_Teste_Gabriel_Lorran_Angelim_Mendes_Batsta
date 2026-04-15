import { Injectable } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  constructor(private api: ApiService) { }

  getAllProducts(): Observable<any> {
    return this.api.getProducts();
  }

  createProduct(product: any): Observable<any> {
    return this.api.createProduct(product);
  }

  getProduct(id: number): Observable<any> {
    return this.api.getProduct(id);
  }

  updateProduct(id: number, product: any): Observable<any> {
    return this.api.updateProduct(id, product);
  }

  deleteProduct(id: number): Observable<any> {
    return this.api.deleteProduct(id);
  }

  deductStock(id: number, quantity: number, numeroNotaFiscal?: string): Observable<any> {
    return this.api.deductStock(id, quantity, numeroNotaFiscal);
  }

  restoreStock(id: number, quantity: number, numeroNotaFiscal?: string): Observable<any> {
    return this.api.restoreStock(id, quantity, numeroNotaFiscal);
  }

  getSuggestReposition(): Observable<any> {
    return this.api.suggestReposition();
  }
}
