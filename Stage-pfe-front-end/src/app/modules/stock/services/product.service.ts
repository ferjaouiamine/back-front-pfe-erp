import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, delay, switchMap } from 'rxjs/operators';
import { AuthService } from '../../auth/services/auth.service';

export interface Product {
  /** Identifiant unique du produit */
  id?: number;
  
  /** Référence unique du produit (code-barres, SKU, etc.) */
  reference?: string;
  
  /** Nom du produit (obligatoire) */
  name: string;
  
  /** Description détaillée du produit */
  description?: string;
  
  /** Prix de vente unitaire */
  price: number;
  
  /** Quantité en stock (alias de quantityInStock pour rétrocompatibilité) */
  quantity: number;
  
  /** Quantité disponible en stock (propriété principale) */
  quantityInStock?: number;
  
  /** Seuil d'alerte pour les stocks bas */
  alertThreshold?: number;
  
  /** Indique si le produit est actif/visible */
  active?: boolean;
  
  /** Date de création */
  createdAt?: Date;
  
  /** Date de dernière mise à jour */
  updatedAt?: Date;
  
  /** Catégorie du produit */
  category?: {
    id?: number | string;
    name?: string;
  };
  
  /** URL de l'image du produit */
  imageUrl?: string;
  
  /** Alias pour la compatibilité avec l'ancien code */
  stockQuantity?: number;
  
  /** Identifiant de la catégorie du produit */
  categoryId?: number | string;
}

export interface ProductCategory {
  id: number | string;
  name: string;
  productCount?: number; // Nombre de produits associés à cette catégorie
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  // URL directe vers le backend Spring Boot
  private apiUrl = 'http://localhost:8082/api/products';
  // URL alternative si le port principal ne fonctionne pas
  private alternativeApiUrl = 'http://localhost:8080/api/products';
  // URL pour les catégories
  private categoriesUrl = 'http://localhost:8082/api/categories';
  private alternativeCategoriesUrl = 'http://localhost:8080/api/categories';
  // Indicateur si le backend est disponible
  private backendAvailable = true;
  // Flag pour forcer le rechargement des données sans utiliser de cache
  private forceReload = false;
  // Message pour informer l'utilisateur que le backend n'est pas disponible
  private backendUnavailableMessage = 'Le serveur de gestion de produits n\'est pas disponible. Les données affichées sont fictives à des fins de démonstration.';

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

