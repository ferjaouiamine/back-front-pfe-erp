import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../../../modules/auth/services/auth.service';

export interface StockMovement {
  id: string;
  date: string;
  productId: string;
  productName: string;
  type: 'ENTRY' | 'EXIT';
  quantity: number;
  reference?: string;
  reason?: string;
  userId?: string;
  userName?: string;
}

export interface StockStats {
  totalProducts: number;
  totalQuantity: number;
  lowStockCount: number;
  recentMovementsCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class StockService {
  // URL principale du backend Spring Boot pour le stock
  private apiUrl = 'http://localhost:8082/api/stock/movements';
  // URL alternative si le port 8082 ne fonctionne pas
  private alternativeApiUrl = 'http://localhost:8086/api/stock/movements';
  // URL pour les produits
  private productsApiUrl = 'http://localhost:8082/api/products';
  // URL alternative pour les produits
  private alternativeProductsApiUrl = 'http://localhost:8082/api/products';
  // Définir backendAvailable à true par défaut pour tenter de se connecter au backend
  private backendAvailable = true;
  
  // Message pour informer l'utilisateur que le backend n'est pas disponible
  private backendUnavailableMessage = 'Le serveur de gestion de stock n\'est pas disponible. Les données affichées sont fictives à des fins de démonstration.';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      return new HttpHeaders({
        ...headers,
        'Authorization': `Bearer ${token}`
      });
    }
    
