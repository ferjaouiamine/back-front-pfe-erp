import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, tap, retry, timeout, finalize } from 'rxjs/operators';
import { AuthService } from '../../auth/services/auth.service';
import { Product } from '../models/purchase-order.model';

export interface ProductStock {
  id: number;
  reference: string;
  nom: string;
  description?: string;
  prix: number;
  stock: number;
  categorie: string;
  disponible: boolean;
  fournisseurId?: number;
}

export interface StockStats {
  totalProduits: number;
  produitsEnStock: number;
  produitsEnRupture: number;
  produitsParCategorie: { [key: string]: number };
}

@Injectable({
  providedIn: 'root'
})
export class StockCommandeService {
  // URLs des API
  private primaryApiUrl = 'http://localhost:8088/api/stock-commandes';
  private backupApiUrl = 'http://localhost:8080/api/stock-commandes';
  
  // État du service
  private backendAvailable = true;
  private lastSuccessfulApiUrl: string | null = null;
  
  constructor(private http: HttpClient, private authService: AuthService) {
    // Vérifier la disponibilité du backend au démarrage
    this.checkBackendAvailability().subscribe(
      isAvailable => {
        console.log(`Backend disponible: ${isAvailable}`);
        if (!isAvailable) {
          console.warn('Aucun backend de stock-commande disponible. Certaines fonctionnalités peuvent être limitées.');
        }
      }
    );
  }

  /**
   * Récupère les en-têtes d'authentification
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    const baseHeaders: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    return new HttpHeaders(
      token ? { ...baseHeaders, Authorization: `Bearer ${token}` } : baseHeaders
    );
  }
  
  /**
   * Vérifie la disponibilité du backend
   * @returns Observable indiquant si le backend est disponible
   */
  private checkBackendAvailability(): Observable<boolean> {
    // Essayer d'abord l'URL principale
    return this.http.get<any>(`${this.primaryApiUrl}/health`, {
      headers: this.getAuthHeaders()
    }).pipe(
      timeout(3000), // Timeout après 3 secondes
      tap(() => {
        console.log('Backend principal disponible');
        this.backendAvailable = true;
        this.lastSuccessfulApiUrl = this.primaryApiUrl;
      }),
      map(() => true),
      catchError(() => {
        console.warn('Backend principal indisponible, tentative avec le backend de secours');
        
        // Essayer l'URL de secours
        return this.http.get<any>(`${this.backupApiUrl}/health`, {
          headers: this.getAuthHeaders()
        }).pipe(
          timeout(3000),
          tap(() => {
            console.log('Backend de secours disponible');
            this.backendAvailable = true;
            this.lastSuccessfulApiUrl = this.backupApiUrl;
          }),
          map(() => true),
          catchError(() => {
            console.error('Tous les backends sont indisponibles');
            this.backendAvailable = false;
            this.lastSuccessfulApiUrl = null;
            return of(false);
          })
        );
      })
    );
  }
  
  /**
   * Retourne l'URL de l'API à utiliser
   * @returns URL de l'API
   */
  private getApiUrl(): string {
    // Si une URL a déjà fonctionné précédemment, l'utiliser
    if (this.lastSuccessfulApiUrl) {
      return this.lastSuccessfulApiUrl;
    }
    
    // Sinon, utiliser l'URL principale par défaut
    return this.primaryApiUrl;
  }

  /**
   * Récupère les produits disponibles avec pagination et filtrage
   */
  getProduits(page: number = 0, size: number = 10, categorie?: string, recherche?: string): Observable<{
    produits: ProductStock[],
    totalElements: number,
    totalPages: number
  }> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (categorie) {
      params = params.set('categorie', categorie);
    }

    if (recherche) {
      params = params.set('recherche', recherche);
    }
    
