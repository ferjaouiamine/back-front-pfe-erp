import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { 
  SaleTransaction, 
  CartItem, 
  CashRegisterSession, 
  SessionStatus,
  PaymentMethod,
  TransactionStatus,
  CashRegisterReport
} from '../models/pos.models';
import { AuthService } from '../../auth/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class CaisseService {
  private apiUrl = 'http://localhost:8082/api/pos';
  private alternativeApiUrl = 'http://localhost:8083/api/pos';
  private backendAvailable = false; // Forcer l'utilisation des données fictives
  private mockDelay = 500; // Délai pour les données fictives (ms)
  private showedMockWarning = false; // Pour éviter d'afficher plusieurs fois l'avertissement

  constructor(
    private http: HttpClient,
    public authService: AuthService
  ) { }

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
            } as SaleTransaction).pipe(delay(this.mockDelay));
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
    let params = new HttpParams().set('query', query);
    
    return this.http.get<any[]>(`${this.apiUrl}/products/search`, { headers, params }).pipe(
      tap(() => this.backendAvailable = true),
      catchError(error => {
        // Essayer l'URL alternative
        return this.http.get<any[]>(`${this.alternativeApiUrl}/products/search`, { headers, params }).pipe(
          tap(() => this.backendAvailable = true),
          catchError(() => {
            this.backendAvailable = false;
            // Générer des produits fictifs
            return this.generateMockProducts(query);
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
    
    return of(mockSession).pipe(delay(this.mockDelay));
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
    
    return of(mockSession).pipe(delay(this.mockDelay));
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
    
    return of(mockTransaction).pipe(delay(this.mockDelay));
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
    
    return of(mockTransactions).pipe(delay(this.mockDelay));
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
    
    return of(mockReport).pipe(delay(this.mockDelay));
  }

  /**
   * Génère des produits fictifs basés sur une recherche
   */
  private generateMockProducts(query: string): Observable<any[]> {
    const mockProducts = [];
    const count = Math.floor(Math.random() * 5) + 1;
    
    for (let i = 0; i < count; i++) {
      mockProducts.push({
        id: `prod-${Date.now()}-${i}`,
        name: `${query} Produit ${i+1}`,
        barcode: `BARCODE-${Math.floor(Math.random() * 10000)}`,
        price: Math.floor(Math.random() * 100) + 1,
        stockQuantity: Math.floor(Math.random() * 100) + 10,
        category: 'Catégorie fictive',
        description: 'Description fictive pour un produit généré automatiquement',
        isFictive: true
      });
    }
    
    return of(mockProducts).pipe(delay(this.mockDelay));
  }

  /**
   * Vérifie si le backend est disponible
   */
  isBackendAvailable(): boolean {
    return this.backendAvailable;
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
            return of(transaction).pipe(delay(this.mockDelay));
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
}

// Helper pour le délai
function delay(ms: number) {
  return (source: Observable<any>) => new Observable<any>(observer => {
    const subscription = source.subscribe({
      next(value) {
        const timeout = setTimeout(() => {
          observer.next(value);
        }, ms);
        return () => clearTimeout(timeout);
      },
      error(err) { observer.error(err); },
      complete() {
        const timeout = setTimeout(() => {
          observer.complete();
        }, ms);
        return () => clearTimeout(timeout);
      }
    });
    return () => subscription.unsubscribe();
  });
}
