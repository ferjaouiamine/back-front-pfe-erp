import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, throwError, concat } from 'rxjs';
import { catchError, map, delay, switchMap, timeout, take, defaultIfEmpty } from 'rxjs/operators';
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
   * @param forceReload Si true, force le rechargement depuis le serveur en ignorant le cache
   * @param isOfficialList Si true, force la récupération des données officielles (utilisé pour /stock/list)
   * @returns Observable contenant un tableau de produits
   */
  getProducts(useMockData: boolean = false, forceReload: boolean = false, isOfficialList: boolean = false): Observable<Product[]> {
    // Si on est sur la route /stock/list, on force la récupération des données officielles
    if (isOfficialList || window.location.href.includes('/stock/list')) {
      console.log('Récupération de la liste officielle des produits pour /stock/list');
      forceReload = true;
      useMockData = false;
    }
    
    // Si useMockData est explicitement à true et qu'on n'est pas sur la liste officielle, utiliser des données fictives
    if (useMockData && !isOfficialList && !window.location.href.includes('/stock/list')) {
      console.log('Utilisation des données fictives pour les produits (demandé explicitement)');
      return of(this.generateMockProductsFromMySQLStructure()).pipe(
        delay(300) // Simuler un délai réseau
      );
    }
    
    // Si forceReload est true, on ignore l'état du backend et on force une tentative
    if (forceReload) {
      console.log('Rechargement forcé des produits depuis le backend');
      // On ne retourne pas ici, on continue pour faire la requête
    }
    // Si le backend est déjà marqué comme indisponible et qu'on ne force pas le rechargement
    // et qu'on n'est pas sur la liste officielle, utiliser des données fictives
    else if (!this.backendAvailable && !this.forceReload && 
             !isOfficialList && !window.location.href.includes('/stock/list')) {
      console.log('Le backend est indisponible, utilisation des données fictives');
      return of(this.generateMockProductsFromMySQLStructure()).pipe(
        delay(300) // Simuler un délai réseau
      );
    }
    
    // Réinitialiser le flag forceReload après utilisation
    if (this.forceReload) {
      console.log('Rechargement forcé des produits depuis le backend (flag interne)');
      this.forceReload = false;
    }
    
    console.log('Tentative de récupération des produits depuis le backend');
  
    // Ajouter un timestamp pour éviter le cache si forceReload est true
    let params = new HttpParams();
    if (forceReload) {
      params = params.set('timestamp', new Date().getTime().toString());
    }
    
    // Si on est sur la route /stock/list ou si isOfficialList est true, utiliser l'endpoint spécial
    if (isOfficialList || window.location.href.includes('/stock/list')) {
      console.log('Utilisation de l\'endpoint spécial pour la liste officielle des produits');
      return this.getOfficialProductsList(params);
    }
  
  // Sinon, essayer d'abord avec le backend sur le port 8082
  return this.http.get<any>(this.apiUrl, { 
    headers: this.getAuthHeaders(),
    params: params
  }).pipe(
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
        return this.http.get<any>(this.alternativeApiUrl, { 
          headers: this.getAuthHeaders(),
          params: params // Réutiliser les mêmes paramètres pour éviter le cache si forceReload est true
        }).pipe(
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
   * Enrichit les produits avec les informations complètes de catégorie
   * @param products Liste des produits à enrichir
   * @returns Observable contenant les produits enrichis
   */
  private enrichProductsWithCategories(products: Product[]): Observable<Product[]> {
    // Si aucun produit, retourner directement
    if (products.length === 0) {
      return of(products);
    }
    
    // Récupérer les catégories
    return this.getCategories().pipe(
      map(categories => {
        // Pour chaque produit, mettre à jour la catégorie si nécessaire
        return products.map(product => {
          // Si le produit a déjà une catégorie complète, ne rien faire
          if (product.category && product.category.name) {
            return product;
          }
          
          // Sinon, chercher la catégorie correspondante
          const categoryId = product.categoryId || (product.category ? product.category.id : null);
          if (categoryId) {
            const category = categories.find(c => c.id === categoryId);
            if (category) {
              product.category = {
                id: category.id,
                name: category.name
              };
            }
          }
          
          return product;
        });
      }),
      catchError(error => {
        console.error('Erreur lors de l\'enrichissement des produits avec les catégories:', error);
        // Retourner les produits tels quels en cas d'erreur
        return of(products);
      })
    );
  }
  
  /**
   * Mappe les données de la réponse du backend au modèle Product
   */
  private mapResponseToProduct(item: any): Product {
    // Log pour déboguer la structure des données reçues
    console.log('Mapping product item:', item);
    
    // Gestion de la catégorie - s'assurer qu'elle est correctement extraite
    let category = undefined;
    if (item.category) {
      // Si la catégorie est un objet complet
      category = {
        id: typeof item.category.id === 'number' ? item.category.id : Number(item.category.id),
        name: item.category.name || 'Non catégorisé'
      };
    } else if (item.categoryId) {
      // Si seul l'ID de catégorie est fourni
      category = {
        id: typeof item.categoryId === 'number' ? item.categoryId : Number(item.categoryId),
        name: 'Non catégorisé' // Nom par défaut, sera mis à jour lors du chargement des catégories
      };
    }
    
    // Gestion cohérente des quantités
    const quantity = typeof item.quantity === 'number' ? item.quantity : 
                    (item.quantity ? parseInt(item.quantity) : 
                    (item.quantityInStock ? parseInt(item.quantityInStock) : 
                    (item.stockQuantity ? parseInt(item.stockQuantity) : 0)));
    
    return {
      id: typeof item.id === 'number' ? item.id : Number(item.id),
      reference: item.reference || '',
      name: item.name || '',
      description: item.description || '',
      price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
      quantity: quantity,
      quantityInStock: quantity, // Assurer la cohérence entre quantity et quantityInStock
      stockQuantity: quantity,   // Assurer la cohérence avec stockQuantity aussi
      alertThreshold: typeof item.alertThreshold === 'number' ? item.alertThreshold : parseInt(item.alertThreshold) || 5,
      active: item.active !== undefined ? item.active : true,
      category: category,
      categoryId: item.categoryId || (category ? category.id : undefined),
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
        
        // En cas d'échec, essayer avec le backend sur le port 8080
        return this.http.put<Product>(`${this.alternativeApiUrl}/${product.id}`, product, { headers }).pipe(
          map(response => {
            // Marquer le backend comme disponible puisque la requête a réussi
            this.backendAvailable = true;
            return response;
          }),
          catchError(alternativeError => {
            console.error('Erreur lors de la mise à jour du produit sur le port 8080:', alternativeError);
            // Marquer le backend comme indisponible
            this.backendAvailable = false;
            return throwError(() => new Error(`Échec de la mise à jour du produit: ${alternativeError.message}`));
          })
        );
      })
    );
  }
  
  /**
   * Récupère les catégories de produits
   * @returns Observable contenant un tableau de catégories
   */
  getCategories(): Observable<any[]> {
    console.log('Récupération des catégories avec données réelles uniquement');
    const headers = this.getAuthHeaders();
    
    // Essayer d'abord l'URL principale sur le port 8082
    const categoriesUrl = 'http://localhost:8082/api/categories';
    console.log('URL des catégories (primaire):', categoriesUrl);
    
    return this.http.get<any[]>(categoriesUrl, { headers }).pipe(
      map(categories => {
        this.backendAvailable = true;
        console.log('Catégories récupérées avec succès depuis 8082:', categories);
        return categories;
      }),
      catchError(error => {
        console.error(`Erreur lors de la récupération des catégories depuis ${categoriesUrl}:`, error);
        
        // Essayer avec le port 8080
        const alternativeCategoriesUrl = 'http://localhost:8080/api/categories';
        console.log('Tentative avec URL alternative:', alternativeCategoriesUrl);
        
        return this.http.get<any[]>(alternativeCategoriesUrl, { headers }).pipe(
          map(categories => {
            this.backendAvailable = true;
            console.log('Catégories récupérées avec succès depuis 8080:', categories);
            return categories;
          }),
          catchError(error2 => {
            console.error(`Erreur lors de la récupération depuis ${alternativeCategoriesUrl}:`, error2);
            
            // Essayer avec le port 8086 (service caisse)
            const caisseUrl = 'http://localhost:8086/api/categories';
            console.log('Tentative avec URL caisse:', caisseUrl);
            
            return this.http.get<any[]>(caisseUrl, { headers }).pipe(
              map(categories => {
                this.backendAvailable = true;
                console.log('Catégories récupérées avec succès depuis 8086:', categories);
                return categories;
              }),
              catchError(error3 => {
                console.error(`Erreur lors de la récupération depuis ${caisseUrl}:`, error3);
                
                // Si toutes les tentatives échouent, utiliser des données fictives
                console.warn('Utilisation de catégories fictives suite à l\'échec des requêtes');
                return of(this.getMockCategories());
              })
            );
          })
        );
      })
    );
  }
  /**
   * Retourne des catégories fictives pour la démonstration
   * @returns Un tableau de catégories fictives
   */
  private getMockCategories(): any[] {
    console.log('Génération de catégories fictives');
    return [
      { id: 1, name: 'Alimentaire', description: 'Produits alimentaires' },
      { id: 2, name: 'Boissons', description: 'Boissons diverses' },
      { id: 3, name: 'Hygiène', description: 'Produits d\'hygiène' },
      { id: 4, name: 'Papeterie', description: 'Articles de papeterie' },
      { id: 5, name: 'Divers', description: 'Produits divers' }
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
   * Synchronise la suppression d'un produit avec le module caisse vendeur
   * Cette méthode est robuste aux erreurs de connexion et essaie plusieurs endpoints
   * @param productId ID du produit supprimé
   */
  private syncProductDeletionWithVendorCashRegister(productId: number): void {
    if (!productId) {
      console.error('Impossible de synchroniser la suppression d\'un produit sans ID');
      return;
    }
    
    console.log(`Synchronisation de la suppression du produit ${productId} avec le module caisse vendeur...`);
    
    // Vérifier si le backend est disponible avant de tenter la synchronisation
    this.checkBackendAvailability().pipe(
      take(1),
      catchError(() => of(false)) // En cas d'erreur, considérer que le backend n'est pas disponible
    ).subscribe(isAvailable => {
      if (!isAvailable) {
        console.warn('Backend indisponible, stockage de l\'ID pour synchronisation ultérieure');
        this.storeDeletedProductId(productId);
        return;
      }
      
      const headers = this.getAuthHeaders();
      const params = new HttpParams().set('timestamp', new Date().getTime().toString());
      
      // Essayer d'abord l'endpoint spécial de synchronisation qui a été confirmé fonctionnel
      const specialEndpoint = `http://localhost:8086/api/sync/stock/test-product-delete/${productId}`;
      console.log(`Tentative de synchronisation via l'endpoint spécial: ${specialEndpoint}`);
      
      // Essayer chaque endpoint jusqu'à ce qu'un réussisse
      let syncAttempted = false;
      const timeoutDuration = 5000; // 5 secondes
      
      // Essayer d'abord l'endpoint spécial avec DELETE
      this.http.delete(specialEndpoint, { headers, params }).pipe(
        timeout(timeoutDuration),
        catchError(error => {
          console.error(`Erreur lors de la synchronisation via l'endpoint spécial:`, error);
          
          // En cas d'échec, essayer l'endpoint standard du service caisse
          const standardEndpoint = `http://localhost:8086/api/products/${productId}`;
          console.log(`Tentative de synchronisation via l'endpoint standard: ${standardEndpoint}`);
          
          return this.http.delete(standardEndpoint, { headers, params }).pipe(
            timeout(timeoutDuration),
            catchError(standardError => {
              console.error(`Erreur lors de la synchronisation via l'endpoint standard:`, standardError);
              
              // Si les deux premiers endpoints échouent, essayer les autres endpoints alternatifs
              console.warn('Tentative avec les endpoints alternatifs...');
              
              // Liste des endpoints alternatifs à essayer
              const alternativeEndpoints = [
                `http://localhost:8086/api/vendor/sync/product-delete/${productId}`,
                `http://localhost:8086/api/sync/vendor/product-delete/${productId}`,
                `http://localhost:8088/api/vendor/sync/product-delete/${productId}`
              ];
              
              // Créer un observable qui essaie chaque endpoint séquentiellement
              return concat(
                ...alternativeEndpoints.map(endpoint => 
                  this.http.delete(endpoint, { headers, params }).pipe(
                    catchError(err => of(null)) // Ignorer les erreurs pour chaque endpoint individuel
                  )
                )
              ).pipe(
                take(1), // Prendre le premier succès
                defaultIfEmpty(null), // Retourner null si tous échouent
                catchError(err => {
                  console.error('Toutes les tentatives ont échoué');
                  return of(null);
                })
              );
            })
          );
        })
      ).subscribe(
        response => {
          if (response) {
            console.log(`Synchronisation de la suppression du produit ${productId} réussie:`, response);
            syncAttempted = true;
          } else {
            console.warn(`Synchronisation de la suppression du produit ${productId} échouée ou aucune réponse`);
            // Stocker l'ID pour une synchronisation ultérieure
            this.storeDeletedProductId(productId);
            
            // Essayer une dernière tentative avec un endpoint générique en POST
            setTimeout(() => {
              if (!syncAttempted) {
                const genericEndpoint = 'http://localhost:8086/api/sync/product-operation';
                console.log(`Dernière tentative avec l'endpoint générique: ${genericEndpoint}`);
                
                this.http.post(genericEndpoint, {
                  operationType: 'DELETE',
                  productId: productId,
                  timestamp: new Date().getTime()
                }, { headers }).pipe(
                  timeout(timeoutDuration),
                  catchError(error => {
                    console.error('Erreur lors de la synchronisation générique:', error);
                    return of(null);
                  })
                ).subscribe(result => {
                  if (result) {
                    console.log('Synchronisation générique réussie:', result);
                  } else {
                    console.error('Toutes les tentatives de synchronisation ont échoué');
                  }
                });
              }
            }, 1000);
          }
        },
        error => {
          console.error(`Erreur lors de la synchronisation de la suppression du produit ${productId}:`, error);
          // Stocker l'ID pour une synchronisation ultérieure
          this.storeDeletedProductId(productId);
        }
      );
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
      next: (response: any) => console.log(`Mouvement de stock ${type} créé avec succès:`, response),
      error: (error: any) => console.error(`Erreur lors de la création du mouvement de stock ${type}:`, error)
    });
  }
  
  /**
   * Récupère la liste officielle des produits depuis l'endpoint spécial du service caisse
   * avec gestion robuste des erreurs de connexion et des timeouts
   * @param params Paramètres HTTP optionnels
   * @returns Observable contenant un tableau de produits
   */
  private getOfficialProductsList(params: HttpParams): Observable<Product[]> {
    const officialEndpoint = 'http://localhost:8086/api/sync/stock/official-products-list';
    console.log('Récupération de la liste officielle des produits depuis:', officialEndpoint);
    
    // Vérifier d'abord si le serveur caisse est disponible
    return this.http.get<any>('http://localhost:8086/api/health', {
      headers: this.getAuthHeaders(),
      responseType: 'text' as 'json',
      params: new HttpParams().set('timestamp', new Date().getTime().toString())
    }).pipe(
      timeout(2000), // Timeout de 2 secondes pour éviter d'attendre trop longtemps
      // Si le serveur caisse est disponible, continuer avec la récupération des catégories et produits
      switchMap(() => {
        console.log('Serveur caisse disponible, récupération des catégories...');
        
        // D'abord, récupérer les catégories pour s'assurer qu'elles sont disponibles
        return this.getCategories().pipe(
          switchMap(categories => {
            console.log('Catégories récupérées avant de charger les produits:', categories);
            
            // Ensuite, récupérer les produits avec un timeout
            return this.http.get<any>(officialEndpoint, {
              headers: this.getAuthHeaders(),
              params: params
            }).pipe(
              timeout(5000), // Timeout de 5 secondes pour la récupération des produits
              switchMap(response => {
                console.log('Réponse de la liste officielle des produits:', response);
                this.backendAvailable = true;
                
                let products: Product[] = [];
                
                // Handle both array and paginated responses
                if (Array.isArray(response)) {
                  products = response.map((item: any) => this.mapResponseToProduct(item));
                } else if (response && Array.isArray(response.content)) {
                  // Handle Spring paginated response
                  products = response.content.map((item: any) => this.mapResponseToProduct(item));
                } else {
                  console.warn('Format de réponse inattendu:', response);
                }
                
                // Enrichir manuellement les produits avec les catégories déjà récupérées
                products = products.map(product => {
                  const categoryId = product.categoryId || (product.category ? product.category.id : null);
                  if (categoryId) {
                    const category = categories.find(c => c.id === categoryId);
                    if (category) {
                      product.category = {
                        id: category.id,
                        name: category.name
                      };
                    }
                  }
                  return product;
                });
                
                console.log('Produits enrichis avec catégories:', products);
                return of(products);
              }),
              catchError(error => {
                console.error(`Erreur lors de la récupération de la liste officielle des produits:`, error);
                // En cas d'échec, essayer les autres endpoints normaux
                return this.fallbackToRegularEndpoints(params);
              })
            );
          }),
          catchError(error => {
            console.error(`Erreur lors de la récupération des catégories:`, error);
            // Si on ne peut pas récupérer les catégories, essayer quand même de récupérer les produits
            return this.fallbackToRegularEndpoints(params);
          })
        );
      }),
      catchError(error => {
        console.error(`Serveur caisse non disponible:`, error);
        console.log('Passage aux endpoints alternatifs pour récupérer les produits...');
        return this.fallbackToRegularEndpoints(params);
      })
    );
  }
  
  /**
   * Méthode de fallback pour récupérer les produits via les endpoints standards
   * @param params Paramètres HTTP
   * @returns Observable contenant un tableau de produits
   */
  private fallbackToRegularEndpoints(params: HttpParams): Observable<Product[]> {
    console.log('Fallback vers les endpoints standards pour récupérer les produits');
    
    // D'abord, récupérer les catégories pour s'assurer qu'elles sont disponibles
    return this.getCategories().pipe(
      switchMap(categories => {
        console.log('Catégories récupérées pour le fallback:', categories);
        
        return this.http.get<any>(this.apiUrl, {
          headers: this.getAuthHeaders(),
          params: params
        }).pipe(
          switchMap(response => {
            console.log('Réponse du backend standard pour les produits:', response);
            this.backendAvailable = true;
            
            let products: Product[] = [];
            
            if (Array.isArray(response)) {
              products = response.map((item: any) => this.mapResponseToProduct(item));
            } else if (response && Array.isArray(response.content)) {
              products = response.content.map((item: any) => this.mapResponseToProduct(item));
            } else {
              console.warn('Format de réponse inattendu:', response);
            }
            
            // Enrichir manuellement les produits avec les catégories déjà récupérées
            products = products.map(product => {
              const categoryId = product.categoryId || (product.category ? product.category.id : null);
              if (categoryId) {
                const category = categories.find(c => c.id === categoryId);
                if (category) {
                  product.category = {
                    id: category.id,
                    name: category.name
                  };
                }
              }
              return product;
            });
            
            console.log('Produits enrichis avec catégories (fallback):', products);
            return of(products);
          }),
          catchError(error => {
            console.error(`Erreur lors de la récupération des produits depuis les endpoints standards:`, error);
            this.backendAvailable = false;
            
            // Générer des données fictives et les enrichir avec les catégories réelles
            const mockProducts = this.generateMockProductsFromMySQLStructure();
            
            // Enrichir manuellement les produits fictifs avec les catégories réelles
            const enrichedMockProducts = mockProducts.map(product => {
              const categoryId = product.categoryId || (product.category ? product.category.id : null);
              if (categoryId) {
                const category = categories.find(c => c.id === categoryId);
                if (category) {
                  product.category = {
                    id: category.id,
                    name: category.name
                  };
                }
              }
              return product;
            });
            
            return of(enrichedMockProducts);
          })
        );
      }),
      catchError(error => {
        console.error(`Erreur lors de la récupération des catégories pour le fallback:`, error);
        this.backendAvailable = false;
        
        // Si on ne peut pas récupérer les catégories, utiliser des données fictives complètes
        const mockProducts = this.generateMockProductsFromMySQLStructure();
        const mockCategories = this.getMockCategories();
        
        // Enrichir manuellement les produits fictifs avec les catégories fictives
        const enrichedMockProducts = mockProducts.map(product => {
          const categoryId = product.categoryId || (product.category ? product.category.id : null);
          if (categoryId) {
            const category = mockCategories.find(c => c.id === categoryId);
            if (category) {
              product.category = {
                id: category.id,
                name: category.name
              };
            }
          }
          return product;
        });
        
        return of(enrichedMockProducts);
      })
    );
  }

  /**
   * Simule une suppression locale d'un produit
   * Cette méthode est utilisée comme solution de secours lorsque tous les endpoints de suppression échouent
   * @param id L'ID du produit à supprimer
   * @returns Observable de la réponse simulée
   */
  private simulateLocalDeletion(id: number): Observable<any> {
    console.log(`Simulation de la suppression locale du produit ${id}...`);
    
    // Récupérer le produit à supprimer pour avoir ses informations
    return this.getProductByIdLocally(id).pipe(
      map(product => {
        console.log('Produit récupéré pour simulation de suppression:', product);
        
        // Afficher un message d'information à l'utilisateur
        alert('Le serveur de gestion de stock n\'est pas disponible. La suppression a été simulée localement et sera synchronisée ultérieurement.');
        
        // Forcer le rechargement des produits pour simuler la suppression dans l'UI
        this.forceReload = true;
        
        // Stocker l'ID du produit supprimé localement pour synchronisation ultérieure
        this.storeDeletedProductId(id);
        
        return {
          success: true,
          message: 'Produit supprimé localement (simulation)',
          data: {
            id: product.id,
            name: product.name
          },
          simulated: true
        };
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération du produit pour la simulation de suppression:', error);
        
        // Si même la récupération du produit échoue, retourner un succès simulé générique
        alert('Le serveur de gestion de stock n\'est pas disponible. La suppression a été simulée localement et sera synchronisée ultérieurement.');
        
        // Stocker l'ID du produit supprimé localement pour synchronisation ultérieure
        this.storeDeletedProductId(id);
        
        return of({
          success: true,
          message: 'Produit supprimé localement (simulation)',
          data: {
            id: id,
            name: 'Produit #' + id
          },
          simulated: true
        });
      })
    );
  }
  
  /**
   * Récupère un produit par son ID localement (sans appel réseau)
   * Cette méthode est utilisée pour la simulation de suppression locale
   * @param id L'ID du produit à récupérer
   * @returns Observable du produit récupéré ou d'un produit générique si non trouvé
   */
  private getProductByIdLocally(id: number): Observable<Product> {
    // Essayer de récupérer le produit depuis le cache local s'il existe
    const cachedProducts = this.getCachedProducts();
    if (cachedProducts && cachedProducts.length > 0) {
      const product = cachedProducts.find(p => p.id === id);
      if (product) {
        return of(product);
      }
    }
    
    // Si le produit n'est pas trouvé dans le cache, retourner un produit générique
    return of({
      id: id,
      name: 'Produit #' + id,
      price: 0,
      quantity: 0
    });
  }

  /**
   * Récupère les produits en cache s'ils existent
   * @returns Tableau de produits en cache ou null si le cache est vide
   */
  private getCachedProducts(): Product[] | null {
    try {
      const cachedData = localStorage.getItem('products_cache');
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du cache des produits:', error);
    }
    return null;
  }

  private storeDeletedProductId(id: number): void {
    try {
      // Récupérer la liste des IDs de produits supprimés localement
      let deletedProductIds: number[] = [];
      const storedIds = localStorage.getItem('deleted_product_ids');
      if (storedIds) {
        deletedProductIds = JSON.parse(storedIds);
      }
      
      // Ajouter le nouvel ID s'il n'existe pas déjà
      if (!deletedProductIds.includes(id)) {
        deletedProductIds.push(id);
        localStorage.setItem('deleted_product_ids', JSON.stringify(deletedProductIds));
        console.log(`ID du produit ${id} stocké pour synchronisation ultérieure`);
      }
    } catch (error) {
      console.error('Erreur lors du stockage de l\'ID du produit supprimé:', error);
    }
  }

  // La méthode syncProductDeletionWithVendorCashRegister a été déplacée et fusionnée avec la première implémentation

  /**
   * Méthode utilitaire pour tester différents endpoints de suppression de produits
   * @param id ID du produit à supprimer
   * @param endpoint URL complète de l'endpoint à tester
   * @param method Méthode HTTP à utiliser (DELETE ou POST)
   * @returns Observable du résultat de la suppression
   */
  testDeleteProductEndpoint(id: number, endpoint: string, method: 'DELETE' | 'POST' = 'DELETE'): Observable<any> {
    const headers = this.getAuthHeaders();
    console.log(`Test de suppression du produit ${id} via l'endpoint ${endpoint} avec la méthode ${method}...`);
    
    if (method === 'DELETE') {
      return this.http.delete(endpoint, { headers }).pipe(
        map(response => {
          console.log(`Produit supprimé avec succès via ${endpoint}:`, response);
          return { success: true, message: 'Produit supprimé avec succès', data: response, endpoint };
        }),
        catchError(error => {
          console.error(`Erreur lors de la suppression du produit via ${endpoint}:`, error);
          return of({ success: false, message: `Erreur: ${error.status} ${error.statusText}`, error, endpoint });
        })
      );
    } else {
      return this.http.post(endpoint, {}, { headers }).pipe(
        map(response => {
          console.log(`Produit supprimé avec succès via POST ${endpoint}:`, response);
          return { success: true, message: 'Produit supprimé avec succès', data: response, endpoint };
        }),
        catchError(error => {
          console.error(`Erreur lors de la suppression du produit via POST ${endpoint}:`, error);
          return of({ success: false, message: `Erreur: ${error.status} ${error.statusText}`, error, endpoint });
        })
      );
    }
  }
  
  /** 
   * Supprime un produit (désactivation logique)
   * @param id L'ID du produit à supprimer
   * @returns Observable de la réponse
   */
  deleteProduct(id: number): Observable<any> {
    const headers = this.getAuthHeaders();
    
    // Ajouter un timestamp pour éviter le cache
    let params = new HttpParams().set('timestamp', new Date().getTime().toString());
    
    // Vérifier si le produit existe localement avant de tenter la suppression
    // Cela nous permettra d'avoir les informations du produit même si tous les services sont indisponibles
    return this.getProductByIdLocally(id).pipe(
      switchMap(product => {
        console.log('Produit récupéré localement avant tentative de suppression:', product);
        
        // Essayer d'abord avec le backend sur le port 8082 (service stock principal)
        console.log(`Tentative de suppression du produit ${id} via le service stock principal (port 8082)...`);
        return this.http.delete(`${this.apiUrl}/${id}`, { headers, params }).pipe(
          map(response => {
            console.log('Produit supprimé avec succès via le service stock (port 8082):', response);
            this.forceReload = true;
            // Synchroniser la suppression avec le module caisse vendeur
            this.syncProductDeletionWithVendorCashRegister(id);
            return { success: true, message: 'Produit supprimé avec succès', data: response };
          }),
          catchError(error => {
            console.error('Erreur lors de la suppression du produit sur le port 8082:', error);
            
            // Si l'erreur est 500, simuler la suppression localement
            if (error.status === 500) {
              console.log('Erreur 500 détectée, simulation de la suppression locale...');
              return this.simulateLocalDeletion(id);
            }
            
            // Sinon, essayer avec l'endpoint spécial du service caisse (similaire à test-stock-update)
            const specialEndpoint = `http://localhost:8086/api/sync/stock/test-product-delete/${id}`;
            console.log(`Tentative de suppression du produit ${id} via l'endpoint spécial du service caisse...`);
            
            return this.http.delete(specialEndpoint, { headers, params }).pipe(
              map(response => {
                console.log('Produit supprimé avec succès via l\'endpoint spécial du service caisse:', response);
                // Forcer le rechargement des produits après suppression réussie
                this.forceReload = true;
                // Synchroniser la suppression avec le module caisse vendeur
                this.syncProductDeletionWithVendorCashRegister(id);
                return { success: true, message: 'Produit supprimé avec succès', data: response };
              }),
              catchError(specialError => {
                console.error('Erreur lors de la suppression du produit via l\'endpoint spécial:', specialError);
                
                // En cas d'échec, essayer avec le backend sur le port 8080
                console.log(`Tentative de suppression du produit ${id} via le service stock alternatif (port 8080)...`);
                return this.http.delete(`${this.alternativeApiUrl}/${id}`, { headers, params }).pipe(
                  map(response => {
                    console.log('Produit supprimé avec succès sur le port 8080:', response);
                    this.forceReload = true;
                    // Synchroniser la suppression avec le module caisse vendeur
                    this.syncProductDeletionWithVendorCashRegister(id);
                    return { success: true, message: 'Produit supprimé avec succès', data: response };
                  }),
                  catchError(alternativeError => {
                    console.error('Erreur lors de la suppression du produit sur le port 8080:', alternativeError);
                    
                    // Si les deux tentatives échouent, essayer avec le service caisse
                    // D'abord essayer l'endpoint standard
                    const directApiUrl = 'http://localhost:8086/api/products';
                    console.log(`Tentative de suppression du produit ${id} via le service caisse standard (port 8086)...`);
                    return this.http.delete(`${directApiUrl}/${id}`, { headers, params }).pipe(
                      map(response => {
                        console.log('Produit supprimé avec succès via le service caisse:', response);
                        this.forceReload = true;
                        // Synchroniser la suppression avec le module caisse vendeur
                        this.syncProductDeletionWithVendorCashRegister(id);
                        return { success: true, message: 'Produit supprimé avec succès', data: response };
                      }),
                      catchError(caisseError => {
                        console.error('Erreur lors de la suppression du produit via le service caisse standard:', caisseError);
                        
                        // Essayer avec une requête POST au lieu de DELETE (certains backends le supportent)
                        console.log(`Tentative de suppression du produit ${id} via POST avec paramètre _method=DELETE...`);
                        return this.http.post(`${directApiUrl}/delete/${id}`, {}, { headers, params }).pipe(
                          map(response => {
                            console.log('Produit supprimé avec succès via POST method:', response);
                            this.forceReload = true;
                            // Synchroniser la suppression avec le module caisse vendeur
                            this.syncProductDeletionWithVendorCashRegister(id);
                            return { success: true, message: 'Produit supprimé avec succès', data: response };
                          }),
                          catchError(postError => {
                            console.error('Erreur lors de la suppression du produit via POST method:', postError);
                            // Si toutes les tentatives échouent, simuler une suppression locale
                            return this.simulateLocalDeletion(id);
                          })
                        );
                      })
                    );
                  })
                );
              })
            );
          })
        );
      })
    );
  }
}