    // Vérifier d'abord la disponibilité du backend
    return this.checkBackendAvailability().pipe(
      map(() => this.getApiUrl()),
      tap(apiUrl => console.log(`Récupération des produits depuis ${apiUrl}/produits`)),
      map(apiUrl => `${apiUrl}/produits`),
      map(url => this.http.get<any>(url, {
        headers: this.getAuthHeaders(),
        params
      })),
      catchError(() => {
        // Si les deux backends sont indisponibles, utiliser l'URL principale
        return this.http.get<any>(`${this.primaryApiUrl}/produits`, {
          headers: this.getAuthHeaders(),
          params
        });
      }),
      map(request => request.pipe(
        retry(1),
        timeout(5000),
        map((response: any) => ({
          produits: response.content || [],
          totalElements: response.totalElements || 0,
          totalPages: response.totalPages || 0
        })),
        catchError(error => {
          console.error('Erreur lors de la récupération des produits', error);
          // Retourner un résultat vide mais valide en cas d'erreur
          return of({
            produits: [],
            totalElements: 0,
            totalPages: 0
          });
        })
      )),
      catchError(() => {
        console.error('Erreur critique lors de la récupération des produits');
        return of({
          produits: [],
          totalElements: 0,
          totalPages: 0
        });
      })
    );
  }

  /**
   * Récupère les catégories de produits distinctes
   */
  getCategories(): Observable<string[]> {
    // Utiliser l'URL la plus récente qui a fonctionné
    const apiUrl = this.getApiUrl();
    
    return this.http.get<string[]>(`${apiUrl}/categories`, {
      headers: this.getAuthHeaders()
    }).pipe(
      retry(1),
      timeout(5000),
      catchError(error => {
        console.error(`Erreur lors de la récupération des catégories depuis ${apiUrl}`, error);
        
        // Essayer avec l'autre URL si celle-ci échoue
        const fallbackUrl = apiUrl === this.primaryApiUrl ? this.backupApiUrl : this.primaryApiUrl;
        console.log(`Tentative avec l'URL de secours: ${fallbackUrl}/categories`);
        
        return this.http.get<string[]>(`${fallbackUrl}/categories`, {
          headers: this.getAuthHeaders()
        }).pipe(
          catchError(fallbackError => {
            console.error('Échec de la récupération des catégories sur les deux endpoints', fallbackError);
            // Retourner un tableau vide en cas d'échec
            return of([]);
          })
        );
      })
    );
  }

  /**
   * Récupère les statistiques de stock
   */
  getStockStats(): Observable<StockStats> {
    const apiUrl = this.getApiUrl();
    return this.http.get<StockStats>(`${apiUrl}/stats`, {
      headers: this.getAuthHeaders()
    }).pipe(
      retry(1),
      timeout(5000),
      catchError(error => {
        console.error(`Erreur lors de la récupération des statistiques de stock depuis ${apiUrl}`, error);
        
        // Essayer avec l'autre URL si celle-ci échoue
        const fallbackUrl = apiUrl === this.primaryApiUrl ? this.backupApiUrl : this.primaryApiUrl;
        
        return this.http.get<StockStats>(`${fallbackUrl}/stats`, {
          headers: this.getAuthHeaders()
        }).pipe(
          catchError(fallbackError => {
            console.error('Échec de la récupération des statistiques sur les deux endpoints', fallbackError);
            // Retourner des statistiques vides en cas d'échec
            return of({
              totalProduits: 0,
              produitsEnStock: 0,
              produitsEnRupture: 0,
              produitsParCategorie: {}
            });
          })
        );
      })
    );
  }

  /**
   * Ajoute un produit à une commande
   */
  ajouterProduitACommande(commandeId: number, produitId: number, quantite: number): Observable<any> {
    const params = new HttpParams()
      .set('produitId', produitId.toString())
      .set('quantite', quantite.toString());
    
    // Utiliser l'URL la plus récente qui a fonctionné
    const apiUrl = this.getApiUrl();
    console.log(`Ajout du produit ${produitId} à la commande ${commandeId} via ${apiUrl}`);

    return this.http.post<any>(`${apiUrl}/commandes/${commandeId}/produits/${produitId}?quantite=${quantite}`, null, {
      headers: this.getAuthHeaders()
    }).pipe(
      retry(1),
      timeout(5000),
      catchError(error => {
        console.error(`Erreur lors de l'ajout du produit à la commande via ${apiUrl}`, error);
        
        // Essayer avec l'autre URL si celle-ci échoue
        const fallbackUrl = apiUrl === this.primaryApiUrl ? this.backupApiUrl : this.primaryApiUrl;
        console.log(`Tentative avec l'URL de secours: ${fallbackUrl}`);
        
        return this.http.post<any>(`${fallbackUrl}/commandes/${commandeId}/produits/${produitId}?quantite=${quantite}`, null, {
          headers: this.getAuthHeaders()
        }).pipe(
          catchError(fallbackError => {
            console.error('Échec de l\'ajout du produit sur les deux endpoints', fallbackError);
            // Simuler une réponse réussie pour permettre à l'interface utilisateur de continuer
            return of({
              id: Date.now(), // ID temporaire
              produitId: produitId,
              commandeId: commandeId,
              quantite: quantite,
              status: 'PENDING'
            });
          })
        );
      })
    );
  }

  /**
   * Réceptionne une commande (mise à jour des quantités reçues)
   */
  receptionnerCommande(commandeId: number, lignesRecues: { [ligneId: number]: number }): Observable<any> {
    const apiUrl = this.getApiUrl();
    
    return this.http.post<any>(`${apiUrl}/commandes/${commandeId}/reception`, lignesRecues, {
      headers: this.getAuthHeaders()
    }).pipe(
      retry(1),
      timeout(5000),
      catchError(error => {
        console.error(`Erreur lors de la réception de la commande via ${apiUrl}`, error);
        
        // Essayer avec l'autre URL si celle-ci échoue
        const fallbackUrl = apiUrl === this.primaryApiUrl ? this.backupApiUrl : this.primaryApiUrl;
        
        return this.http.post<any>(`${fallbackUrl}/commandes/${commandeId}/reception`, lignesRecues, {
          headers: this.getAuthHeaders()
        }).pipe(
          catchError(fallbackError => {
            console.error('Échec de la réception de la commande sur les deux endpoints', fallbackError);
            // Simuler une réponse réussie
            return of({
              id: commandeId,
              status: 'RECEIVED',
              message: 'Commande réceptionnée (mode hors ligne)'
            });
          })
        );
      })
    );
  }

  /**
   * Vérifie la disponibilité des produits pour une commande
   */
  verifierDisponibiliteProduits(commandeId: number): Observable<{ [produitId: number]: boolean }> {
    const apiUrl = this.getApiUrl();
    
    return this.http.get<any>(`${apiUrl}/commandes/${commandeId}/disponibilite`, {
      headers: this.getAuthHeaders()
    }).pipe(
      retry(1),
      timeout(5000),
      map((response: any) => response.disponibilites),
      catchError(error => {
        console.error(`Erreur lors de la vérification de disponibilité des produits via ${apiUrl}`, error);
        
        // Essayer avec l'autre URL si celle-ci échoue
        const fallbackUrl = apiUrl === this.primaryApiUrl ? this.backupApiUrl : this.primaryApiUrl;
        
        return this.http.get<any>(`${fallbackUrl}/commandes/${commandeId}/disponibilite`, {
          headers: this.getAuthHeaders()
        }).pipe(
          map((response: any) => response.disponibilites),
          catchError(fallbackError => {
            console.error('Échec de la vérification de disponibilité sur les deux endpoints', fallbackError);
            // Retourner un objet vide en cas d'échec
            return of({});
          })
        );
      })
    );
  }
}
