import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from '../../auth/services/auth.service';

export interface Produit {
  id: number;
  reference?: string;
  nom: string;
  description?: string;
  prix: number;
  stock?: number;
  seuilStock?: number;
  categorie?: {
    id: number;
    nom: string;
  };
  dateCreation?: string;
  dateModification?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProduitService {
  private apiUrl = 'http://localhost:8082/api/commandes';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  // Obtenir les headers d'authentification
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // Récupérer les produits en stock faible
  getProductsInLowStock(): Observable<Produit[]> {
    return this.http.get<Produit[]>(`${this.apiUrl}/lowstock-products`, { headers: this.getAuthHeaders() }).pipe(
      map(produits => {
        console.log('Produits en stock faible récupérés:', produits);
        return produits;
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des produits en stock faible:', error);
        return of([]);
      })
    );
  }

  // Récupérer tous les produits disponibles
  getAllProducts(): Observable<Produit[]> {
    return this.http.get<Produit[]>(`${this.apiUrl.replace('/commandes', '/produits')}`, { headers: this.getAuthHeaders() }).pipe(
      map(produits => {
        console.log('Tous les produits récupérés:', produits);
        return produits;
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des produits:', error);
        return of([]);
      })
    );
  }
}
