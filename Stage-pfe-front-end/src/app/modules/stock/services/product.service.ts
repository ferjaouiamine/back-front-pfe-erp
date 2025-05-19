import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, delay } from 'rxjs/operators';
import { AuthService } from '../../auth/services/auth.service';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  category: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  // URL de l'API pour les produits - point d'accès à votre backend Spring Boot
  private apiUrl = 'http://localhost:8082/api/products';
  // URL de secours pour les produits
  private backupApiUrl = 'http://localhost:8082/api/produits';

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

  // Récupérer tous les produits depuis le backend Spring Boot
  getProducts(): Observable<Product[]> {
    console.log('Récupération des produits depuis le backend Spring Boot:', this.apiUrl);
    
    return this.http.get<any>(this.apiUrl, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        console.log('Réponse du backend Spring Boot pour les produits:', response);
        
        let products: Product[] = [];
        
        if (Array.isArray(response)) {
          // Mapper les données du backend aux propriétés du modèle Product
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
        } else if (response && response.content && Array.isArray(response.content)) {
          // Format de réponse paginée
          products = response.content.map((item: any) => ({
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
        
        console.log('Produits récupérés:', products.length, 'produits trouvés');
        return products;
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des produits:', error);
        // Propager l'erreur au composant au lieu d'utiliser des données fictives
        throw error;
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
        id: '1',
        name: 'MacBook Air M2',
        description: 'Ordinateur portable Apple avec puce M2',
        price: 1299.99,
        quantity: 10,
        category: 'NULL',
        imageUrl: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        name: 'MacBook Air M2',
        description: 'Ordinateur portable Apple avec puce M2',
        price: 1299.99,
        quantity: 10,
        category: '1',
        imageUrl: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }
  
  // Générer des données factices pour les produits
  private generateMockProducts(): Product[] {
    const categories = ['Ordinateurs', 'Téléphones', 'Accessoires', 'Tablettes', 'Périphériques'];
    const products: Product[] = [
      {
        id: 'prod_1',
        name: 'Ordinateur portable HP EliteBook',
        description: 'Ordinateur portable professionnel avec processeur Intel Core i7, 16 Go de RAM et 512 Go de SSD',
        price: 1299.99,
        quantity: 15,
        category: 'Ordinateurs',
        imageUrl: 'https://via.placeholder.com/150',
        createdAt: new Date(2024, 1, 15),
        updatedAt: new Date(2024, 1, 15)
      },
      {
        id: 'prod_2',
        name: 'Ordinateur de bureau Dell XPS',
        description: 'Ordinateur de bureau puissant avec processeur Intel Core i9, 32 Go de RAM et 1 To de SSD',
        price: 1899.99,
        quantity: 8,
        category: 'Ordinateurs',
        imageUrl: 'https://via.placeholder.com/150',
        createdAt: new Date(2024, 2, 10),
        updatedAt: new Date(2024, 2, 10)
      },
      {
        id: 'prod_3',
        name: 'MacBook Pro 16"',
        description: 'Ordinateur portable Apple avec puce M2 Pro, 16 Go de RAM et 512 Go de SSD',
        price: 2499.99,
        quantity: 5,
        category: 'Ordinateurs',
        imageUrl: 'https://via.placeholder.com/150',
        createdAt: new Date(2024, 0, 20),
        updatedAt: new Date(2024, 0, 20)
      },
      {
        id: 'prod_4',
        name: 'iPhone 14 Pro',
        description: 'Smartphone Apple avec écran Super Retina XDR, puce A16 Bionic et appareil photo 48 MP',
        price: 1099.99,
        quantity: 20,
        category: 'Téléphones',
        imageUrl: 'https://via.placeholder.com/150',
        createdAt: new Date(2024, 3, 5),
        updatedAt: new Date(2024, 3, 5)
      },
      {
        id: 'prod_5',
        name: 'Samsung Galaxy S23',
        description: 'Smartphone Samsung avec écran Dynamic AMOLED, processeur Snapdragon 8 Gen 2 et appareil photo 200 MP',
        price: 999.99,
        quantity: 18,
        category: 'Téléphones',
        imageUrl: 'https://via.placeholder.com/150',
        createdAt: new Date(2024, 2, 25),
        updatedAt: new Date(2024, 2, 25)
      },
      {
        id: 'prod_6',
        name: 'Tablette iPad Pro',
        description: 'Tablette Apple avec puce M2, écran Liquid Retina XDR et compatibilité Apple Pencil',
        price: 1099.99,
        quantity: 12,
        category: 'Tablettes',
        imageUrl: 'https://via.placeholder.com/150',
        createdAt: new Date(2024, 1, 5),
        updatedAt: new Date(2024, 1, 5)
      },
      {
        id: 'prod_7',
        name: 'Tablette Samsung Galaxy Tab',
        description: 'Tablette Samsung avec écran Super AMOLED, processeur Snapdragon et S Pen inclus',
        price: 849.99,
        quantity: 10,
        category: 'Tablettes',
        imageUrl: 'https://via.placeholder.com/150',
        createdAt: new Date(2024, 3, 15),
        updatedAt: new Date(2024, 3, 15)
      },
      {
        id: 'prod_8',
        name: 'Casque sans fil Sony',
        description: 'Casque à réduction de bruit avec autonomie de 30 heures et son haute résolution',
        price: 349.99,
        quantity: 25,
        category: 'Accessoires',
        imageUrl: 'https://via.placeholder.com/150',
        createdAt: new Date(2024, 0, 10),
        updatedAt: new Date(2024, 0, 10)
      },
      {
        id: 'prod_9',
        name: 'Souris Logitech MX Master',
        description: 'Souris sans fil ergonomique avec capteur haute précision et autonomie de 70 jours',
        price: 99.99,
        quantity: 30,
        category: 'Accessoires',
        imageUrl: 'https://via.placeholder.com/150',
        createdAt: new Date(2024, 2, 20),
        updatedAt: new Date(2024, 2, 20)
      },
      {
        id: 'prod_10',
        name: 'Clavier mécanique Corsair',
        description: 'Clavier mécanique gaming avec rétroéclairage RGB et switches Cherry MX',
        price: 149.99,
        quantity: 22,
        category: 'Accessoires',
        imageUrl: 'https://via.placeholder.com/150',
        createdAt: new Date(2024, 1, 25),
        updatedAt: new Date(2024, 1, 25)
      },
      {
        id: 'prod_11',
        name: 'Moniteur LG UltraWide',
        description: 'Moniteur 34 pouces avec résolution 3440x1440, taux de rafraîchissement 144 Hz et temps de réponse 1 ms',
        price: 699.99,
        quantity: 7,
        category: 'Périphériques',
        imageUrl: 'https://via.placeholder.com/150',
        createdAt: new Date(2024, 0, 5),
        updatedAt: new Date(2024, 0, 5)
      },
      {
        id: 'prod_12',
        name: 'Imprimante HP LaserJet',
        description: 'Imprimante laser multifonction avec impression recto-verso automatique et connectivité Wi-Fi',
        price: 299.99,
        quantity: 9,
        category: 'Périphériques',
        imageUrl: 'https://via.placeholder.com/150',
        createdAt: new Date(2024, 3, 10),
        updatedAt: new Date(2024, 3, 10)
      },
      {
        id: 'prod_13',
        name: 'Disque dur externe Seagate',
        description: 'Disque dur externe 4 To avec connectivité USB-C et vitesse de transfert jusqu\'\u00e0 140 Mo/s',
        price: 129.99,
        quantity: 15,
        category: 'Accessoires',
        imageUrl: 'https://via.placeholder.com/150',
        createdAt: new Date(2024, 2, 15),
        updatedAt: new Date(2024, 2, 15)
      },
      {
        id: 'prod_14',
        name: 'Clé USB SanDisk',
        description: 'Clé USB 128 Go avec vitesse de lecture jusqu\'\u00e0 130 Mo/s et connecteur rétractable',
        price: 29.99,
        quantity: 40,
        category: 'Accessoires',
        imageUrl: 'https://via.placeholder.com/150',
        createdAt: new Date(2024, 1, 20),
        updatedAt: new Date(2024, 1, 20)
      },
      {
        id: 'prod_15',
        name: 'Chargeur sans fil Belkin',
        description: 'Chargeur sans fil 15W compatible avec tous les appareils Qi',
        price: 49.99,
        quantity: 35,
        category: 'Accessoires',
        imageUrl: 'https://via.placeholder.com/150',
        createdAt: new Date(2024, 0, 15),
        updatedAt: new Date(2024, 0, 15)
      }
    ];
    
    return products;
  }

  // Récupérer un produit par son ID depuis le backend Spring Boot
  getProductById(id: string): Observable<Product> {
    console.log(`Récupération du produit ${id} depuis le backend Spring Boot:`, `${this.apiUrl}/${id}`);
    return this.http.get<Product>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() }).pipe(
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
    return this.http.get<Product[]>(`${this.apiUrl}/search?query=${encodeURIComponent(query)}`, 
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
              product.description.toLowerCase().includes(lowercaseQuery) ||
              product.category.toLowerCase().includes(lowercaseQuery)
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
    return this.http.get<any>(`${this.apiUrl}/category/name/${encodeURIComponent(category)}`, { headers: this.getAuthHeaders() }).pipe(
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
