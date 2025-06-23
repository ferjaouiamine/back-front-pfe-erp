import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, delay } from 'rxjs/operators';
import { AuthService } from '../../auth/services/auth.service';

export interface Product {
  sku?: any; // Rendu optionnel avec le point d'interrogation
  id?: number;
  reference?: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  alertThreshold?: number;
  active?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  category?: {
    id?: number | string;
    name?: string;
  };
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
    // Forcer l'utilisation des données réelles uniquement - Ne jamais utiliser de données fictives
    useMockData = false;
    console.log('Utilisation forcée des données réelles pour les produits');
    
    if (!this.backendAvailable) {
      console.error('Le serveur de gestion de produits n\'est pas disponible');
      // Retourner une erreur au lieu de données fictives
      return throwError(() => new Error('Le serveur de gestion de produits n\'est pas disponible. Impossible de récupérer les produits.'));
    }
    
    console.log('Tentative de récupération des produits depuis le backend sur le port 8082');
    
    // Essayer d'abord avec le backend sur le port 8082
    return this.http.get<any>(this.apiUrl, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        console.log('Réponse du backend Spring Boot pour les produits:', response);
        // Marquer le backend comme disponible puisque la requête a réussi
        this.backendAvailable = true;
        
        let products: Product[] = [];
        
        if (Array.isArray(response)) {
          // Mapper les données du backend aux propriétés du modèle Product
          products = response.map((item: any) => {
            return {
              id: typeof item.id === 'number' ? item.id : Number(item.id),
              reference: item.reference || '',
              name: item.name || '',
              description: item.description || '',
              price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
              quantity: typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity) || 0,
              alertThreshold: typeof item.alertThreshold === 'number' ? item.alertThreshold : parseInt(item.alertThreshold) || 0,
              active: item.active !== undefined ? item.active : true,
              category: item.category ? {
                id: typeof item.category.id === 'number' ? item.category.id : Number(item.category.id),
                name: item.category.name || ''
              } : undefined,
              createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
            };
          });
        } else if (response && response.content && Array.isArray(response.content)) {
          // Format de réponse paginée
          products = response.content.map((item: any) => {
            return {
              id: typeof item.id === 'number' ? item.id : Number(item.id),
              reference: item.reference || '',
              name: item.name || '',
              description: item.description || '',
              price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
              quantity: typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity) || 0,
              alertThreshold: typeof item.alertThreshold === 'number' ? item.alertThreshold : parseInt(item.alertThreshold) || 0,
              active: item.active !== undefined ? item.active : true,
              category: item.category ? {
                id: typeof item.category.id === 'number' ? item.category.id : Number(item.category.id),
                name: item.category.name || ''
              } : undefined,
              createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
            };
          });
        }
        
        if (products.length === 0) {
          throw new Error('Aucun produit n\'a été trouvé dans la base de données');
        }
        
        console.log('Produits récupérés de la base de données:', products.length, 'produits trouvés');
        return products;
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des produits sur le port 8082:', error);
        
        // En cas d'échec, essayer avec le backend sur le port 8082
        console.log('Tentative de récupération des produits depuis le backend sur le port 8082');
        return this.http.get<any>(this.alternativeApiUrl, { headers: this.getAuthHeaders() }).pipe(
          map(response => {
            console.log('Réponse du backend alternatif pour les produits:', response);
            // Marquer le backend comme disponible puisque la requête a réussi
            this.backendAvailable = true;
            
            let products: Product[] = [];
            
            if (Array.isArray(response)) {
              products = response.map((item: any) => this.mapResponseToProduct(item));
            } else if (response && response.content && Array.isArray(response.content)) {
              products = response.content.map((item: any) => this.mapResponseToProduct(item));
            }
            
            if (products.length === 0) {
              throw new Error('Aucun produit n\'a été trouvé dans la base de données');
            }
            
            console.log('Produits récupérés du backend alternatif:', products.length, 'produits trouvés');
            return products;
          }),
          catchError(alternativeError => {
            console.error('Erreur lors de la récupération des produits sur le port 8082:', alternativeError);
            
            // Marquer le backend comme indisponible
            this.backendAvailable = false;
            
            // Ne jamais utiliser de données fictives, retourner une erreur
            console.error('Impossible de se connecter aux backends sur les ports 8080 et 8082');
            return throwError(() => new Error('Impossible de récupérer les produits. Les serveurs ne sont pas disponibles.'))
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
          products = response;
        } else if (response && response.data && Array.isArray(response.data)) {
          products = response.data;
        } else if (response && typeof response === 'object') {
          // Essayer de convertir un objet en tableau
          const filteredItems = Object.values(response).filter(item => typeof item === 'object' && item !== null);
          products = filteredItems as Product[];
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
  
  // Générer des données factices pour les produits
  private generateMockProducts(): Product[] {
    const products: Product[] = [
      {
        id: 1,
        reference: 'REF-HP-001',
        name: 'Ordinateur portable HP EliteBook',
        description: 'Ordinateur portable professionnel avec processeur Intel Core i7, 16 Go de RAM et 512 Go de SSD',
        price: 1299.99,
        quantity: 15,
        alertThreshold: 5,
        active: true,
        category: {
          id: 1,
          name: 'Ordinateurs'
        },
        createdAt: new Date(2024, 1, 15),
        updatedAt: new Date(2024, 1, 15)
      },
      {
        id: 2,
        reference: 'REF-DELL-002',
        name: 'Ordinateur de bureau Dell XPS',
        description: 'Ordinateur de bureau puissant avec processeur Intel Core i9, 32 Go de RAM et 1 To de SSD',
        price: 1899.99,
        quantity: 8,
        alertThreshold: 3,
        active: true,
        category: {
          id: 1,
          name: 'Ordinateurs'
        },
        createdAt: new Date(2024, 2, 10),
        updatedAt: new Date(2024, 2, 10)
      },
      {
        id: 3,
        reference: 'REF-MAC-003',
        name: 'MacBook Pro 16"',
        description: 'Ordinateur portable Apple avec puce M2 Pro, 16 Go de RAM et 512 Go de SSD',
        price: 2499.99,
        quantity: 5,
        alertThreshold: 2,
        active: true,
        category: {
          id: 1,
          name: 'Ordinateurs'
        },
        createdAt: new Date(2024, 0, 20),
        updatedAt: new Date(2024, 0, 20)
      },
      {
        id: 4,
        reference: 'REF-IPH-004',
        name: 'iPhone 14 Pro',
        description: 'Smartphone Apple avec écran Super Retina XDR, puce A16 Bionic et appareil photo 48 MP',
        price: 1099.99,
        quantity: 20,
        alertThreshold: 5,
        active: true,
        category: {
          id: 2,
          name: 'Téléphones'
        },
        createdAt: new Date(2024, 3, 5),
        updatedAt: new Date(2024, 3, 5)
      },
      {
        id: 5,
        reference: 'REF-SAM-005',
        name: 'Samsung Galaxy S23',
        description: 'Smartphone Samsung avec écran Dynamic AMOLED, processeur Snapdragon 8 Gen 2 et appareil photo 200 MP',
        price: 999.99,
        quantity: 18,
        alertThreshold: 5,
        active: true,
        category: {
          id: 2,
          name: 'Téléphones'
        },
        createdAt: new Date(2024, 2, 25),
        updatedAt: new Date(2024, 2, 25)
      },
      {
        id: 6,
        reference: 'REF-IPAD-006',
        name: 'Tablette iPad Pro',
        description: 'Tablette Apple avec puce M2, écran Liquid Retina XDR et compatibilité Apple Pencil',
        price: 1099.99,
        quantity: 12,
        alertThreshold: 3,
        active: true,
        category: {
          id: 3,
          name: 'Tablettes'
        },
        createdAt: new Date(2024, 1, 5),
        updatedAt: new Date(2024, 1, 5)
      },
      {
        id: 7,
        reference: 'REF-TAB-007',
        name: 'Tablette Samsung Galaxy Tab',
        description: 'Tablette Samsung avec écran Super AMOLED, processeur Snapdragon et S Pen inclus',
        price: 849.99,
        quantity: 10,
        alertThreshold: 3,
        active: true,
        category: {
          id: 3,
          name: 'Tablettes'
        },
        createdAt: new Date(2024, 3, 15),
        updatedAt: new Date(2024, 3, 15)
      },
      {
        id: 8,
        reference: 'REF-SONY-008',
        name: 'Casque sans fil Sony',
        description: 'Casque à réduction de bruit avec autonomie de 30 heures et son haute résolution',
        price: 349.99,
        quantity: 25,
        alertThreshold: 5,
        active: true,
        category: {
          id: 4,
          name: 'Accessoires'
        },
        createdAt: new Date(2024, 0, 10),
        updatedAt: new Date(2024, 0, 10)
      },
      {
        id: 9,
        reference: 'REF-LOG-009',
        name: 'Souris Logitech MX Master',
        description: 'Souris sans fil ergonomique avec capteur haute précision et autonomie de 70 jours',
        price: 99.99,
        quantity: 30,
        alertThreshold: 8,
        active: true,
        category: {
          id: 4,
          name: 'Accessoires'
        },
        createdAt: new Date(2024, 2, 20),
        updatedAt: new Date(2024, 2, 20)
      },
      {
        id: 10,
        reference: 'REF-COR-010',
        name: 'Clavier mécanique Corsair',
        description: 'Clavier mécanique gaming avec rétroéclairage RGB et switches Cherry MX',
        price: 149.99,
        quantity: 22,
        alertThreshold: 5,
        active: true,
        category: {
          id: 4,
          name: 'Accessoires'
        },
        createdAt: new Date(2024, 1, 25),
        updatedAt: new Date(2024, 1, 25)
      },
      {
        id: 11,
        reference: 'REF-LG-011',
        name: 'Moniteur LG UltraWide',
        description: 'Moniteur 34 pouces avec résolution 3440x1440, taux de rafraîchissement 144 Hz et temps de réponse 1 ms',
        price: 699.99,
        quantity: 7,
        alertThreshold: 2,
        active: true,
        category: {
          id: 5,
          name: 'Périphériques'
        },
        createdAt: new Date(2024, 0, 5),
        updatedAt: new Date(2024, 0, 5)
      },
      {
        id: 12,
        reference: 'REF-ASUS-012',
        name: 'Imprimante HP LaserJet',
        description: 'Imprimante laser multifonction avec impression recto-verso automatique et connectivité Wi-Fi',
        price: 299.99,
        quantity: 9,
        alertThreshold: 3,
        active: true,
        category: {
          id: 5,
          name: 'Périphériques'
        },
        createdAt: new Date(2024, 3, 10),
        updatedAt: new Date(2024, 3, 10)
      },
      {
        id: 13,
        reference: 'REF-SEA-013',
        name: 'Disque dur externe Seagate',
        description: 'Disque dur externe 4 To avec connectivité USB-C et vitesse de transfert jusqu\'\u00e0 140 Mo/s',
        price: 129.99,
        quantity: 15,
        alertThreshold: 4,
        active: true,
        category: {
          id: 4,
          name: 'Accessoires'
        },
        createdAt: new Date(2024, 2, 15),
        updatedAt: new Date(2024, 2, 15)
      },
      {
        id: 14,
        reference: 'REF-SAN-014',
        name: 'Clé USB SanDisk',
        description: 'Clé USB 128 Go avec vitesse de lecture jusqu\'\u00e0 130 Mo/s et connecteur rétractable',
        price: 29.99,
        quantity: 40,
        alertThreshold: 10,
        active: true,
        category: {
          id: 4,
          name: 'Accessoires'
        },
        createdAt: new Date(2024, 1, 20),
        updatedAt: new Date(2024, 1, 20)
      },
      {
        id: 15,
        reference: 'REF-BEL-015',
        name: 'Chargeur sans fil Belkin',
        description: 'Chargeur sans fil 15W compatible avec tous les appareils Qi',
        price: 49.99,
        quantity: 35,
        alertThreshold: 8,
        active: true,
        category: {
          id: 4,
          name: 'Accessoires'
        },
        createdAt: new Date(2024, 0, 15),
        updatedAt: new Date(2024, 0, 15)
      }
    ];
    
    return products;
  }

  // Récupérer un produit par son ID depuis le backend Spring Boot
  getProductById(id: string): Observable<Product> {
    // Si le backend est indisponible, retourner une erreur
    if (!this.backendAvailable) {
      return throwError(() => new Error(`Le serveur de gestion de produits n'est pas disponible. Impossible de récupérer le produit ${id}.`));
    }
    
    console.log(`Tentative de récupération du produit ${id} depuis le backend sur le port 8082`);
    
    // Essayer d'abord avec le backend sur le port 8082
    return this.http.get<Product>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() }).pipe(
      map(product => {
        // Marquer le backend comme disponible puisque la requête a réussi
        this.backendAvailable = true;
        console.log(`Produit ${id} récupéré avec succès:`, product);
        return product;
      }),
      catchError(error => {
        console.error(`Erreur lors de la récupération du produit ${id} sur le port 8082:`, error);
        
        // En cas d'échec, essayer avec le backend sur le port 8082
        console.log(`Tentative de récupération du produit ${id} depuis le backend sur le port 8082`);
        return this.http.get<Product>(`${this.alternativeApiUrl}/${id}`, { headers: this.getAuthHeaders() }).pipe(
          map(product => {
            // Marquer le backend comme disponible puisque la requête a réussi
            this.backendAvailable = true;
            console.log(`Produit ${id} récupéré avec succès du backend alternatif:`, product);
            return product;
          }),
          catchError(alternativeError => {
            console.error(`Erreur lors de la récupération du produit ${id} sur le port 8082:`, alternativeError);
            // Marquer le backend comme indisponible
            this.backendAvailable = false;
            // Propager l'erreur au composant
            return throwError(() => new Error(`Impossible de récupérer le produit ${id}. Aucun backend disponible.`));
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
        
        // En cas d'échec, essayer avec le backend sur le port 8082
        return this.http.get<Product[]>(`${this.alternativeApiUrl}/search?query=${encodeURIComponent(query)}`, 
          { headers: this.getAuthHeaders() }
        ).pipe(
          map(products => {
            // Marquer le backend comme disponible puisque la requête a réussi
            this.backendAvailable = true;
            return products;
          }),
          catchError(alternativeError => {
            console.error('Erreur lors de la recherche de produits sur le port 8082:', alternativeError);
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
        
        // En cas d'échec, essayer avec le backend sur le port 8082
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
            console.error('Erreur lors de la récupération des produits à stock faible sur le port 8082:', alternativeError);
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
   * Crée un nouveau produit
   * @param product Les données du produit à créer
   * @returns Observable du produit créé
   */
  createProduct(product: Product): Observable<Product> {
    // Si le backend est indisponible, retourner une erreur
    if (!this.backendAvailable) {
      return throwError(() => new Error('Le serveur de gestion de produits n\'est pas disponible. Impossible de créer le produit.'));
    }
    console.log('Création du produit avec données réelles uniquement:', product);
    
    const headers = this.getAuthHeaders();
    
    // Log des données du produit avant envoi
    console.log('Tentative de création du produit:', product);
    
    // Essayer d'abord avec le backend sur le port principal
    return this.http.post<Product>(this.apiUrl, product, { headers }).pipe(
      map(response => {
        // Marquer le backend comme disponible puisque la requête a réussi
        this.backendAvailable = true;
        console.log('Produit créé avec succès:', response);
        
        // Créer un mouvement de stock pour l'entrée initiale si la quantité > 0
        if (response && response.id && response.quantity > 0) {
          this.createStockMovement(response.id, response.quantity, 'ENTRY', 'Création initiale du produit');
        }
        
        return response;
      }),
      catchError(error => {
        console.error('Erreur lors de la création du produit sur le port principal:', error);
        
        // En cas d'échec, essayer avec le backend sur le port alternatif
        return this.http.post<Product>(this.alternativeApiUrl, product, { headers }).pipe(
          map(response => {
            // Marquer le backend comme disponible puisque la requête a réussi
            this.backendAvailable = true;
            console.log('Produit créé avec succès sur le port alternatif:', response);
            
            // Créer un mouvement de stock pour l'entrée initiale si la quantité > 0
            if (response && response.id && response.quantity > 0) {
              this.createStockMovement(response.id, response.quantity, 'ENTRY', 'Création initiale du produit');
            }
            
            return response;
          }),
          catchError(alternativeError => {
            console.error('Erreur lors de la création du produit sur le port alternatif:', alternativeError);
            // Marquer le backend comme indisponible
            this.backendAvailable = false;
            return throwError(() => new Error(`Échec de la création du produit: ${alternativeError.message}`));
          })
        );
      })
    );
  }
  
  /**
   * Met à jour un produit existant
   * @param product Les données du produit à mettre à jour
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
        // Marquer le backend comme disponible puisque la requête a réussi
        this.backendAvailable = true;
        return response;
      }),
      catchError(error => {
        console.error('Erreur lors de la suppression du produit sur le port 8082:', error);
        
        // En cas d'échec, essayer avec le backend sur le port 8082
        return this.http.delete(`${this.alternativeApiUrl}/${id}`, { headers }).pipe(
          map(response => {
            // Marquer le backend comme disponible puisque la requête a réussi
            this.backendAvailable = true;
            return response;
          }),
          catchError(alternativeError => {
            console.error('Erreur lors de la suppression du produit sur le port 8082:', alternativeError);
            // Marquer le backend comme indisponible
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
            products.forEach(product => {
              if (product.category && product.category.id) {
                const categoryId = product.category.id.toString();
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