    return new HttpHeaders(headers);
  }

  /**
   * Récupère les mouvements de stock récents
   * @param limit Nombre de mouvements à récupérer
   * @returns Observable des mouvements de stock
   */
  getRecentMovements(limit: number = 10): Observable<StockMovement[]> {
    const headers = this.getAuthHeaders();
    const params = new HttpParams().set('limit', limit.toString());
    
    console.log(`Tentative de récupération des mouvements de stock sur le port 8082 (limite: ${limit})`);
    
    // Essayer d'abord avec l'URL principale (port 8082)
    return this.http.get<any[]>(`${this.apiUrl}`, { headers, params }).pipe(
      map(response => {
        // Le backend est disponible
        this.backendAvailable = true;
        console.log('Mouvements de stock récupérés avec succès sur le port 8082:', response);
        
        if (Array.isArray(response)) {
          return response.map(movement => ({
            id: movement.id,
            date: movement.date,
            productId: movement.productId,
            productName: movement.productName,
            type: movement.type,
            quantity: movement.quantity,
            reference: movement.reference,
            reason: movement.reason,
            userId: movement.userId,
            userName: movement.userName
          }));
        }
        return [];
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des mouvements de stock sur le port 8082:', error);
        
        // En cas d'échec, essayer avec l'URL alternative (port 8082)
        console.log(`Tentative de récupération des mouvements de stock sur le port 8082 (limite: ${limit})`);
        return this.http.get<any[]>(`${this.alternativeApiUrl}`, { headers, params }).pipe(
          map(response => {
            // Le backend est disponible
            this.backendAvailable = true;
            console.log('Mouvements de stock récupérés avec succès sur le port 8082:', response);
            
            if (Array.isArray(response)) {
              return response.map(movement => ({
                id: movement.id,
                date: movement.date,
                productId: movement.productId,
                productName: movement.productName,
                type: movement.type,
                quantity: movement.quantity,
                reference: movement.reference,
                reason: movement.reason,
                userId: movement.userId,
                userName: movement.userName
              }));
            }
            return [];
          }),
          catchError(alternativeError => {
            console.error('Erreur lors de la récupération des mouvements de stock sur le port 8082:', alternativeError);
            
            // Si c'est une erreur de connexion, marquer le backend comme indisponible
            this.backendAvailable = false;
            console.error('Le backend est indisponible. Impossible de récupérer les mouvements de stock.');
            
            // Retourner une erreur au lieu d'utiliser des données fictives
            return throwError(() => new Error(
              'Le serveur de gestion de stock n\'est pas disponible. Impossible de récupérer les mouvements de stock.'
            ));
          })
        );
      })
    );
  }

  /**
   * Récupère les statistiques du stock en utilisant les données des produits
   * @returns Observable des statistiques du stock
   */
  getStockStats(): Observable<StockStats> {
    const headers = this.getAuthHeaders();
    
    console.log('Tentative de récupération des statistiques de stock sur le port 8082');
    
    // Essayer d'abord avec l'URL principale (port 8082)
    return this.http.get<any>(`${this.productsApiUrl}/stats`, { headers }).pipe(
      map(response => {
        // Le backend est disponible
        this.backendAvailable = true;
        console.log('Statistiques de stock récupérées avec succès sur le port 8082:', response);
        
        return {
          totalProducts: response.totalProducts || 0,
          totalQuantity: response.totalQuantity || 0,
          lowStockCount: response.lowStockCount || 0,
          recentMovementsCount: response.recentMovementsCount || 0
        };
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des statistiques de stock sur le port 8082:', error);
        
        // En cas d'échec, essayer avec l'URL alternative (port 8082)
        console.log('Tentative de récupération des statistiques de stock sur le port 8082');
        return this.http.get<any>(`${this.alternativeProductsApiUrl}/stats`, { headers }).pipe(
          map(response => {
            // Le backend est disponible
            this.backendAvailable = true;
            console.log('Statistiques de stock récupérées avec succès sur le port 8082:', response);
            
            return {
              totalProducts: response.totalProducts || 0,
              totalQuantity: response.totalQuantity || 0,
              lowStockCount: response.lowStockCount || 0,
              recentMovementsCount: response.recentMovementsCount || 0
            };
          }),
          catchError(alternativeError => {
            console.error('Erreur lors de la récupération des statistiques de stock sur le port 8082:', alternativeError);
            
            // Si c'est une erreur de connexion, marquer le backend comme indisponible
            this.backendAvailable = false;
            console.error('Le backend est indisponible. Impossible de récupérer les statistiques de stock.');
            
            // Retourner une erreur au lieu d'utiliser des données fictives
            return throwError(() => new Error(
              'Le serveur de gestion de stock n\'est pas disponible. Impossible de récupérer les statistiques de stock.'
            ));
          })
        );
      })
    );
  }
  
  /**
   * Indique si le backend est disponible
   * @returns true si le backend est disponible, false sinon
   */
  isBackendAvailable(): boolean {
    return this.backendAvailable;
  }
  
  /**
   * Retourne le message d'indisponibilité du backend
   * @returns Message d'indisponibilité
   */
  getBackendUnavailableMessage(): string {
    return this.backendUnavailableMessage;
  }

  /**
   * Ajoute un mouvement d'entrée de stock
   * @param productId ID du produit
   * @param quantity Quantité à ajouter
   * @param reason Raison de l'entrée
   * @param reference Référence externe (ex: numéro de commande)
   * @returns Observable du mouvement créé
   */
  addStockEntry(productId: string, quantity: number, reason?: string, reference?: string): Observable<StockMovement> {
    const headers = this.getAuthHeaders();
    
    // Construire les paramètres de requête
    let params = new HttpParams()
      .set('type', 'ENTRY')
      .set('quantity', quantity.toString())
      .set('reason', reason || 'Entrée de stock');
    
    // Ajouter la référence si elle est fournie
    if (reference) {
      params = params.set('referenceDocument', reference);
    }
    
    console.log(`Tentative d'ajout d'une entrée de stock sur le port 8082 pour le produit ${productId}`);
    
    // Essayer d'abord avec l'URL principale (port 8082)
    return this.http.post<StockMovement>(`${this.apiUrl}/product/${productId}`, null, { headers, params }).pipe(
      map(response => {
        // Le backend est disponible
        this.backendAvailable = true;
        console.log('Entrée de stock ajoutée avec succès sur le port 8082:', response);
        return response;
      }),
      catchError(error => {
        console.error('Erreur lors de l\'ajout d\'une entrée de stock sur le port 8082:', error);
        
        // En cas d'échec, essayer avec l'URL alternative (port 8082)
        console.log(`Tentative d'ajout d'une entrée de stock sur le port 8082 pour le produit ${productId}`);
        return this.http.post<StockMovement>(`${this.alternativeApiUrl}/product/${productId}`, null, { headers, params }).pipe(
          map(response => {
            // Le backend est disponible
            this.backendAvailable = true;
            console.log('Entrée de stock ajoutée avec succès sur le port 8082:', response);
            return response;
          }),
          catchError(alternativeError => {
            console.error('Erreur lors de l\'ajout d\'une entrée de stock sur le port 8082:', alternativeError);
            
            // Si c'est une erreur de connexion, marquer le backend comme indisponible
            this.backendAvailable = false;
            return throwError(() => new Error(
              'Le serveur de gestion de stock n\'est pas disponible. Impossible d\'ajouter une entrée de stock.'
            ));
          })
        );
      })
    );
  }

  /**
   * Ajoute un mouvement de sortie de stock
   * @param productId ID du produit
   * @param quantity Quantité à retirer
   * @param reason Raison de la sortie
   * @param reference Référence externe (ex: numéro de facture)
   * @returns Observable du mouvement créé
   */
  removeStockEntry(productId: string, quantity: number, reason?: string, reference?: string): Observable<StockMovement> {
    const headers = this.getAuthHeaders();
    
    // Construire les paramètres de requête selon la structure d'API du backend Spring Boot
    let params = new HttpParams()
      .set('type', 'EXIT')
      .set('quantity', quantity.toString())
      .set('reason', reason || 'Sortie de stock');
    
    // Ajouter la référence si elle est fournie
    if (reference) {
      params = params.set('referenceDocument', reference);
    }
    
    console.log(`Tentative de sortie de stock pour le produit ${productId} avec les paramètres:`, {
      type: 'EXIT',
      quantity: quantity,
      reason: reason || 'Sortie de stock',
      referenceDocument: reference
    });
    
    // Tableau des ports à essayer dans l'ordre
    const ports = [8082, 8086, 8080];
    
    // Fonction pour créer une requête pour un port spécifique
    const createRequest = (port: number) => {
      const url = `http://localhost:${port}/api/stock/movements/product/${productId}`;
      console.log(`Tentative de sortie de stock sur le port ${port} pour le produit ${productId}`);
      
      return this.http.post<StockMovement>(url, null, { headers, params }).pipe(
        map(response => {
          this.backendAvailable = true;
          console.log(`Sortie de stock effectuée avec succès sur le port ${port}:`, response);
          return response;
        }),
        catchError(error => {
          console.error(`Erreur lors de la sortie de stock sur le port ${port}:`, error);
          throw error;
        })
      );
    };
    
    // Essayer d'abord avec le port principal, puis les alternatives
    return createRequest(ports[0]).pipe(
      catchError(error => {
        // En cas d'échec, essayer avec le deuxième port
        return createRequest(ports[1]).pipe(
          catchError(error2 => {
            // En cas d'échec, essayer avec le troisième port
            return createRequest(ports[2]).pipe(
              catchError(error3 => {
                // Si tous les ports échouent, essayer l'endpoint de test direct
                console.log(`Tentative de sortie de stock via l'endpoint de test pour le produit ${productId}`);
                
                return this.http.get<any>(`http://localhost:8086/api/stock/test-stock-update/${productId}?quantity=${quantity}&invoiceNumber=${reference || 'DIRECT-CALL'}`).pipe(
                  map(response => {
                    this.backendAvailable = true;
                    console.log(`Sortie de stock effectuée avec succès via l'endpoint de test:`, response);
                    
                    // Convertir la réponse au format StockMovement
                    return {
                      id: 'generated',
                      date: new Date().toISOString(),
                      productId: productId,
                      productName: 'Produit',
                      type: 'EXIT',
                      quantity: quantity,
                      reference: reference,
                      reason: reason || 'Sortie de stock'
                    } as StockMovement;
                  }),
                  catchError(finalError => {
                    console.error(`Échec de toutes les tentatives de sortie de stock pour le produit ${productId}`);
                    this.backendAvailable = false;
                    return throwError(() => new Error(
                      'Le serveur de gestion de stock n\'est pas disponible. Impossible d\'effectuer une sortie de stock.'
                    ));
                  })
                );
              })
            );
          })
        );
      })
    );
  }

  checkAvailability(productId: string, quantity: number): Observable<boolean> {
    const headers = this.getAuthHeaders();
    const params = new HttpParams()
      .set('productId', productId)
      .set('quantity', quantity.toString());
    
    return this.http.get<{available: boolean}>(`${this.apiUrl}/check-availability`, { headers, params }).pipe(
      map(response => response.available),
      catchError(error => {
        console.error('Erreur lors de la vérification de disponibilité du stock:', error);
        return of(false);
      })
    );
  }

  // La méthode getMockMovements a été supprimée pour n'utiliser que des données réelles
}
