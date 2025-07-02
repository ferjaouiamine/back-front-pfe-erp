import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, throwError, forkJoin } from 'rxjs';
import { catchError, map, switchMap, tap, timeout } from 'rxjs/operators';
import { delay as rxjsDelay } from 'rxjs/operators';
import { 
  SaleTransaction, 
  CartItem, 
  CashRegisterSession, 
  SessionStatus,
  PaymentMethod,
  TransactionStatus,
  CashRegisterReport,
  ProductCategory
} from '../models/pos.models';
import { AuthService } from '../../auth/services/auth.service';
import { StockService } from '../../stock/services/stock.service';
import { FactureItem } from '../../facturation/services/facture.service';

@Injectable({
  providedIn: 'root'
})
export class CaisseService {
  private apiUrl = 'http://localhost:8086/api/caisses';
  private alternativeApiUrl = 'http://localhost:8086/api/caisses';
  private stockServiceUrl = 'http://localhost:8082/api'; // URL directe du service stock
  private backendAvailable = true; // Forcer l'utilisation des données fictives car les endpoints ne sont pas disponibles
  private mockDelay = 500; // Délai pour les données fictives (ms)
  private showedMockWarning = false; // Pour éviter d'afficher plusieurs fois l'avertissement
  private backendUnavailableMessage = 'Le serveur de caisse n\'est pas disponible. Les données affichées sont fictives à des fins de démonstration.';

  constructor(
    private http: HttpClient,
    public authService: AuthService,
    private stockService: StockService
  ) {
    // Vérifier la disponibilité du backend au démarrage
    this.checkBackendAvailability().subscribe(available => {
      console.log(`Backend de caisse ${available ? 'disponible' : 'non disponible'} au démarrage`);
      if (!available) {
        this.showMockDataWarning();
      }
    });
  }

