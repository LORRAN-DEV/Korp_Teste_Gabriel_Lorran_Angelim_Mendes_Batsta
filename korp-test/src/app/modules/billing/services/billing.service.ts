import { Injectable } from '@angular/core';
import { ApiService } from '../../../core/services/api.service'; // Ajuste o caminho conforme seu projeto
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BillingService {
  constructor(private api: ApiService) { }

  getAllNotes(): Observable<any> {
    return this.api.getNotes();
  }

  createNote(note: any): Observable<any> {
    return this.api.createNote(note);
  }

  getNote(id: number): Observable<any> {
    return this.api.getNote(id);
  }

  updateNote(id: number, note: any): Observable<any> {
    return this.api.updateNote(id, note);
  }

  deleteNote(id: number): Observable<any> {
    return this.api.deleteNote(id);
  }

  finalizeAndPrint(id: number): Observable<any> {
    return this.api.finalizeAndPrint(id);
  }

  printNote(id: number): Observable<any> {
    return this.api.printNote(id);
  }

  addNoteItem(notaId: number, item: any): Observable<any> {
    return this.api.addNoteItem(notaId, item);
  }

  getNoteItems(notaId: number): Observable<any> {
    return this.api.getNoteItems(notaId);
  }

  // MÉTODOS DE ESTOQUE (Delegados para o ApiService)
  deductStock(produtoId: number, quantity: number, numeroNF: string): Observable<any> {
    return this.api.deductStock(produtoId, quantity, numeroNF);
  }

  restoreStock(produtoId: number, quantity: number, numeroNF: string): Observable<any> {
    return this.api.restoreStock(produtoId, quantity, numeroNF);
  }
}
