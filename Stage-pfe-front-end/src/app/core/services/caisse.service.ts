import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class CaisseService {
  constructor(private apiService: ApiService) {}

  // Exemple de méthode pour récupérer toutes les transactions
  getTransactions(): Observable<any[]> {
    const url = `${this.apiService.getCaisseBaseUrl()}/transactions`;
    return this.apiService.get<any[]>(url);
  }

  // Exemple de méthode pour créer une nouvelle transaction
  createTransaction(transaction: any): Observable<any> {
    const url = `${this.apiService.getCaisseBaseUrl()}/transactions`;
    return this.apiService.post<any>(url, transaction);
  }
}