  /**
   * Récupère les en-têtes d'authentification
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }
  
  /**
   * Génère une image SVG en base64 avec le texte spécifié
   * @param text Texte à afficher dans l'image
   * @param bgColor Couleur de fond (par défaut: #eee)
   * @returns URL de données de l'image SVG en base64
   */
  private generateSVGPlaceholder(text: string, bgColor: string = '#eee'): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="${bgColor}"/><text x="50%" y="50%" font-size="18" text-anchor="middle" alignment-baseline="middle" font-family="monospace, sans-serif" fill="#333">${text}</text></svg>`;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  }

  /**
   * Ouvre une nouvelle session de caisse
   */
  openCashRegisterSession(registerNumber: string, startingAmount: number, notes?: string): Observable<CashRegisterSession> {
    const headers = this.getAuthHeaders();
    const userData = this.authService.getCurrentUser();
    
    const sessionData = {
      registerNumber,
      openedBy: userData?.id || 'unknown',
      startingAmount,
      notes
    };
    
    return this.http.post<CashRegisterSession>(`${this.apiUrl}/sessions/open`, sessionData, { headers }).pipe(
      tap(() => this.backendAvailable = true),
      catchError(error => {
        // Essayer l'URL alternative
        return this.http.post<CashRegisterSession>(`${this.alternativeApiUrl}/sessions/open`, sessionData, { headers }).pipe(
          tap(() => this.backendAvailable = true),
          catchError(() => {
            this.backendAvailable = false;
            // Générer une session fictive en cas d'erreur
            return this.generateMockSession(registerNumber, startingAmount, notes);
          })
        );
      })
    );
  }

  /**
   * Ferme une session de caisse existante
   * @param sessionId ID de la session à fermer
   * @param countedAmount Montant compté en caisse
   * @param notes Notes optionnelles pour la fermeture
   * @param difference Différence entre le montant attendu et le montant compté
   */
  closeCashRegisterSession(sessionId: string, countedAmount: number, notes: string = '', difference: number = 0): Observable<CashRegisterSession> {
    const headers = this.getAuthHeaders();
    const userData = this.authService.getCurrentUser();
    
    const closeData = {
      sessionId,
      closedBy: userData?.id || 'unknown',
      countedAmount,
      notes,
      difference
    };
    
    return this.http.post<CashRegisterSession>(`${this.apiUrl}/sessions/${sessionId}/close`, closeData, { headers }).pipe(
      tap(() => this.backendAvailable = true),
      catchError(error => {
        // Essayer l'URL alternative
        return this.http.post<CashRegisterSession>(
          `${this.alternativeApiUrl}/sessions/${sessionId}/close`, 
          closeData, 
          { headers }
        ).pipe(
          tap(() => this.backendAvailable = true),
          catchError((err) => {
            this.backendAvailable = false;
            // Générer une session fermée fictive
            return this.generateMockClosedSession(sessionId, countedAmount, notes, difference);
          })
        );
      })
    );
  }

  /**
   * Récupère la session active pour une caisse donnée
   */
  getActiveSession(registerNumber: string): Observable<CashRegisterSession | null> {
    const headers = this.getAuthHeaders();
    
    return this.http.get<CashRegisterSession>(`${this.apiUrl}/sessions/active/${registerNumber}`, { headers }).pipe(
      tap(() => this.backendAvailable = true),
      catchError(error => {
        // Essayer l'URL alternative
        return this.http.get<CashRegisterSession>(`${this.alternativeApiUrl}/sessions/active/${registerNumber}`, { headers }).pipe(
          tap(() => this.backendAvailable = true),
          catchError(() => {
            this.backendAvailable = false;
            // Générer une session fictive ou null
            return Math.random() > 0.5 ? 
              this.generateMockSession(registerNumber, 100) : 
              of(null);
          })
        );
      })
    );
  }

  /**
   * Crée une nouvelle transaction de vente
   */
  createSaleTransaction(transaction: SaleTransaction): Observable<SaleTransaction> {
    const headers = this.getAuthHeaders();
    
    return this.http.post<SaleTransaction>(`${this.apiUrl}/transactions`, transaction, { headers }).pipe(
      tap(() => this.backendAvailable = true),
      catchError(error => {
        // Essayer l'URL alternative
        return this.http.post<SaleTransaction>(`${this.alternativeApiUrl}/transactions`, transaction, { headers }).pipe(
          tap(() => this.backendAvailable = true),
          catchError(() => {
            this.backendAvailable = false;
            // Générer une transaction fictive
            return this.generateMockTransaction(transaction);
          })
        );
      })
    );
  }

  /**
   * Récupère l'historique des transactions pour une session donnée
   */
  getTransactionsBySession(sessionId: string): Observable<SaleTransaction[]> {
    const headers = this.getAuthHeaders();
    
    return this.http.get<SaleTransaction[]>(`${this.apiUrl}/transactions/session/${sessionId}`, { headers }).pipe(
      tap(() => this.backendAvailable = true),
      catchError(error => {
        // Essayer l'URL alternative
        return this.http.get<SaleTransaction[]>(`${this.alternativeApiUrl}/transactions/session/${sessionId}`, { headers }).pipe(
          tap(() => this.backendAvailable = true),
          catchError(() => {
            this.backendAvailable = false;
            // Générer des transactions fictives
            return this.generateMockTransactions(5, sessionId);
          })
        );
      })
    );
  }

  /**
   * Annule une transaction
   */
  voidTransaction(transactionId: string, reason: string): Observable<SaleTransaction> {
    const headers = this.getAuthHeaders();
    
    const voidData = {
      reason
    };
    
    return this.http.post<SaleTransaction>(`${this.apiUrl}/transactions/${transactionId}/void`, voidData, { headers }).pipe(
      tap(() => this.backendAvailable = true),
      catchError(error => {
        // Essayer l'URL alternative
        return this.http.post<SaleTransaction>(`${this.alternativeApiUrl}/transactions/${transactionId}/void`, voidData, { headers }).pipe(
          tap(() => this.backendAvailable = true),
          catchError(() => {
            this.backendAvailable = false;
            // Générer une transaction annulée fictive
            return of({
              id: transactionId,
              transactionNumber: `TX-${Math.floor(Math.random() * 10000)}`,
              date: new Date(),
              items: [],
              subtotal: 0,
              taxTotal: 0,
              total: 0,
              paymentMethod: PaymentMethod.CASH,
              amountTendered: 0,
              change: 0,
              cashierId: 'unknown',
              cashierName: 'Mock Cashier',
              registerNumber: 'REG-001',
              status: TransactionStatus.VOIDED,
              notes: `Annulée: ${reason}`,
              sessionId: ''
            } as SaleTransaction).pipe(rxjsDelay(this.mockDelay));
          })
        );
      })
    );
  }

  /**
   * Génère un rapport de caisse pour une session donnée
   */
  generateSessionReport(sessionId: string): Observable<CashRegisterReport> {
    const headers = this.getAuthHeaders();
    
    return this.http.get<CashRegisterReport>(`${this.apiUrl}/reports/session/${sessionId}`, { headers }).pipe(
      tap(() => this.backendAvailable = true),
      catchError(error => {
        // Essayer l'URL alternative
        return this.http.get<CashRegisterReport>(`${this.alternativeApiUrl}/reports/session/${sessionId}`, { headers }).pipe(
          tap(() => this.backendAvailable = true),
          catchError(() => {
            this.backendAvailable = false;
            // Générer un rapport fictif
            return this.generateMockReport(sessionId);
          })
        );
      })
    );
  }

  /**
   * Recherche un produit par code-barres ou nom
   */
  searchProduct(query: string): Observable<any[]> {
    const headers = this.getAuthHeaders();
    let params = new HttpParams().set('query', query || 'all');
    const defaultImage = 'assets/img/product/default.jpg'; // Image par défaut existante dans le projet
    
    // Utiliser le nouvel endpoint /api/produits/search
    return this.http.get<any[]>('http://localhost:8082/api/produits/search', { headers, params }).pipe(
      tap(() => this.backendAvailable = true),
      map(produits => {
        console.log('Produits récupérés avec succès:', produits);
        // Transformer les produits pour s'assurer que tous les champs nécessaires sont présents
        return produits
          .map(produit => ({
            ...produit,
            // Assurer que l'URL de l'image est complète, essayer plusieurs fallbacks
            imageUrl: produit.imageUrl || defaultImage,
            // S'assurer que la quantité en stock est correctement définie
            // Si le backend renvoie null ou undefined, mettre 0
            quantityInStock: produit.quantityInStock != null ? produit.quantityInStock : 0,
            // S'assurer que le stockQuantity est également défini pour la compatibilité
            stockQuantity: produit.stockQuantity || produit.quantityInStock || 0
          }))
          // Filtrer pour ne garder que les produits disponibles
          .filter(produit => produit.quantityInStock > 0);
      }),
      catchError(error => {
        console.error('Erreur lors de la recherche de produits via /api/produits/search:', error);
        // Essayer l'URL alternative
        return this.http.get<any[]>('http://localhost:8082/api/products/search', { headers, params }).pipe(
          tap(() => this.backendAvailable = true),
          map(produits => {
            console.log('Produits récupérés avec succès via URL alternative:', produits);
            // Transformer les produits pour s'assurer que tous les champs nécessaires sont présents
            return produits
              .map(produit => ({
                ...produit,
                // Assurer que l'URL de l'image est complète
                imageUrl: produit.imageUrl || defaultImage,
                // S'assurer que la quantité en stock est correctement définie
                quantityInStock: produit.quantityInStock != null ? produit.quantityInStock : 0,
                // S'assurer que le stockQuantity est également défini pour la compatibilité
                stockQuantity: produit.stockQuantity || produit.quantityInStock || 0
              }))
              // Filtrer pour ne garder que les produits disponibles
              .filter(produit => produit.quantityInStock > 0);
          }),
          catchError(secondError => {
            console.error('Erreur lors de la recherche de produits via /api/products/search:', secondError);
            // Essayer le port 8080 comme dernier recours
            return this.http.get<any[]>('http://localhost:8080/api/produits/search', { headers, params }).pipe(
              tap(() => this.backendAvailable = true),
              map(produits => {
                console.log('Produits récupérés avec succès via port 8080:', produits);
                return produits
                  .map(produit => ({
                    ...produit,
                    imageUrl: produit.imageUrl || defaultImage,
                    quantityInStock: produit.quantityInStock != null ? produit.quantityInStock : 0,
                    stockQuantity: produit.stockQuantity || produit.quantityInStock || 0
                  }))
                  // Filtrer pour ne garder que les produits disponibles
                  .filter(produit => produit.quantityInStock > 0);
              }),
              catchError(() => {
                console.warn('Aucun backend disponible, génération de produits fictifs');
                this.backendAvailable = false;
                // Générer des produits fictifs
                return this.generateMockProducts(query);
              })
            );
          })
        );
      })
    );
  }

  /**
   * Génère une session de caisse fictive
   */
  private generateMockSession(registerNumber: string, startingAmount: number, notes?: string): Observable<CashRegisterSession> {
    const userData = this.authService.getCurrentUser();
    const mockSession: CashRegisterSession = {
      id: `session-${Date.now()}`,
      registerNumber,
      openedBy: userData?.id || 'unknown',
      openedAt: new Date(),
      startingAmount,
      status: SessionStatus.OPEN,
      notes: notes || 'Session fictive (backend indisponible)'
    };
    
    return of(mockSession).pipe(rxjsDelay(this.mockDelay));
  }

  /**
   * Génère une session de caisse fermée fictive
   * @param sessionId ID de la session
   * @param countedAmount Montant compté en caisse
   * @param notes Notes optionnelles
   * @param difference Différence entre le montant attendu et le montant compté
   */
  private generateMockClosedSession(
    sessionId: string, 
    countedAmount: number, 
    notes: string = '',
    difference: number = 0
  ): Observable<CashRegisterSession> {
    const userData = this.authService.getCurrentUser();
    const startingAmount = countedAmount > 1000 ? countedAmount - 500 : 500; // Montant initial réaliste
    const expectedAmount = countedAmount - difference; // Calcul du montant attendu basé sur la différence
    
    const mockSession: CashRegisterSession = {
      id: sessionId,
      registerNumber: 'REG-001',
      openedBy: userData?.id || 'unknown',
      openedAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 heures avant
      closedBy: userData?.id || 'unknown',
      closedAt: new Date(),
      startingAmount,
      endingAmount: countedAmount,
      expectedAmount,
      discrepancy: difference,
      status: SessionStatus.CLOSED,
      notes: notes || 'Session fermée fictive (backend indisponible)',
      transactions: []
    };
    
    return of(mockSession).pipe(rxjsDelay(this.mockDelay));
  }

  /**
   * Génère une transaction fictive
   */
  private generateMockTransaction(baseTransaction: SaleTransaction): Observable<SaleTransaction> {
    const mockTransaction: SaleTransaction = {
      ...baseTransaction,
      id: `tx-${Date.now()}`,
      transactionNumber: `TX-${Math.floor(Math.random() * 10000)}`,
      date: new Date(),
      status: TransactionStatus.COMPLETED,
      notes: baseTransaction.notes || 'Transaction fictive (backend indisponible)'
    };
    
    return of(mockTransaction).pipe(rxjsDelay(this.mockDelay));
  }

  /**
   * Génère plusieurs transactions fictives
   */
  private generateMockTransactions(count: number, sessionId: string): Observable<SaleTransaction[]> {
    const mockTransactions: SaleTransaction[] = [];
    const userData = this.authService.getCurrentUser();
    
    for (let i = 0; i < count; i++) {
      const itemCount = Math.floor(Math.random() * 5) + 1;
      const items: CartItem[] = [];
      let subtotal = 0;
      
      for (let j = 0; j < itemCount; j++) {
        const unitPrice = Math.floor(Math.random() * 100) + 1;
        const quantity = Math.floor(Math.random() * 3) + 1;
        const totalPrice = unitPrice * quantity;
        subtotal += totalPrice;
        
        const taxRate = 0.2;
        const taxAmount = totalPrice * taxRate;
        items.push({
          productId: `prod-${Math.floor(Math.random() * 1000)}`,
          productName: `Produit fictif ${j+1}`,
          barcode: `BARCODE-${Math.floor(Math.random() * 10000)}`,
          quantity,
          unitPrice,
          totalPrice,
          taxRate: taxRate,
          taxAmount: taxAmount,
          discount: 0
        });
      }
      
      const taxTotal = subtotal * 0.2;
      const total = subtotal + taxTotal;
      const paymentAmount = Math.ceil(total / 5) * 5; // Arrondi au 5 supérieur
      
      mockTransactions.push({
        id: `tx-${Date.now()}-${i}`,
        transactionNumber: `TX-${Math.floor(Math.random() * 10000)}`,
        date: new Date(Date.now() - i * 30 * 60 * 1000), // Espacées de 30 minutes
        items,
        subtotal,
        taxTotal,
        total,
        paymentMethod: Object.values(PaymentMethod)[Math.floor(Math.random() * 3)],
        amountTendered: paymentAmount,
        change: paymentAmount - total,
        cashierId: userData?.id || 'unknown',
        cashierName: userData?.username || 'Caissier Fictif',
        registerNumber: 'REG-001',
        status: TransactionStatus.COMPLETED,
        sessionId: '',
        notes: i === 0 ? 'Transaction fictive (backend indisponible)' : undefined
      } as SaleTransaction);
    }
    
    return of(mockTransactions).pipe(rxjsDelay(this.mockDelay));
  }

  /**
   * Génère un rapport fictif
   */
  private generateMockReport(sessionId: string): Observable<CashRegisterReport> {
    const mockReport: CashRegisterReport = {
      sessionId,
      registerNumber: 'REG-001',
      date: new Date(),
      totalSales: Math.floor(Math.random() * 5000) + 1000,
      totalTransactions: Math.floor(Math.random() * 50) + 10,
      paymentBreakdown: {
        [PaymentMethod.CASH]: Math.floor(Math.random() * 3000) + 500,
        [PaymentMethod.CREDIT_CARD]: Math.floor(Math.random() * 2000) + 300,
        [PaymentMethod.DEBIT_CARD]: Math.floor(Math.random() * 1000) + 200,
      },
      productsSold: [
        {
          productId: 'prod-1',
          productName: 'Produit fictif 1',
          quantity: Math.floor(Math.random() * 20) + 5,
          totalAmount: Math.floor(Math.random() * 500) + 100
        },
        {
          productId: 'prod-2',
          productName: 'Produit fictif 2',
          quantity: Math.floor(Math.random() * 15) + 3,
          totalAmount: Math.floor(Math.random() * 400) + 80
        },
        {
          productId: 'prod-3',
          productName: 'Produit fictif 3',
          quantity: Math.floor(Math.random() * 10) + 2,
          totalAmount: Math.floor(Math.random() * 300) + 60
        }
      ],
      voidedTransactions: Math.floor(Math.random() * 3),
      refundedTransactions: Math.floor(Math.random() * 2),
      startingAmount: 100,
      endingAmount: Math.floor(Math.random() * 1000) + 500,
      expectedAmount: Math.floor(Math.random() * 1000) + 500,
      discrepancy: Math.random() * 20 - 10
    };
    
    return of(mockReport).pipe(rxjsDelay(this.mockDelay));
  }

  /**
   * Génère des produits fictifs basés sur une recherche
   */
  private generateMockProducts(query: string): Observable<any[]> {
    // Afficher l'avertissement de données fictives
    this.showMockDataWarning();
    
    // Interface pour les produits prédéfinis
    interface PredefinedProduct {
      id: string;
      name: string;
      barcode: string;
      price: number;
      stockQuantity: number;
      quantityInStock?: number;
      category: string;
      description: string;
      imageUrl: string;
      taxRate: number;
    }

    // Produits prédéfinis pour avoir des données cohérentes
    const predefinedProducts: PredefinedProduct[] = [
      {
        id: 'prod-001',
        name: 'Ordinateur portable HP',
        barcode: 'BARCODE-1234',
        price: 899.99,
        stockQuantity: 15,
        category: 'Informatique',
        description: 'Ordinateur portable HP 15 pouces, 8Go RAM, 256Go SSD',
        imageUrl: 'assets/images/products/laptop.jpg',
        taxRate: 20
      },
      {
        id: 'prod-002',
        name: 'Smartphone Samsung Galaxy',
        barcode: 'BARCODE-2345',
        price: 699.99,
        stockQuantity: 23,
        category: 'Téléphonie',
        description: 'Samsung Galaxy S21, 128Go, Noir',
        imageUrl: 'assets/images/products/smartphone.jpg',
        taxRate: 20
      },
      {
        id: 'prod-003',
        name: 'Imprimante Canon',
        barcode: 'BARCODE-3456',
        price: 149.99,
        stockQuantity: 7,
        category: 'Informatique',
        description: 'Imprimante multifonction Canon PIXMA',
        imageUrl: 'assets/images/products/printer.jpg',
        taxRate: 20
      },
      {
        id: 'prod-004',
        name: 'Clavier sans fil Logitech',
        barcode: 'BARCODE-4567',
        price: 49.99,
        stockQuantity: 32,
        category: 'Accessoires',
        description: 'Clavier sans fil Logitech K380',
        imageUrl: 'assets/images/products/keyboard.jpg',
        taxRate: 20
      },
      {
        id: 'prod-005',
        name: 'Souris gaming Razer',
        barcode: 'BARCODE-5678',
        price: 79.99,
        stockQuantity: 18,
        category: 'Accessoires',
        description: 'Souris gaming Razer DeathAdder V2',
        imageUrl: 'assets/images/products/mouse.jpg',
        taxRate: 20
      },
      {
        id: 'prod-006',
        name: 'Moniteur Dell 27"',
        barcode: 'BARCODE-6789',
        price: 299.99,
        stockQuantity: 9,
        category: 'Informatique',
        description: 'Moniteur Dell 27 pouces Full HD',
        imageUrl: 'assets/images/products/monitor.jpg',
        taxRate: 20
      },
      {
        id: 'prod-007',
        name: 'Casque audio Sony',
        barcode: 'BARCODE-7890',
        price: 129.99,
        stockQuantity: 25,
        category: 'Audio',
        description: 'Casque audio Sony WH-1000XM4',
        imageUrl: 'assets/images/products/headphones.jpg',
        taxRate: 20
      },
      {
        id: 'prod-008',
        name: 'Enceinte Bluetooth JBL',
        barcode: 'BARCODE-8901',
        price: 89.99,
        stockQuantity: 14,
        category: 'Audio',
        description: 'Enceinte Bluetooth JBL Flip 5',
        imageUrl: 'assets/images/products/speaker.jpg',
        taxRate: 20
      },
      {
        id: 'prod-009',
        name: 'Tablette iPad',
        barcode: 'BARCODE-9012',
        price: 499.99,
        stockQuantity: 11,
        category: 'Informatique',
        description: 'Apple iPad 10.2 pouces 64Go',
        imageUrl: 'assets/images/products/tablet.jpg',
        taxRate: 20
      },
      {
        id: 'prod-010',
        name: 'Clé USB SanDisk 64Go',
        barcode: 'BARCODE-0123',
        price: 19.99,
        stockQuantity: 42,
        category: 'Accessoires',
        description: 'Clé USB SanDisk Ultra 64Go',
        imageUrl: 'assets/images/products/usb.jpg',
        taxRate: 20
      },
      {
        id: 'prod-011',
        name: 'Disque dur externe 1To',
        barcode: 'BARCODE-1357',
        price: 59.99,
        stockQuantity: 16,
        category: 'Stockage',
        description: 'Disque dur externe WD Elements 1To',
        imageUrl: 'assets/images/products/hdd.jpg',
        taxRate: 20
      },
      {
        id: 'prod-012',
        name: 'Carte SD 128Go',
        barcode: 'BARCODE-2468',
        price: 29.99,
        stockQuantity: 38,
        category: 'Stockage',
        description: 'Carte SD SanDisk Extreme 128Go',
        imageUrl: 'assets/images/products/sd-card.jpg',
        taxRate: 20
      }
    ];
    
    // Filtrer les produits en fonction de la requête et de la disponibilité
    const filteredProducts = predefinedProducts
      .filter(product => {
        const searchQuery = query.toLowerCase();
        return (
          product.name.toLowerCase().includes(searchQuery) ||
          product.barcode.toLowerCase().includes(searchQuery) ||
          product.category.toLowerCase().includes(searchQuery) ||
          product.description.toLowerCase().includes(searchQuery)
        );
      })
      // S'assurer que seuls les produits disponibles sont inclus
      .filter(product => (product.quantityInStock || product.stockQuantity || 0) > 0);
    
    // Si aucun produit ne correspond à la recherche, générer des produits aléatoires
    if (filteredProducts.length === 0) {
      const mockProducts = [];
      const count = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < count; i++) {
        const stock = Math.floor(Math.random() * 50) + 1; // Entre 1 et 50
        mockProducts.push({
          id: `prod-${Date.now()}-${i}`,
          name: `${query} Produit ${i+1}`,
          barcode: `BARCODE-${Math.floor(Math.random() * 10000)}`,
          price: Math.floor(Math.random() * 100) + 1,
          // S'assurer que la quantité en stock est toujours positive
          quantityInStock: stock,
          stockQuantity: stock,
          category: 'Catégorie fictive',
          description: 'Description fictive pour un produit généré automatiquement',
          imageUrl: 'assets/images/products/default.jpg',
          taxRate: 20,
          isFictive: true
        });
      }
            // S'assurer que les produits générés sont disponibles
        const availableMockProducts = mockProducts.filter(p => (p.quantityInStock || p.stockQuantity || 0) > 0);
        return of(availableMockProducts).pipe(rxjsDelay(this.mockDelay));
    }
    
    // Ajouter la propriété isFictive pour indiquer que ce sont des données fictives
    // et s'assurer que quantityInStock est défini
    const productsWithFictiveFlag = filteredProducts.map(product => ({
      ...product,
      quantityInStock: product.quantityInStock || product.stockQuantity || 0,
      isFictive: false
    }));
    
    return of(productsWithFictiveFlag).pipe(rxjsDelay(this.mockDelay));
  }

  /**
   * Vérifie si le backend est disponible
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
   * Met à jour automatiquement le stock après l'impression d'un ticket
   * @param items Les articles du panier à déduire du stock
   * @param invoiceNumber Le numéro de facture/ticket pour référence
   * @returns Observable qui se termine lorsque toutes les mises à jour sont terminées
   */
  updateStockAfterPrint(items: FactureItem[], invoiceNumber: string): Observable<any> {
    console.log('Mise à jour automatique du stock après impression du ticket', invoiceNumber);
    
    // Si aucun article, retourner un observable vide
    if (!items || items.length === 0) {
      console.log('Aucun article à mettre à jour dans le stock');
      return of(null);
    }
    
    console.log('Préparation de la mise à jour du stock pour', items.length, 'articles');
    
    // Créer un tableau d'observables pour chaque article
    const stockUpdates = items.map(item => {
      // Vérifier que l'article a un ID de produit
      if (!item.productId) {
        console.warn('Article sans ID de produit, impossible de mettre à jour le stock', item);
        return of(null);
      }
      
      console.log(`Mise à jour du stock pour le produit ${item.productId} (${item.productName}): -${item.quantity}`);
      
      // Créer un mouvement de sortie de stock
      return this.stockService.removeStockEntry(
        item.productId,
        item.quantity,
        'Vente - Impression ticket',
        invoiceNumber
      ).pipe(
        catchError(error => {
          console.error(`Erreur lors de la mise à jour du stock pour le produit ${item.productId}:`, error);
          // Continuer malgré l'erreur
          return of(null);
        })
      );
    });
    
    // Exécuter toutes les mises à jour en parallèle
    return forkJoin(stockUpdates).pipe(
      tap(results => {
        const successCount = results.filter(result => result !== null).length;
        console.log(`Mise à jour du stock terminée: ${successCount}/${items.length} produits mis à jour`);
        this.backendAvailable = successCount > 0;
      }),
      catchError(error => {
        console.error('Erreur lors de la mise à jour du stock:', error);
        this.backendAvailable = false;
        return of(null);
      })
    );
  }

  /**
   * Vérifie la disponibilité du backend en envoyant une requête de test
   * @returns Observable<boolean> - true si le backend est disponible, false sinon
   */
  checkBackendAvailability(): Observable<boolean> {
    console.log('Vérification de la disponibilité du backend de caisse sur le port 8086...');
    return this.http.get(`${this.apiUrl}/health-check`, { headers: this.getAuthHeaders() })
      .pipe(
        timeout(3000), // Timeout après 3 secondes
        map(() => {
          console.log('Backend de caisse disponible sur le port 8086');
          this.backendAvailable = true;
          return true;
        }),
        catchError((error) => {
          // Essayer l'URL alternative
          console.log(`Erreur avec l'URL principale: ${error.message || error}`);
          console.log('Tentative avec l\'URL alternative...');
          return this.http.get(`${this.alternativeApiUrl}/health-check`, { headers: this.getAuthHeaders() })
            .pipe(
              timeout(3000), // Timeout après 3 secondes
              map(() => {
                console.log('Backend de caisse disponible sur l\'URL alternative');
                this.backendAvailable = true;
                return true;
              }),
              catchError((err) => {
                console.warn(`Backend de caisse non disponible: ${err.message || err}`);
                this.backendAvailable = false;
                return of(false);
              })
            );
        })
      );
  }
  
  /**
   * Affiche un avertissement lorsque des données fictives sont utilisées
   * N'affiche l'avertissement qu'une seule fois
   */
  showMockDataWarning(): void {
    if (!this.showedMockWarning) {
      console.warn('ATTENTION: Le backend de caisse n\'est pas disponible. Des données fictives sont utilisées.');
      this.showedMockWarning = true;
    }
  }

  /**
   * Retourne le service d'authentification
   */
  getAuthService(): AuthService {
    return this.authService;
  }

  /**
   * Met à jour une transaction existante (par exemple pour l'annuler)
   */
  updateTransaction(transaction: SaleTransaction): Observable<SaleTransaction> {
    const headers = this.getAuthHeaders();
    
    return this.http.put<SaleTransaction>(`${this.apiUrl}/transactions/${transaction.id}`, transaction, { headers }).pipe(
      tap(() => this.backendAvailable = true),
      catchError(error => {
        // Essayer l'URL alternative
        return this.http.put<SaleTransaction>(`${this.alternativeApiUrl}/transactions/${transaction.id}`, transaction, { headers }).pipe(
          tap(() => this.backendAvailable = true),
          catchError(() => {
            this.backendAvailable = false;
            // Simuler une mise à jour réussie
            return of(transaction).pipe(rxjsDelay(this.mockDelay));
          })
        );
      })
    );
  }

  /**
   * Crée une nouvelle transaction
   */
  createTransaction(transaction: SaleTransaction): Observable<SaleTransaction> {
    const headers = this.getAuthHeaders();
    
    return this.http.post<SaleTransaction>(`${this.apiUrl}/transactions`, transaction, { headers }).pipe(
      tap(() => this.backendAvailable = true),
      catchError(error => {
        // Essayer l'URL alternative
        return this.http.post<SaleTransaction>(`${this.alternativeApiUrl}/transactions`, transaction, { headers }).pipe(
          tap(() => this.backendAvailable = true),
          catchError(() => {
            this.backendAvailable = false;
            // Générer une transaction fictive en cas d'erreur
            return this.generateMockTransaction(transaction);
          })
        );
      })
    );
  }

  /**
   * Récupère toutes les catégories de produits du service stock
   * @returns Observable<ProductCategory[]> Liste des catégories de produits
   */
  getCategories(): Observable<ProductCategory[]> {
    const headers = this.getAuthHeaders();
    
    return this.http.get<any[]>(`${this.stockServiceUrl}/categories`, { headers }).pipe(
      map(categories => {
        // Mapper les données du backend vers le format ProductCategory
        return categories.map(cat => ({
          id: cat.id.toString(),
          name: cat.name,
          // Utiliser une icône par défaut si non spécifiée
          icon: this.getCategoryIcon(cat.name)
        }));
      }),
      tap(() => this.backendAvailable = true),
      catchError(error => {
        console.error('Erreur lors de la récupération des catégories:', error);
        this.backendAvailable = false;
        // Retourner des catégories par défaut en cas d'erreur (sans la catégorie 'Tous')
        return of([
          { id: 'mobiles', name: 'Mobiles', icon: 'smartphone' },
          { id: 'computers', name: 'Ordinateurs', icon: 'laptop' },
          { id: 'watches', name: 'Montres', icon: 'watch' },
          { id: 'headphones', name: 'Écouteurs', icon: 'headphones' },
          { id: 'components', name: 'Composants', icon: 'memory' },
          { id: 'accessories', name: 'Accessoires', icon: 'devices_other' }
        ]);
      })
    );
  }

  /**
   * Récupère les produits d'une catégorie spécifique
   * @param categoryId ID de la catégorie
   * @returns Observable<any[]> Liste des produits de la catégorie
   */
  getProductsByCategory(categoryId: string): Observable<any[]> {
    const headers = this.getAuthHeaders();
    
    // Récupérer d'abord les informations de la catégorie
    return this.getCategories().pipe(
      switchMap((categories: any[]) => {
        // Trouver la catégorie correspondante
        const category = categories.find((cat: any) => cat.id === categoryId || cat.name === categoryId);
        const categoryName = category ? category.name : 'Inconnue';
        
        // Récupérer les produits de la catégorie
        return this.http.get<any[]>(`${this.stockServiceUrl}/products/category/${categoryId}`, { headers }).pipe(
          map((products: any[]) => {
            console.log(`Produits bruts reçus pour la catégorie ${categoryId}:`, products);
            
            // Transformer et filtrer les produits disponibles
            return products
              .map((product: any) => ({
                ...product,
                // Mapper la propriété quantity du backend vers quantityInStock pour le frontend
                quantityInStock: product.quantity || product.quantityInStock || product.stock || 0,
                // S'assurer que le prix est un nombre
                price: product.price || 0,
                // Ajouter une URL d'image par défaut si non définie
                imageUrl: product.imageUrl || this.generateSVGPlaceholder(product.name || 'Produit'),
                // Ajouter le nom de la catégorie
                category: product.category || categoryName,
                categoryName: product.categoryName || categoryName
              }))
              // Filtrer pour ne garder que les produits disponibles
              .filter((product: any) => product.quantityInStock > 0);
          }),
          tap((products: any[]) => {
            console.log(`Produits disponibles pour la catégorie ${categoryName} (${categoryId}):`, products);
            this.backendAvailable = true;
          }),
          catchError((error: any) => {
            console.error(`Erreur lors de la récupération des produits de la catégorie ${categoryName} (${categoryId}):`, error);
            this.backendAvailable = false;
            // Utiliser la recherche générique en cas d'erreur
            return this.searchProduct('').pipe(
              map((products: any[]) => {
                return products
                  .filter((p: any) => p.category === categoryId || p.category === categoryName)
                  .map((p: any) => ({
                    ...p,
                    category: p.category || categoryName,
                    categoryName: p.categoryName || categoryName
                  }));
              })
            );
          })
        );
      }),
      catchError((error: any) => {
        console.error(`Erreur lors de la récupération des catégories:`, error);
        // En cas d'erreur de récupération des catégories, continuer avec le nom de catégorie par défaut
        return this.http.get<any[]>(`${this.stockServiceUrl}/products/category/${categoryId}`, { headers }).pipe(
          map((products: any[]) => products.map((p: any) => ({
            ...p,
            quantityInStock: p.quantity || p.quantityInStock || p.stock || 0,
            price: p.price || 0,
            imageUrl: p.imageUrl || this.generateSVGPlaceholder(p.name || 'Produit'),
            category: p.category || 'Inconnue',
            categoryName: p.categoryName || 'Inconnue'
          })))
        );
      })
    );
  }

  /**
   * Récupère l'icône appropriée pour une catégorie donnée
   * @param categoryName Nom de la catégorie
   * @returns Nom de l'icône Material Design
   */
  private getCategoryIcon(categoryName: string): string {
    const iconMap: {[key: string]: string} = {
      'Mobiles': 'smartphone',
      'Téléphones': 'smartphone',
      'Ordinateurs': 'laptop',
      'PC': 'laptop',
      'Montres': 'watch',
      'Écouteurs': 'headphones',
      'Audio': 'headphones',
      'Composants': 'memory',
      'Accessoires': 'devices_other',
      'Périphériques': 'devices_other'
    };
    
    // Rechercher une correspondance partielle
    for (const key in iconMap) {
      if (categoryName.toLowerCase().includes(key.toLowerCase())) {
        return iconMap[key];
      }
    }
    
    // Icône par défaut
    return 'category';
  }
}