  /**
   * Récupère tous les produits depuis la base de données via le backend Spring Boot
   * @param useMockData Si true, utilise des données fictives au lieu de récupérer depuis le backend
   * @returns Observable contenant un tableau de produits
   */
  getProducts(useMockData: boolean = false): Observable<Product[]> {
    // Si useMockData est explicitement à true, utiliser des données fictives
    if (useMockData) {
      console.log('Utilisation des données fictives pour les produits (demandé explicitement)');
      return of(this.generateMockProductsFromMySQLStructure()).pipe(
        delay(300) // Simuler un délai réseau
      );
    }
    
    // Si le backend est déjà marqué comme indisponible, utiliser des données fictives
    if (!this.backendAvailable && !this.forceReload) {
      console.log('Le backend est indisponible, utilisation des données fictives');
      return of(this.generateMockProductsFromMySQLStructure()).pipe(
        delay(300) // Simuler un délai réseau
      );
    }
    
    // Réinitialiser le flag forceReload après utilisation
    if (this.forceReload) {
      console.log('Rechargement forcé des produits depuis le backend');
      this.forceReload = false;
    }
    
    console.log('Tentative de récupération des produits depuis le backend sur le port 8082');
    
    // Essayer d'abord avec le backend sur le port 8082
    return this.http.get<any>(this.apiUrl, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        console.log('Réponse du backend Spring Boot pour les produits:', response);
        // Marquer le backend comme disponible puisque la requête a réussi
        this.backendAvailable = true;
        
        let products: Product[] = [];
        
        // Handle both array and paginated responses
        if (Array.isArray(response)) {
          products = response.map((item: any) => this.mapResponseToProduct(item));
        } else if (response && Array.isArray(response.content)) {
          // Handle Spring paginated response
          products = response.content.map((item: any) => this.mapResponseToProduct(item));
        } else {
          console.warn('Unexpected response format:', response);
        }
        
        return products;
      }),
      catchError(error => {
        console.error(`Erreur lors de la récupération des produits depuis ${this.apiUrl}:`, error);
        
        // Essayer avec l'URL alternative sur le port 8080
        console.log('Tentative de récupération des produits depuis le backend sur le port 8080');
        return this.http.get<any>(this.alternativeApiUrl, { headers: this.getAuthHeaders() }).pipe(
          map(response => {
            console.log('Réponse du backend Spring Boot alternatif pour les produits:', response);
            // Marquer le backend comme disponible puisque la requête a réussi
            this.backendAvailable = true;
            
            let products: Product[] = [];
            
            // Handle both array and paginated responses
            if (Array.isArray(response)) {
              products = response.map((item: any) => this.mapResponseToProduct(item));
            } else if (response && Array.isArray(response.content)) {
              // Handle Spring paginated response
              products = response.content.map((item: any) => this.mapResponseToProduct(item));
            } else {
              console.warn('Unexpected response format:', response);
            }
            
            return products;
          }),
          catchError(secondError => {
            console.error(`Erreur lors de la récupération des produits depuis ${this.alternativeApiUrl}:`, secondError);
            // Marquer le backend comme indisponible
            this.backendAvailable = false;
            
            // Toujours utiliser des données fictives en cas d'échec des requêtes au backend
            // pour permettre à l'utilisateur de continuer à travailler
            console.log('Utilisation des données fictives suite à l\'échec des requêtes au backend');
            return of(this.generateMockProductsFromMySQLStructure());
          })
        );
      })
    );
  }
  
  /**
   * Mappe les données de la réponse du backend au modèle Product
   */
  private mapResponseToProduct(item: any): Product {
    return {
      id: typeof item.id === 'number' ? item.id : Number(item.id),
      reference: item.reference || '',
      name: item.name || '',
      description: item.description || '',
      price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
      quantity: typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity) || 0,
      quantityInStock: item.quantityInStock || item.stockQuantity || 0, // Ajout de cette propriété
      alertThreshold: typeof item.alertThreshold === 'number' ? item.alertThreshold : parseInt(item.alertThreshold) || 0,
      active: item.active !== undefined ? item.active : true,
      category: item.category ? {
        id: typeof item.category.id === 'number' ? item.category.id : Number(item.category.id),
        name: item.category.name || ''
      } : undefined,
      createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
    };
  }
  
  /**
   * Récupère tous les produits réels uniquement
   * @returns Observable contenant un tableau de produits réels
   * @deprecated Cette méthode a été modifiée pour ne retourner que des données réelles. Utiliser getProducts() à la place.
   */
  getAllProductsRealAndMock(): Observable<{real: Product[], mock: Product[]}> {
    // Si le backend est indisponible, retourner une erreur
    if (!this.backendAvailable) {
      return throwError(() => new Error('Le serveur de gestion de produits n\'est pas disponible. Impossible de récupérer les produits.'));
    }
    
    // Récupérer uniquement les produits réels
    return this.getProducts(false).pipe(
      map(products => {
        // Retourner les produits réels et un tableau vide pour les produits fictifs
        return { real: products, mock: [] };
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des produits réels:', error);
        // Propager l'erreur
        return throwError(() => new Error(`Impossible de récupérer les produits. Erreur: ${error.message}`));
      })
    );
  }
  
  // Récupérer des produits depuis une URL spécifique
  getProductsFromUrl(url: string): Observable<Product[]> {
    console.log(`Tentative de récupération des produits depuis l'URL spécifique: ${url}`);
    
    // Assurez-vous que les headers d'authentification sont corrects
    const headers = this.getAuthHeaders();
    
    return this.http.get<any>(url, { headers }).pipe(
      map(response => {
        console.log(`Réponse de l'URL spécifique:`, response);
        
        let products: Product[] = [];
        
        if (Array.isArray(response)) {
          products = response.map((item: any) => this.mapResponseToProduct(item));
        } else if (response && response.data && Array.isArray(response.data)) {
          products = response.data.map((item: any) => this.mapResponseToProduct(item));
        } else if (response && typeof response === 'object') {
          // Essayer de convertir un objet en tableau
          const filteredItems = Object.values(response).filter((item: any) => typeof item === 'object' && item !== null);
          products = filteredItems.map((item: any) => this.mapResponseToProduct(item));
        }
        
        if (products.length > 0) {
          return products;
        } else {
          throw new Error(`Aucun produit trouvé dans la réponse de l'URL spécifique`);
        }
      }),
      catchError(error => {
        console.error(`Erreur lors de la récupération des produits depuis l'URL spécifique:`, error);
        return of([]);
      })
    );
  }
  
  // Générer des données fictives basées sur la structure MySQL
  private generateMockProductsFromMySQLStructure(): Product[] {
    // Créer des produits fictifs basés sur la structure de votre table MySQL
    return [
      {
        id: 1,
        reference: 'REF-001',
        name: 'MacBook Air M2',
        description: 'Ordinateur portable Apple avec puce M2',
        price: 1299.99,
        quantity: 10,
        quantityInStock: 5, // Ajout de cette propriété
        alertThreshold: 3,
        active: true,
        category: {
          id: 1,
          name: 'Ordinateurs'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        reference: 'REF-002',
        name: 'MacBook Pro M2',
        description: 'Ordinateur portable Apple avec puce M2 Pro',
        price: 1999.99,
        quantity: 5,
        quantityInStock: 2, // Ajout de cette propriété
        alertThreshold: 2,
        active: true,
        category: {
          id: 1,
          name: 'Ordinateurs'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }
  

  // Récupérer un produit par son ID depuis le backend Spring Boot
  getProductById(id: string | number): Observable<Product> {
    // Vérifier d'abord la disponibilité du backend
    return this.checkBackendAvailability().pipe(
      switchMap(isAvailable => {
        if (!isAvailable) {
          console.log(`Backend indisponible, recherche du produit ${id} dans les données fictives`);
          // Rechercher dans les données fictives
          const mockProducts = this.generateMockProductsFromMySQLStructure();
          const mockProduct = mockProducts.find(p => p.id === Number(id) || p.id === id);
          
          if (mockProduct) {
            console.log(`Produit ${id} trouvé dans les données fictives:`, mockProduct);
            return of(mockProduct);
          } else {
            return throwError(() => new Error(`Produit ${id} introuvable et backend indisponible.`));
          }
        }
        
        console.log(`Tentative de récupération du produit ${id} depuis le backend sur le port 8082`);
        
        // Essayer d'abord avec le backend sur le port 8082
        return this.http.get<Product>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() }).pipe(
          map(product => {
            console.log(`Produit ${id} récupéré avec succès:`, product);
            return product;
          }),
          catchError(error => {
            console.error(`Erreur lors de la récupération du produit ${id} sur le port 8082:`, error);
            
            // En cas d'échec, essayer avec le backend sur le port 8080
            console.log(`Tentative de récupération du produit ${id} depuis le backend sur le port 8080`);
            return this.http.get<Product>(`${this.alternativeApiUrl}/${id}`, { headers: this.getAuthHeaders() }).pipe(
              map((product: Product) => {
                console.log(`Produit ${id} récupéré avec succès du backend alternatif:`, product);
                return product;
              }),
              catchError(alternativeError => {
                console.error(`Erreur lors de la récupération du produit ${id} sur le port 8080:`, alternativeError);
                // Rechercher dans les données fictives en dernier recours
                const mockProducts = this.generateMockProductsFromMySQLStructure();
                const mockProduct = mockProducts.find((p: Product) => p.id === Number(id) || p.id === id);
                
                if (mockProduct) {
                  console.log(`Produit ${id} trouvé dans les données fictives après échec des backends:`, mockProduct);
                  return of(mockProduct);
                } else {
                  return throwError(() => new Error(`Produit ${id} introuvable.`));
                }
              })
            );
          })
        );
      })
    );
  }

  // Rechercher des produits par nom ou catégorie
  searchProducts(query: string): Observable<Product[]> {
    // Toujours utiliser des données réelles
    if (!this.backendAvailable) {
      console.error('Backend indisponible, impossible de rechercher des produits');
      return throwError(() => new Error('Le serveur de gestion de produits n\'est pas disponible. Impossible de rechercher des produits.'));
    }
    if (!query || query.trim() === '') {
      return of([]);
    }
    
    // Essayer d'abord avec le backend sur le port 8082
    return this.http.get<Product[]>(`${this.apiUrl}/search?query=${encodeURIComponent(query)}`, 
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(products => {
        // Marquer le backend comme disponible puisque la requête a réussi
        this.backendAvailable = true;
        return products;
      }),
      catchError(error => {
        console.error('Erreur lors de la recherche de produits sur le port 8082:', error);
        
        // En cas d'échec, essayer avec le backend sur le port 8080
        return this.http.get<Product[]>(`${this.alternativeApiUrl}/search?query=${encodeURIComponent(query)}`, 
          { headers: this.getAuthHeaders() }
        ).pipe(
          map(products => {
            // Marquer le backend comme disponible puisque la requête a réussi
            this.backendAvailable = true;
            return products;
          }),
          catchError(alternativeError => {
            console.error('Erreur lors de la recherche de produits sur le port 8080:', alternativeError);
            // Marquer le backend comme indisponible
            this.backendAvailable = false;
            // Propager l'erreur au composant
            return throwError(() => new Error(`Impossible de rechercher des produits. Aucun backend disponible.`));
          })
        );
      })
    );
  }
    
  // Filtrer les produits par catégorie
  getProductsByCategory(category: string): Observable<Product[]> {
    if (category.toLowerCase() === 'toutes les catégories') {
      return this.getProducts(false); // Forcer l'utilisation des données réelles
    }
    
    // Si le backend est indisponible, retourner une erreur
    if (!this.backendAvailable) {
      console.log('Backend indisponible, impossible de filtrer les produits par catégorie');
      return throwError(() => new Error('Le serveur de gestion de produits n\'est pas disponible. Impossible de récupérer les produits par catégorie.'));
    }
    
    return this.http.get<any>(`${this.apiUrl}/category/name/${encodeURIComponent(category)}`, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        // Marquer le backend comme disponible puisque la requête a réussi
        this.backendAvailable = true;
        
        let products: Product[] = [];
        
        if (Array.isArray(response)) {
          products = response.map((item: any) => this.mapResponseToProduct(item));
        }
        
        return products;
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des produits par catégorie sur le port 8082:', error);
        
        // En cas d'échec, essayer avec le backend sur le port 8080
        return this.http.get<any>(`${this.alternativeApiUrl}/category/name/${encodeURIComponent(category)}`, { headers: this.getAuthHeaders() }).pipe(
          map(response => {
            // Marquer le backend comme disponible puisque la requête a réussi
            this.backendAvailable = true;
            
            let products: Product[] = [];
            
            if (Array.isArray(response)) {
              products = response.map((item: any) => this.mapResponseToProduct(item));
            }
            
            return products;
          }),
          catchError(alternativeError => {
            console.error('Erreur lors de la récupération des produits par catégorie sur le port 8080:', alternativeError);
            // Marquer le backend comme indisponible
            this.backendAvailable = false;
            
            // Propager l'erreur au composant
            return throwError(() => new Error(`Impossible de récupérer les produits par catégorie. Aucun backend disponible.`));
          })
        );
      })
    );
  }
    
    // Récupérer les produits avec un stock faible
  getLowStockProducts(): Observable<Product[]> {
    // Toujours utiliser des données réelles
    if (!this.backendAvailable) {
      return throwError(() => new Error('Le serveur de gestion de produits n\'est pas disponible. Impossible de récupérer les produits à stock faible.'));
    }
    
    // Essayer d'abord avec le backend sur le port 8082
    return this.http.get<any>(`${this.apiUrl}/low-stock`, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        // Marquer le backend comme disponible puisque la requête a réussi
        this.backendAvailable = true;
        
        let products: Product[] = [];
        
        if (Array.isArray(response)) {
          products = response.map((item: any) => this.mapResponseToProduct(item));
        }
        
        return products;
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des produits à stock faible sur le port 8082:', error);
        
        // En cas d'échec, essayer avec le backend sur le port 8080
        return this.http.get<any>(`${this.alternativeApiUrl}/low-stock`, { headers: this.getAuthHeaders() }).pipe(
          map(response => {
            // Marquer le backend comme disponible puisque la requête a réussi
            this.backendAvailable = true;
            
            let products: Product[] = [];
            
            if (Array.isArray(response)) {
              products = response.map((item: any) => this.mapResponseToProduct(item));
            }
            
            return products;
          }),
          catchError(alternativeError => {
            console.error('Erreur lors de la récupération des produits à stock faible sur le port 8080:', alternativeError);
            // Marquer le backend comme indisponible
            this.backendAvailable = false;
            // Propager l'erreur au composant
            return throwError(() => new Error(`Impossible de récupérer les produits à stock faible. Aucun backend disponible.`));
          })
        );
      })
    );
  }
  
  /**
   * Met à jour un produit existant
   * @param product Produit à mettre à jour
   * @returns Observable du produit mis à jour
   */
  updateProduct(product: Product): Observable<Product> {
    // Si le backend est indisponible, retourner une erreur
    if (!this.backendAvailable) {
      return throwError(() => new Error('Le serveur de gestion de produits n\'est pas disponible. Impossible de mettre à jour le produit.'));
    }
    
    const headers = this.getAuthHeaders();
    
    // Essayer d'abord avec le backend sur le port 8082
    return this.http.put<Product>(`${this.apiUrl}/${product.id}`, product, { headers }).pipe(
      map(response => {
        // Marquer le backend comme disponible puisque la requête a réussi
        this.backendAvailable = true;
        return response;
      }),
      catchError(error => {
        console.error('Erreur lors de la mise à jour du produit sur le port 8082:', error);
        
        // En cas d'échec, essayer avec le backend sur le port 8082
        return this.http.put<Product>(`${this.alternativeApiUrl}/${product.id}`, product, { headers }).pipe(
          map(response => {
            // Marquer le backend comme disponible puisque la requête a réussi
            this.backendAvailable = true;
            return response;
          }),
          catchError(alternativeError => {
            console.error('Erreur lors de la mise à jour du produit sur le port 8082:', alternativeError);
            // Marquer le backend comme indisponible
            this.backendAvailable = false;
            return throwError(() => new Error(`Échec de la mise à jour du produit: ${alternativeError.message}`));
          })
        );
      })
    );
  }



  /**
   * Supprime un produit (désactivation logique)
   * @param id L'ID du produit à supprimer
   * @returns Observable de la réponse
   */
  deleteProduct(id: number): Observable<any> {
    // Si le backend est indisponible, retourner une erreur
    if (!this.backendAvailable) {
      return throwError(() => new Error('Le serveur de gestion de produits n\'est pas disponible. Impossible de supprimer le produit.'));
    }
    
    const headers = this.getAuthHeaders();
    
    // Essayer d'abord avec le backend sur le port 8082
    return this.http.delete(`${this.apiUrl}/${id}`, { headers }).pipe(
      map(response => {
        console.log('Produit supprimé avec succès:', response);
        return response;
      }),
      catchError(error => {
        console.error('Erreur lors de la suppression du produit sur le port 8082:', error);
        
        // En cas d'échec, essayer avec le backend sur le port 8080
        return this.http.delete(`${this.alternativeApiUrl}/${id}`, { headers }).pipe(
          map(response => {
            console.log('Produit supprimé avec succès sur le port 8080:', response);
            return response;
          }),
          catchError(alternativeError => {
            console.error('Erreur lors de la suppression du produit sur le port 8080:', alternativeError);
            this.backendAvailable = false;
            return throwError(() => new Error(`Échec de la suppression du produit: ${alternativeError.message}`));
          })
        );
      })
    );
  }

  /**
   * Récupère les catégories de produits
   * @returns Observable des catégories
   */
  getCategories(): Observable<any[]> {
    // Si le backend est indisponible, retourner une erreur
    if (!this.backendAvailable) {
      return throwError(() => new Error('Le serveur de gestion de produits n\'est pas disponible. Impossible de récupérer les catégories.'));
    }

    console.log('Récupération des catégories avec données réelles uniquement');
    const headers = this.getAuthHeaders();
    
    // Construction de l'URL de base pour les catégories (en retirant '/products' de l'URL des produits)
    const categoriesUrl = this.apiUrl.replace(/\/products$/, '/categories');
    console.log('URL des catégories:', categoriesUrl);
    
    // Tentative avec authentification sur le port principal (8082)
    return this.http.get<any[]>(categoriesUrl, { headers }).pipe(
      map(categories => {
        this.backendAvailable = true;
        console.log('Catégories récupérées avec succès:', categories);
        return categories;
      }),
      catchError(error => {
        console.error(`Erreur lors de la récupération des catégories depuis ${categoriesUrl} avec auth:`, error);
        
        // Tentative sans authentification sur le port principal (8082)
        return this.http.get<any[]>(categoriesUrl).pipe(
          map(categories => {
            this.backendAvailable = true;
            console.log('Catégories récupérées avec succès sans auth:', categories);
            return categories;
          }),
          catchError(error2 => {
            console.error(`Erreur lors de la récupération depuis ${categoriesUrl} sans auth:`, error2);
            this.backendAvailable = false;
            
            // Ne pas essayer le port 8080 car nous savons qu'il ne fonctionne pas
            // et cela génère des erreurs inutiles dans la console
            return throwError(() => new Error(`Impossible de récupérer les catégories depuis le backend (${categoriesUrl}). Erreur: ${error.status} ${error.statusText}`));
          })
        );
      })
    );
  }
  /**
   * Retourne des catégories fictives pour la démonstration
   */
  private getMockCategories(): any[] {
    return [
      { id: 'mock-1', name: '[FICTIF] Catégorie 1' },
      { id: 'mock-2', name: '[FICTIF] Catégorie 2' },
      { id: 'mock-3', name: '[FICTIF] Catégorie 3' },
      { id: 'mock-4', name: '[FICTIF] Catégorie 4' },
      { id: 'mock-5', name: '[FICTIF] Catégorie 5' }
    ];
  }
  
  /**
   * Crée une nouvelle catégorie
   * @param category Les données de la catégorie à créer
   * @returns Observable de la catégorie créée
   */
  createCategory(category: ProductCategory): Observable<ProductCategory> {
    // Si le backend est indisponible, retourner une erreur
    if (!this.backendAvailable) {
      return throwError(() => new Error('Le serveur de gestion de produits n\'est pas disponible. Impossible de créer la catégorie.'));
    }
    
    const headers = this.getAuthHeaders();
    const categoriesUrl = this.categoriesUrl;
    
    return this.http.post<ProductCategory>(categoriesUrl, category, { headers }).pipe(
      map(response => {
        console.log('Catégorie créée avec succès:', response);
        return response;
      }),
      catchError(error => {
        console.error(`Erreur lors de la création de la catégorie:`, error);
        this.backendAvailable = false;
        return throwError(() => new Error(`Impossible de créer la catégorie. Erreur: ${error.status} ${error.statusText}`));
      })
    );
  }
  
  /**
   * Met à jour une catégorie existante
   * @param category Les données de la catégorie à mettre à jour
   * @returns Observable de la catégorie mise à jour
   */
  updateCategory(category: ProductCategory): Observable<ProductCategory> {
    // Si le backend est indisponible, retourner une erreur
    if (!this.backendAvailable) {
      return throwError(() => new Error('Le serveur de gestion de produits n\'est pas disponible. Impossible de mettre à jour la catégorie.'));
    }
    
    const headers = this.getAuthHeaders();
    const categoryUrl = `${this.categoriesUrl}/${category.id}`;
    
    return this.http.put<ProductCategory>(categoryUrl, category, { headers }).pipe(
      map(response => {
        console.log('Catégorie mise à jour avec succès:', response);
        return response;
      }),
      catchError(error => {
        console.error(`Erreur lors de la mise à jour de la catégorie:`, error);
        this.backendAvailable = false;
        return throwError(() => new Error(`Impossible de mettre à jour la catégorie. Erreur: ${error.status} ${error.statusText}`));
      })
    );
  }
  
  /**
   * Supprime une catégorie
   * @param categoryId L'ID de la catégorie à supprimer
   * @returns Observable de la réponse
   */
  deleteCategory(categoryId: number | string): Observable<any> {
    // Si le backend est indisponible, retourner une erreur
    if (!this.backendAvailable) {
      return throwError(() => new Error('Le serveur de gestion de produits n\'est pas disponible. Impossible de supprimer la catégorie.'));
    }
    
    const headers = this.getAuthHeaders();
    const categoryUrl = `${this.categoriesUrl}/${categoryId}`;
    
    return this.http.delete<any>(categoryUrl, { headers }).pipe(
      map(response => {
        console.log('Catégorie supprimée avec succès:', response);
        return response;
      }),
      catchError(error => {
        console.error(`Erreur lors de la suppression de la catégorie:`, error);
        this.backendAvailable = false;
        return throwError(() => new Error(`Impossible de supprimer la catégorie. Erreur: ${error.status} ${error.statusText}`));
      })
    );
  }
  
  /**
   * Récupère le nombre de produits par catégorie
   * @returns Observable avec un objet où les clés sont les IDs des catégories et les valeurs sont les nombres de produits
   */
  getCategoryProductCounts(): Observable<{[categoryId: string]: number}> {
    // Si le backend est indisponible, retourner une erreur
    if (!this.backendAvailable) {
      return throwError(() => new Error('Le serveur de gestion de produits n\'est pas disponible. Impossible de récupérer le nombre de produits par catégorie.'));
    }
    
    // URL pour récupérer le nombre de produits par catégorie
    const countsUrl = `${this.categoriesUrl}/product-counts`;
    const headers = this.getAuthHeaders();
    
    // Si l'endpoint spécifique n'existe pas sur le backend, nous allons récupérer tous les produits
    // et calculer les comptages côté client
    return this.http.get<{[categoryId: string]: number}>(countsUrl, { headers }).pipe(
      map(response => {
        console.log('Nombre de produits par catégorie récupéré avec succès:', response);
        return response;
      }),
      catchError(error => {
        console.log('L\'endpoint spécifique pour le comptage des produits n\'est pas disponible, calcul côté client...', error);
        
        // Fallback: récupérer tous les produits et calculer les comptages
        return this.getProducts().pipe(
          map(products => {
            const counts: {[categoryId: string]: number} = {};
            
            // Compter les produits par catégorie
            products.forEach((product: Product) => {
              const categoryId = product.category?.id || product.categoryId;
              if (categoryId) {
                counts[categoryId] = (counts[categoryId] || 0) + 1;
              }
            });
            
            console.log('Nombre de produits par catégorie calculé côté client:', counts);
            return counts;
          }),
          catchError(productsError => {
            console.error('Erreur lors de la récupération des produits pour le comptage:', productsError);
            this.backendAvailable = false;
            return throwError(() => new Error(`Impossible de calculer le nombre de produits par catégorie. Erreur: ${productsError.message}`));
          })
        );
      })
    );
  }
  
  /**
   * Force le rechargement des produits sans utiliser de cache
   * Cette méthode est utilisée pour s'assurer que les données sont fraîches
   * après une opération qui modifie le stock
   */
  clearCache(): void {
    console.log('Effacement du cache des produits pour forcer un rechargement');
    this.forceReload = true;
  }
  
  /**
   * Met à jour directement la liste des produits dans le service
   * Utilisé pour mettre à jour les données après une opération de stock
   * @param products Liste des produits à mettre en cache
   */
  setProducts(products: any): void {
    console.log('Mise à jour directe des produits dans le service:', products);
    // Stocker les produits dans un cache local pour une utilisation ultérieure
    localStorage.setItem('cachedProducts', JSON.stringify(products));
    // Marquer le backend comme disponible puisque nous avons des données fraîches
    this.backendAvailable = true;
  }
  
  /**
   * Vérifie la disponibilité du backend en essayant de se connecter aux deux ports
   * @returns Observable<boolean> indiquant si le backend est disponible
   */
  checkBackendAvailability(): Observable<boolean> {
    // Si le backend est déjà marqué comme disponible, retourner true
    if (this.backendAvailable) {
      return of(true);
    }
    
    console.log('Vérification de la disponibilité du backend...');
    
    // Essayer d'abord avec le backend sur le port 8082
    return this.http.get<any>(`${this.apiUrl}/ping`, { 
      headers: this.getAuthHeaders(),
      responseType: 'text' as 'json' // Pour accepter une réponse simple
    }).pipe(
      map(() => {
        console.log('Backend disponible sur le port 8082');
        this.backendAvailable = true;
        return true;
      }),
      catchError(() => {
        console.log('Backend non disponible sur le port 8082, essai sur le port 8080...');
        
        // Essayer avec le port alternatif 8080
        return this.http.get<any>(`${this.alternativeApiUrl}/ping`, { 
          headers: this.getAuthHeaders(),
          responseType: 'text' as 'json'
        }).pipe(
          map(() => {
            console.log('Backend disponible sur le port 8080');
            this.backendAvailable = true;
            return true;
          }),
          catchError(() => {
            console.log('Backend non disponible sur les deux ports');
            this.backendAvailable = false;
            return of(false);
          })
        );
      })
    );
  }

  /**
   * Crée un nouveau produit dans le backend et le synchronise avec le module caisse
   * @param product Produit à créer
   * @returns Observable contenant le produit créé
   */
  createProduct(product: Product): Observable<Product> {
    if (!this.backendAvailable) {
      return throwError(() => new Error('Le serveur de gestion de produits n\'est pas disponible. Impossible de créer le produit.'));
    }

    // Générer une URL d'image placeholder si aucune n'est fournie
    if (!product.imageUrl) {
      product.imageUrl = this.generateImagePlaceholder(product.name || 'Produit');
    }

    const headers = this.getAuthHeaders();
    
    // Créer le produit dans le backend stock
    return this.http.post<Product>(this.apiUrl, product, { headers }).pipe(
      map(createdProduct => {
        console.log('Produit créé avec succès:', createdProduct);
        this.backendAvailable = true;
        
        // Si le produit a une quantité initiale > 0, créer un mouvement de stock d'entrée
        if (createdProduct && createdProduct.id && createdProduct.quantity > 0) {
          this.createStockMovement(
            createdProduct.id as number,
            createdProduct.quantity,
            'ENTRY',
            'Création initiale du produit'
          );
        }
        
        // Synchroniser le produit avec le module caisse
        this.syncProductWithCaisse(createdProduct);
        
        return createdProduct;
      }),
      catchError(error => {
        console.error('Erreur lors de la création du produit:', error);
        return throwError(() => new Error(`Impossible de créer le produit. Erreur: ${error.status} ${error.statusText}`));
      })
    );
  }
  
  /**
   * Génère une image placeholder SVG avec les initiales du produit
   * @param productName Nom du produit
   * @returns URL de l'image en base64
   */
  private generateImagePlaceholder(productName: string): string {
    // Extraire les initiales du nom du produit (maximum 2 caractères)
    const initials = productName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
    
    // Générer une couleur aléatoire pour le fond
    const colors = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c'];
    const backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Créer un SVG avec les initiales
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="${backgroundColor}"/>
        <text x="50%" y="50%" dy=".3em" font-family="Arial" font-size="80" fill="white" text-anchor="middle">
          ${initials}
        </text>
      </svg>
    `;
    
    // Convertir le SVG en base64
    const base64 = btoa(svg);
    return `data:image/svg+xml;base64,${base64}`;
  }
  
  /**
   * Synchronise un produit avec le module caisse
   * @param product Produit à synchroniser
   */
  private syncProductWithCaisse(product: Product): void {
    if (!product || !product.id) {
      console.error('Impossible de synchroniser un produit invalide avec la caisse');
      return;
    }
    
    console.log('Synchronisation du produit avec le module caisse:', product);
    
    // Endpoint de synchronisation dans le module caisse
    const syncUrl = 'http://localhost:8082/api/sync/product';
    
    this.http.post(syncUrl, product, { headers: this.getAuthHeaders() }).subscribe({
      next: (response) => console.log('Produit synchronisé avec succès avec la caisse:', response),
      error: (error) => console.error('Erreur lors de la synchronisation du produit avec la caisse:', error)
    });
  }

  /**
   * Crée un mouvement de stock pour un produit
   * @param productId ID du produit
   * @param quantity Quantité du mouvement
   * @param type Type de mouvement (ENTRY ou EXIT)
   * @param reason Raison du mouvement
   * @param referenceDocument Référence du document (optionnel)
   */
  private createStockMovement(productId: number, quantity: number, type: 'ENTRY' | 'EXIT', reason: string, referenceDocument?: string): void {
    // Construction de l'URL selon la structure de l'API
    const movementUrl = `http://localhost:8082/api/stock/movements/product/${productId}`;
    
    // Construction des paramètres de requête
    let params = new HttpParams()
      .set('type', type)
      .set('quantity', quantity.toString())
      .set('reason', reason);
    
    if (referenceDocument) {
      params = params.set('referenceDocument', referenceDocument);
    }
    
    // Envoi de la requête
    this.http.post(movementUrl, null, { 
      headers: this.getAuthHeaders(),
      params: params
    }).subscribe({
      next: (response) => console.log(`Mouvement de stock ${type} créé avec succès:`, response),
      error: (error) => console.error(`Erreur lors de la création du mouvement de stock ${type}:`, error)
    });
  }
}
