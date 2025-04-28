import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private headers = new HttpHeaders().set('Content-Type', 'application/json');

  constructor(private http: HttpClient) {}

  // Service Caisse
  private caisseBaseUrl = environment.apiUrl + '/caisse-service';

  // Service Facturation
  private facturationBaseUrl = environment.apiUrl + '/service-facturation';

  // Service Stock
  private stockBaseUrl = environment.apiUrl + '/stock-service';

  // Service Achat
  private achatBaseUrl = environment.apiUrl + '/service-achat';

  // Méthodes génériques HTTP
  get<T>(url: string): Observable<T> {
    return this.http.get<T>(url, { headers: this.headers });
  }

  post<T>(url: string, body: any): Observable<T> {
    return this.http.post<T>(url, body, { headers: this.headers });
  }

  put<T>(url: string, body: any): Observable<T> {
    return this.http.put<T>(url, body, { headers: this.headers });
  }

  delete<T>(url: string): Observable<T> {
    return this.http.delete<T>(url, { headers: this.headers });
  }

  // Getters pour les URLs de base
  getCaisseBaseUrl(): string {
    return this.caisseBaseUrl;
  }

  getFacturationBaseUrl(): string {
    return this.facturationBaseUrl;
  }

  getStockBaseUrl(): string {
    return this.stockBaseUrl;
  }

  getAchatBaseUrl(): string {
    return this.achatBaseUrl;
  }
}
