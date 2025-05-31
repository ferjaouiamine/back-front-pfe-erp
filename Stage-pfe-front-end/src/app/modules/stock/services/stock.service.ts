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
  // URL alternative si le port 8083 ne fonctionne pas
  private alternativeApiUrl = 'http://localhost:8082/api/stock/movements';
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
    
    console.log(`Tentative de récupération des mouvements de stock sur le port 8083 (limite: ${limit})`);
    
    // Essayer d'abord avec l'URL principale (port 8083)
    return this.http.get<any[]>(`${this.apiUrl}`, { headers, params }).pipe(
      map(response => {
        // Le backend est disponible
        this.backendAvailable = true;
        console.log('Mouvements de stock récupérés avec succès sur le port 8083:', response);
        
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
        console.error('Erreur lors de la récupération des mouvements de stock sur le port 8083:', error);
        
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
            // Marquer le backend comme indisponible
            this.backendAvailable = false;
            // Retourner des données fictives en cas d'erreur
            console.log('Aucun backend disponible, utilisation de données fictives pour les mouvements de stock');
            return of(this.getMockMovements(limit));
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
    
    console.log('Tentative de récupération des produits pour calculer les statistiques de stock sur le port 8082');
    
    // Essayer d'abord avec l'URL des produits (port 8082)
    return this.http.get<any[]>(`${this.productsApiUrl}`, { headers }).pipe(
      map(products => {
        // Le backend est disponible
        this.backendAvailable = true;
        console.log('Produits récupérés avec succès pour calculer les statistiques:', products);
        
        // Calculer les statistiques à partir des produits
        const stats: StockStats = {
          totalProducts: products.length,
          totalQuantity: products.reduce((sum, product) => sum + (product.quantity || 0), 0),
          lowStockCount: products.filter(product => 
            (product.quantity || 0) <= (product.alertThreshold || 10)
          ).length,
          recentMovementsCount: 0 // Sera mis à jour après
        };
        
        // Récupérer les mouvements récents pour compléter les statistiques
        this.getRecentMovements(10).subscribe(movements => {
          stats.recentMovementsCount = movements.length;
        });
        
        return stats;
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des produits sur le port 8082:', error);
        
        // En cas d'échec, essayer avec l'URL alternative (port 8083)
        console.log('Tentative de récupération des produits sur le port 8083');
        return this.http.get<any[]>(`${this.alternativeProductsApiUrl}`, { headers }).pipe(
          map(products => {
            // Le backend est disponible
            this.backendAvailable = true;
            console.log('Produits récupérés avec succès pour calculer les statistiques:', products);
            
            // Calculer les statistiques à partir des produits
            const stats: StockStats = {
              totalProducts: products.length,
              totalQuantity: products.reduce((sum, product) => sum + (product.quantity || 0), 0),
              lowStockCount: products.filter(product => 
                (product.quantity || 0) <= (product.alertThreshold || 10)
              ).length,
              recentMovementsCount: 0 // Sera mis à jour après
            };
            
            // Récupérer les mouvements récents pour compléter les statistiques
            this.getRecentMovements(10).subscribe(movements => {
              stats.recentMovementsCount = movements.length;
            });
            
            return stats;
          }),
          catchError(alternativeError => {
            console.error('Erreur lors de la récupération des produits sur le port 8083:', alternativeError);
            // Marquer le backend comme indisponible
            this.backendAvailable = false;
            // Retourner des données fictives en cas d'erreur
            console.log('Aucun backend disponible, utilisation de données fictives pour les statistiques de stock');
            return of({
              totalProducts: 120,
              totalQuantity: 3500,
              lowStockCount: 15,
              recentMovementsCount: 25
            });
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
    
    console.log(`Tentative d'ajout d'une entrée de stock sur le port 8083 pour le produit ${productId}`);
    
    // Essayer d'abord avec l'URL principale (port 8083)
    return this.http.post<StockMovement>(`${this.apiUrl}/product/${productId}`, null, { headers, params }).pipe(
      map(response => {
        // Le backend est disponible
        this.backendAvailable = true;
        console.log('Entrée de stock ajoutée avec succès sur le port 8083:', response);
        return response;
      }),
      catchError(error => {
        console.error('Erreur lors de l\'ajout d\'une entrée de stock sur le port 8083:', error);
        
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
    
    // Construire les paramètres de requête
    let params = new HttpParams()
      .set('type', 'EXIT')
      .set('quantity', quantity.toString())
      .set('reason', reason || 'Sortie de stock');
    
    // Ajouter la référence si elle est fournie
    if (reference) {
      params = params.set('referenceDocument', reference);
    }
    
    console.log(`Tentative de sortie de stock sur le port 8083 pour le produit ${productId}`);
    
    // Essayer d'abord avec l'URL principale (port 8083)
    return this.http.post<StockMovement>(`${this.apiUrl}/product/${productId}`, null, { headers, params }).pipe(
      map(response => {
        // Le backend est disponible
        this.backendAvailable = true;
        console.log('Sortie de stock effectuée avec succès sur le port 8083:', response);
        return response;
      }),
      catchError(error => {
        console.error('Erreur lors de la sortie de stock sur le port 8083:', error);
        
        // En cas d'échec, essayer avec l'URL alternative (port 8082)
        console.log(`Tentative de sortie de stock sur le port 8082 pour le produit ${productId}`);
        return this.http.post<StockMovement>(`${this.alternativeApiUrl}/product/${productId}`, null, { headers, params }).pipe(
          map(response => {
            // Le backend est disponible
            this.backendAvailable = true;
            console.log('Sortie de stock effectuée avec succès sur le port 8082:', response);
            return response;
          }),
          catchError(alternativeError => {
            console.error('Erreur lors de la sortie de stock sur le port 8082:', alternativeError);
            
            // Si c'est une erreur de connexion, marquer le backend comme indisponible
            this.backendAvailable = false;
            return throwError(() => new Error(
              'Le serveur de gestion de stock n\'est pas disponible. Impossible d\'effectuer une sortie de stock.'
            ));
          })
        );
      })
    );
  }

  /**
   * Vérifie si un produit a suffisamment de stock disponible
   * @param productId ID du produit
   * @param quantity Quantité requise
   * @returns Observable indiquant si le stock est suffisant
   */
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

  /**
   * Génère des mouvements de stock fictifs pour le développement
   * @param count Nombre de mouvements à générer
   * @returns Tableau de mouvements fictifs
   */
  private getMockMovements(count: number = 10): StockMovement[] {
    const types: ('ENTRY' | 'EXIT')[] = ['ENTRY', 'EXIT'];
    const products = [
      { id: '1', name: 'Ordinateur portable' },
      { id: '2', name: 'Écran 24 pouces' },
      { id: '3', name: 'Clavier mécanique' },
      { id: '4', name: 'Souris sans fil' },
      { id: '5', name: 'Disque SSD 1TB' }
    ];
    
    const reasons = [
      'Réception commande',
      'Retour client',
      'Ajustement inventaire',
      'Vente',
      'Transfert entrepôt'
    ];
    
    const movements: StockMovement[] = [];
    
    for (let i = 0; i < count; i++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      const reason = reasons[Math.floor(Math.random() * reasons.length)];
      
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 30));
      
      movements.push({
        id: `mov-${i + 1}`,
        date: date.toISOString(),
        productId: product.id,
        productName: product.name,
        type: type,
        quantity: Math.floor(Math.random() * 20) + 1,
        reference: `REF-${Math.floor(Math.random() * 1000)}`,
        reason: reason,
        userId: 'user-1',
        userName: 'John Doe'
      });
    }
    
    // Trier par date décroissante
    return movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}
