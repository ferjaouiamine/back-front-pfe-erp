import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, delay } from 'rxjs/operators';
import { AuthService } from '../../auth/services/auth.service';

export interface Product {
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
    id?: number;
    name?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  // URL de l'API pour les produits - utilisation du proxy Angular
  private apiUrl = '/api/products';
  // URL directe vers le backend (à utiliser en cas d'échec du proxy)
  private directApiUrl = 'http://localhost:8082/api/products';
  // URL de secours pour les produits
  private backupApiUrl = '/api/produits';

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
    // Si useMockData est true, retourner directement des données fictives
    if (useMockData) {
      console.log('Utilisation de données fictives pour les produits');
      const mockProducts = this.generateMockProductsFromMySQLStructure();
      return of(mockProducts).pipe(delay(300)); // Simuler un délai de réseau
    }
    
    console.log('Récupération des produits depuis la base de données:', this.directApiUrl);
    
    return this.http.get<any>(this.directApiUrl, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        console.log('Réponse du backend Spring Boot pour les produits:', response);
        
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
        console.error('Erreur lors de la récupération des produits:', error);
        
        // En cas d'échec, essayer avec l'URL directe
        return this.getProductsFromUrl(this.directApiUrl).pipe(
          catchError(directError => {
            console.error('Erreur lors de la récupération directe des produits:', directError);
            
            // En cas d'échec, essayer avec l'URL de secours
            return this.getProductsFromUrl(this.backupApiUrl).pipe(
              catchError(backupError => {
                console.error('Erreur lors de la récupération de secours des produits:', backupError);
                
                // En dernier recours, générer des données fictives
                console.log('Génération de données fictives pour les produits');
                const mockProducts = this.generateMockProductsFromMySQLStructure();
                return of(mockProducts).pipe(delay(300)); // Simuler un délai de réseau
              })
            );
          })
        );
      })
    );
  }
  
  /**
   * Récupère tous les produits, à la fois réels et fictifs
   * @returns Observable contenant un tableau de produits réels et fictifs
   */
  getAllProductsRealAndMock(): Observable<{real: Product[], mock: Product[]}> {
    // Récupérer les produits réels
    const realProducts$ = this.getProducts(false).pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération des produits réels:', error);
        return of([]);
      })
    );
    
    // Récupérer les produits fictifs
    const mockProducts$ = of(this.generateMockProductsFromMySQLStructure()).pipe(delay(300));
    
    // Combiner les deux sources de données
    return new Observable<{real: Product[], mock: Product[]}>(observer => {
      let real: Product[] = [];
      let mock: Product[] = [];
      let realDone = false;
      let mockDone = false;
      
      const checkComplete = () => {
        if (realDone && mockDone) {
          observer.next({ real, mock });
          observer.complete();
        }
      };
      
      realProducts$.subscribe({
        next: (products) => {
          real = products;
          realDone = true;
          checkComplete();
        },
        error: (err) => {
          console.error('Erreur lors de la récupération des produits réels:', err);
          realDone = true;
          checkComplete();
        }
      });
      
      mockProducts$.subscribe({
        next: (products) => {
          mock = products;
          mockDone = true;
          checkComplete();
        },
        error: (err) => {
          console.error('Erreur lors de la récupération des produits fictifs:', err);
          mockDone = true;
          checkComplete();
        }
      });
    });
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
    console.log(`Récupération du produit ${id} depuis le backend Spring Boot:`, `${this.directApiUrl}/${id}`);
    return this.http.get<Product>(`${this.directApiUrl}/${id}`, { headers: this.getAuthHeaders() }).pipe(
      map(product => {
        console.log(`Produit ${id} récupéré avec succès:`, product);
        return product;
      }),
      catchError(error => {
        console.error(`Erreur lors de la récupération du produit ${id}:`, error);
        // Propager l'erreur au composant
        throw error;
      })
    );
  }

  // Rechercher des produits par nom ou catégorie
  searchProducts(query: string): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.directApiUrl}/search?query=${encodeURIComponent(query)}`, 
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(error => {
        console.error('Erreur lors de la recherche de produits:', error);
        // En cas d'erreur, rechercher dans les données locales
        return this.getProducts().pipe(
          map(products => {
            const lowercaseQuery = query.toLowerCase();
            return products.filter(product => 
              product.name.toLowerCase().includes(lowercaseQuery) || 
              (product.description && product.description.toLowerCase().includes(lowercaseQuery)) ||
              (product.category && product.category.name && product.category.name.toLowerCase().includes(lowercaseQuery))
            );
          })
        );
      })
    );
  }

  // Filtrer les produits par catégorie
  getProductsByCategory(category: string): Observable<Product[]> {
    if (category.toLowerCase() === 'toutes les catégories') {
      return this.getProducts();
    }
    return this.http.get<any>(`${this.directApiUrl}/category/name/${encodeURIComponent(category)}`, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        let products: Product[] = [];
        
        if (Array.isArray(response)) {
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
        }
        
        return products;
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des produits par catégorie:', error);
        throw error;
      })
    );
  }

  // Récupérer les produits avec un stock faible
  getLowStockProducts(threshold: number = 10): Observable<Product[]> {
    return this.http.get<any>(`${this.apiUrl}/low-stock`, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        let products: Product[] = [];
        
        if (Array.isArray(response)) {
          products = response.map((item: any) => ({
            id: item.id?.toString() || '',
            name: item.name || '',
            description: item.description || '',
            price: parseFloat(item.price) || 0,
            quantity: parseInt(item.quantity) || 0,
            category: item.category?.name || '',
            imageUrl: item.imageUrl || undefined,
            createdAt: new Date(item.createdAt || Date.now()),
            updatedAt: new Date(item.updatedAt || Date.now())
          }));
        }
        
        return products;
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des produits à stock faible:', error);
        throw error;
      })
    );
  }
}
