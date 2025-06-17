import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, Subject, throwError, of } from 'rxjs';
import { catchError, tap, finalize, map } from 'rxjs/operators';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '../models/purchase-order.model';
import { AuthService } from '../../auth/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class PurchaseOrderService {
  // URLs du backend
  private apiUrl = 'http://localhost:8083/api/commandes'; // Port 8083 selon la configuration du backend
  private backupApiUrl = 'http://localhost:8080/api/commandes';
  private loading = new Subject<boolean>();
  loading$ = this.loading.asObservable();

  private orderCreated = new Subject<PurchaseOrder>();
  orderCreated$ = this.orderCreated.asObservable();

  private orderUpdated = new Subject<PurchaseOrder>();
  orderUpdated$ = this.orderUpdated.asObservable();
  
  // Indicateur de disponibilité du backend
  private backendAvailable = true;
  
  // Indique si on doit forcer l'utilisation de données fictives
  private forceMockData = false;
  
  // Message pour informer l'utilisateur que le backend n'est pas disponible
  private backendUnavailableMessage = 'Le serveur de gestion des commandes n\'est pas disponible. Les données affichées sont fictives à des fins de démonstration.';
  
  // Message pour informer l'utilisateur que les données fictives sont utilisées volontairement
  private mockDataMessage = 'Mode démonstration activé. Les données affichées sont fictives.';
  
  // Stockage local des commandes fictives
  private mockOrders: PurchaseOrder[] = [];

  constructor(private http: HttpClient, private authService: AuthService) {}

  /**
   * Obtient les en-têtes d'authentification pour les requêtes API
   */
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
   * Récupère toutes les commandes d'achat avec filtrage optionnel
   */
  getPurchaseOrders(params?: {
    status?: PurchaseOrderStatus;
    startDate?: Date;
    endDate?: Date;
    supplierId?: string;
    searchTerm?: string;
  }): Observable<PurchaseOrder[]> {
    this.loading.next(true);

    let httpParams = new HttpParams();
    
    if (params) {
      if (params.status) {
        httpParams = httpParams.set('status', params.status);
      }
      
      if (params.startDate) {
        httpParams = httpParams.set('startDate', params.startDate.toISOString());
      }
      
      if (params.endDate) {
        httpParams = httpParams.set('endDate', params.endDate.toISOString());
      }
      
      if (params.supplierId) {
        httpParams = httpParams.set('supplierId', params.supplierId);
      }
      
      if (params.searchTerm) {
        httpParams = httpParams.set('searchTerm', params.searchTerm);
      }
    }

    return this.http.get<any[]>(this.apiUrl, {
      headers: this.getAuthHeaders(),
      params: httpParams
    }).pipe(
      map(orders => orders.map(order => this.mapApiOrderToModel(order))),
      tap(orders => {
        console.log(`${orders.length} commandes d'achat récupérées`);
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des commandes d\'achat:', error);
        this.backendAvailable = false;
        console.log('Utilisation de données fictives pour les commandes d\'achat');
        return of(this.getMockPurchaseOrders());
      }),
      finalize(() => this.loading.next(false))
    );
  }

  /**
   * Récupère une commande d'achat par son ID
   */
  getPurchaseOrderById(id: string): Observable<PurchaseOrder> {
    this.loading.next(true);
    
    // Si le mode données fictives est activé, utiliser directement les données fictives
    if (this.forceMockData) {
      console.log(`Mode données fictives activé, recherche de la commande fictive ${id}`);
      // Chercher d'abord dans le stockage local des commandes fictives
      const localMockOrder = this.mockOrders.find(o => o.id === id);
      if (localMockOrder) {
        console.log(`Commande fictive ${id} trouvée dans le stockage local`);
        setTimeout(() => this.loading.next(false), 500);
        return of(localMockOrder);
      }
      // Sinon chercher dans les commandes fictives générées
      const mockOrder = this.getMockPurchaseOrders().find(o => o.id === id) || this.createEmptyPurchaseOrder();
      setTimeout(() => this.loading.next(false), 500);
      return of(mockOrder);
    }
    
    // Essayer d'abord avec l'URL principale
    return this.http.get<any>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() }).pipe(
      map(order => this.mapApiOrderToModel(order)),
      tap(order => {
        this.backendAvailable = true; // Marquer le backend comme disponible
        this.backendUnavailableMessage = '';
        console.log(`Commande d'achat ${id} récupérée depuis l'API principale:`, order);
      }),
      catchError(primaryError => {
        console.error(`Erreur lors de la récupération de la commande d'achat ${id} avec l'URL principale:`, primaryError);
        console.log(`Tentative avec l'URL de secours: ${this.backupApiUrl}/${id}`);
        
        // Essayer avec l'URL de secours
        return this.http.get<any>(`${this.backupApiUrl}/${id}`, { headers: this.getAuthHeaders() }).pipe(
          map(order => this.mapApiOrderToModel(order)),
          tap(order => {
            console.log(`Commande d'achat ${id} récupérée depuis l'URL de secours:`, order);
            this.backendAvailable = true;
            this.backendUnavailableMessage = 'Utilisation du backend de secours';
          }),
          catchError(secondError => {
            console.error(`Erreur lors de la récupération de la commande d'achat ${id} avec l'URL de secours:`, secondError);
            this.backendAvailable = false;
            this.backendUnavailableMessage = 'Les backends ne sont pas disponibles. Utilisation de données fictives.';
            
            // Chercher d'abord dans le stockage local des commandes fictives créées précédemment
            const localMockOrder = this.mockOrders.find(o => o.id === id);
            if (localMockOrder) {
              console.log(`Commande fictive ${id} trouvée dans le stockage local`);
              return of(localMockOrder);
            }
            
            console.log(`Génération d'une commande fictive pour ${id}`);
            const mockOrder = this.getMockPurchaseOrders().find(o => o.id === id) || this.createEmptyPurchaseOrder();
            return of(mockOrder);
          })
        );
      }),
      finalize(() => this.loading.next(false))
    );
  }

  /**
   * Crée une nouvelle commande d'achat
   */
  createPurchaseOrder(order: Partial<PurchaseOrder>): Observable<PurchaseOrder> {
    this.loading.next(true);
    
    // Si le mode données fictives est activé, utiliser directement les données fictives
    if (this.forceMockData) {
      console.log('Mode données fictives activé, génération d\'une commande fictive');
      const mockOrder = { 
        ...order, 
        id: `order-${Date.now()}`, 
        orderNumber: `CMD-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000) + 1000}`, 
        createdAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString(),
        status: order.status || 'DRAFT' as PurchaseOrderStatus
      } as PurchaseOrder;
      
      // Ajouter la commande fictive au stockage local
      this.mockOrders.push(mockOrder);
      setTimeout(() => {
        this.loading.next(false);
        this.orderCreated.next(mockOrder);
      }, 500);
      return of(mockOrder);
    }
    
    const orderData = this.mapModelToApiOrder(order as PurchaseOrder);
    
    // Essayer d'abord avec l'URL principale
    return this.http.post<any>(this.apiUrl, orderData, { headers: this.getAuthHeaders() }).pipe(
      map(response => this.mapApiOrderToModel(response)),
      tap(createdOrder => {
        this.backendAvailable = true; // Marquer le backend comme disponible
        this.backendUnavailableMessage = '';
        this.orderCreated.next(createdOrder);
        console.log('Commande d\'achat créée sur l\'API principale:', createdOrder);
      }),
      catchError(primaryError => {
        console.error('Erreur lors de la création de la commande d\'achat avec l\'URL principale:', primaryError);
        console.log(`Tentative avec l'URL de secours: ${this.backupApiUrl}`);
        
        // Essayer avec l'URL de secours
        return this.http.post<any>(this.backupApiUrl, orderData, { headers: this.getAuthHeaders() }).pipe(
          map(response => this.mapApiOrderToModel(response)),
          tap(createdOrder => {
            console.log('Commande d\'achat créée depuis l\'URL de secours:', createdOrder);
            this.orderCreated.next(createdOrder);
            this.backendAvailable = true;
            this.backendUnavailableMessage = 'Utilisation du backend de secours';
          }),
          catchError(secondError => {
            console.error('Erreur lors de la création de la commande d\'achat avec l\'URL de secours:', secondError);
            this.backendAvailable = false;
            this.backendUnavailableMessage = 'Les backends ne sont pas disponibles. Utilisation de données fictives.';
            console.log('Génération d\'une commande fictive');
            
            // Créer une commande fictive avec un ID unique et un numéro de commande formaté
            const mockOrder = { 
              ...order, 
              id: `order-${Date.now()}`, 
              orderNumber: `CMD-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000) + 1000}`, 
              createdAt: new Date().toISOString(), 
              updatedAt: new Date().toISOString(),
              status: order.status || 'DRAFT' as PurchaseOrderStatus
            } as PurchaseOrder;
            
            // Ajouter la commande fictive au stockage local pour pouvoir la retrouver plus tard
            this.mockOrders.push(mockOrder);
            this.orderCreated.next(mockOrder);
            
            return of(mockOrder);
          })
        );
      }),
      finalize(() => this.loading.next(false))
    );
  }

  /**
   * Met à jour une commande d'achat existante
   */
  updatePurchaseOrder(id: string, order: Partial<PurchaseOrder>): Observable<PurchaseOrder> {
    this.loading.next(true);
    
    const orderData = this.mapModelToApiOrder(order as PurchaseOrder);
    
    return this.http.put<any>(`${this.apiUrl}/${id}`, orderData, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => this.mapApiOrderToModel(response)),
      tap(updatedOrder => {
        console.log('Commande d\'achat mise à jour:', updatedOrder);
        this.orderUpdated.next(updatedOrder);
      }),
      catchError(error => {
        console.error(`Erreur lors de la mise à jour de la commande d'achat ${id}:`, error);
        this.backendAvailable = false;
        console.log(`Utilisation d'une commande fictive pour simuler la mise à jour de l'ID ${id}`);
        
        // Simuler la mise à jour en retournant l'objet avec les modifications
        const updatedOrder = {
          ...order,
          id: id,
          updatedAt: new Date().toISOString()
        };
        
        return of(updatedOrder as PurchaseOrder);
      }),
      finalize(() => this.loading.next(false))
    );
  }

  /**
   * Met à jour le statut d'une commande d'achat
   */
  updatePurchaseOrderStatus(id: string, status: PurchaseOrderStatus): Observable<PurchaseOrder> {
    this.loading.next(true);
    
    return this.http.patch<any>(`${this.apiUrl}/${id}/status`, { status }, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => this.mapApiOrderToModel(response)),
      tap(updatedOrder => {
        console.log('Statut de la commande d\'achat mis à jour:', updatedOrder);
        this.orderUpdated.next(updatedOrder);
      }),
      catchError(error => {
        console.error(`Erreur lors de la mise à jour du statut de la commande d'achat ${id}:`, error);
        return throwError(() => new Error(`Impossible de mettre à jour le statut de la commande d'achat. ${error.message}`));
      }),
      finalize(() => this.loading.next(false))
    );
  }

  /**
   * Supprime une commande d'achat
   */
  deletePurchaseOrder(id: string): Observable<void> {
    this.loading.next(true);
    
    return this.http.delete<void>(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => {
        console.log(`Commande d'achat ${id} supprimée`);
      }),
      catchError(error => {
        console.error(`Erreur lors de la suppression de la commande d'achat ${id}:`, error);
        return throwError(() => new Error(`Impossible de supprimer la commande d'achat. ${error.message}`));
      }),
      finalize(() => this.loading.next(false))
    );
  }

  /**
   * Génère un PDF pour une commande d'achat
   */
  generatePdf(id: string): Observable<Blob> {
    this.loading.next(true);
    
    return this.http.get(`${this.apiUrl}/${id}/pdf`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    }).pipe(
      tap(() => {
        console.log(`PDF généré pour la commande d'achat ${id}`);
      }),
      catchError(error => {
        console.error(`Erreur lors de la génération du PDF pour la commande d'achat ${id}:`, error);
        return throwError(() => new Error(`Impossible de générer le PDF. ${error.message}`));
      }),
      finalize(() => this.loading.next(false))
    );
  }

  /**
   * Envoie une commande d'achat par email
   */
  sendPurchaseOrderByEmail(id: string, email: string, subject: string, message: string): Observable<any> {
    this.loading.next(true);
    
    const emailData = {
      email,
      subject,
      message
    };
    
    return this.http.post(`${this.apiUrl}/${id}/send-email`, emailData, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => {
        console.log(`Commande d'achat ${id} envoyée par email à ${email}`);
      }),
      catchError(error => {
        console.error(`Erreur lors de l'envoi de la commande d'achat ${id} par email:`, error);
        return throwError(() => new Error(`Impossible d'envoyer la commande d'achat par email. ${error.message}`));
      }),
      finalize(() => this.loading.next(false))
    );
  }

  /**
   * Crée une commande d'achat vide avec des valeurs par défaut
   */
  createEmptyPurchaseOrder(): PurchaseOrder {
    return {
      supplierId: '',
      status: 'DRAFT',
      orderDate: new Date().toISOString(),
      expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 jours plus tard
      items: [],
      total: 0
    };
  }

  // Méthode pour convertir une commande du format API vers le format du modèle
  private mapApiOrderToModel(apiOrder: any): PurchaseOrder {
    // Adaptation du modèle backend (Commande) vers le modèle frontend (PurchaseOrder)
    return {
      id: apiOrder.id?.toString(),
      orderNumber: apiOrder.numero, // Le backend utilise 'numero' au lieu de 'orderNumber'
      supplierId: apiOrder.fournisseur?.id?.toString(),
      supplierName: apiOrder.fournisseur?.nom,
      supplierEmail: apiOrder.fournisseur?.email,
      supplierAddress: apiOrder.fournisseur?.adresse,
      status: this.mapApiStatus(apiOrder.statut), // Le backend utilise 'statut' au lieu de 'status'
      orderDate: apiOrder.dateCommande || new Date().toISOString(), // Le backend utilise 'dateCommande'
      expectedDeliveryDate: apiOrder.dateLivraisonPrevue, // Le backend utilise 'dateLivraisonPrevue'
      deliveryDate: apiOrder.dateLivraisonEffective, // Le backend utilise 'dateLivraisonEffective'
      items: Array.isArray(apiOrder.lignes) ? apiOrder.lignes.map((item: any) => ({
        id: item.id?.toString(),
        productId: item.produit?.id?.toString(),
        productName: item.produit?.nom || item.designation,
        quantity: item.quantite || 0, // Le backend utilise 'quantite'
        unitPrice: item.prixUnitaire || 0, // Le backend utilise 'prixUnitaire'
        total: item.montantHT || (item.quantite * item.prixUnitaire) || 0 // Le backend utilise 'montantHT'
      })) : [],
      total: apiOrder.montantTTC || 0, // Le backend utilise 'montantTTC'
      notes: apiOrder.notes,
      createdAt: apiOrder.dateCreation,
      updatedAt: apiOrder.dateModification
    };
  }

  /**
   * Indique si le backend est disponible
   * @returns true si le backend est disponible, false sinon
   */
  isBackendAvailable(): boolean {
    return this.backendAvailable && !this.forceMockData;
  }
  
  /**
   * Active ou désactive le mode données fictives
   * @param force true pour forcer l'utilisation de données fictives, false pour utiliser le backend si disponible
   */
  setForceMockData(force: boolean): void {
    this.forceMockData = force;
  }
  
  /**
   * Indique si le mode données fictives est activé
   * @returns true si le mode données fictives est activé, false sinon
   */
  isForceMockDataEnabled(): boolean {
    return this.forceMockData;
  }

  /**
   * Retourne le message d'indisponibilité du backend ou de données fictives
   * @returns Message d'indisponibilité ou de données fictives
   */
  getBackendUnavailableMessage(): string {
    if (this.forceMockData) {
      return this.mockDataMessage;
    }
    return this.backendUnavailableMessage;
  }

  /**
   * Génère des commandes d'achat fictives pour le développement
   * @param count Nombre de commandes à générer
   * @returns Tableau de commandes fictives
   */
  private getMockPurchaseOrders(count: number = 10): PurchaseOrder[] {
    const statuses: PurchaseOrderStatus[] = ['DRAFT', 'SENT', 'CONFIRMED', 'DELIVERED', 'CANCELLED'];
    const suppliers = [
      { id: '1', name: 'Fournisseur A', email: 'contact@fournisseura.com', address: 'Adresse A, Ville A' },
      { id: '2', name: 'Fournisseur B', email: 'contact@fournisseurb.com', address: 'Adresse B, Ville B' },
      { id: '3', name: 'Fournisseur C', email: 'contact@fournisseurc.com', address: 'Adresse C, Ville C' }
    ];
    
    const orders: PurchaseOrder[] = [];
    
    for (let i = 0; i < count; i++) {
      const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 30));
      
      const expectedDeliveryDate = new Date(orderDate);
      expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + 7);
      
      const deliveryDate = status === 'DELIVERED' ? new Date(expectedDeliveryDate) : undefined;
      if (deliveryDate) {
        deliveryDate.setDate(deliveryDate.getDate() + Math.floor(Math.random() * 5) - 2);
      }
      
      // Générer des articles pour la commande
      const itemsCount = Math.floor(Math.random() * 5) + 1;
      const items: PurchaseOrderItem[] = [];
      let total = 0;
      
      for (let j = 0; j < itemsCount; j++) {
        const unitPrice = Math.floor(Math.random() * 100) + 10;
        const quantity = Math.floor(Math.random() * 5) + 1;
        const itemTotal = unitPrice * quantity;
        
        items.push({
          id: `item-${i}-${j}`,
          productId: `prod-${Math.floor(Math.random() * 20) + 1}`,
          productName: `Produit ${String.fromCharCode(65 + j)}`,
          quantity: quantity,
          unitPrice: unitPrice,
          total: itemTotal
        });
        
        total += itemTotal;
      }
      
      orders.push({
        id: `order-${i + 1}`,
        orderNumber: `CMD-${2023}-${1000 + i}`,
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierEmail: supplier.email,
        supplierAddress: supplier.address,
        status: status,
        orderDate: orderDate.toISOString(),
        expectedDeliveryDate: expectedDeliveryDate.toISOString(),
        deliveryDate: deliveryDate ? deliveryDate.toISOString() : undefined,
        items: items,
        total: total,
        notes: `Note pour la commande ${i + 1}`,
        createdAt: orderDate.toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    // Trier par date décroissante
    return orders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }

  /**
   * Convertit une commande d'achat du format du modèle au format API
   */
  private mapModelToApiOrder(order: PurchaseOrder): any {
    return {
      id: order.id,
      numero: order.orderNumber, // Le backend utilise 'numero' au lieu de 'orderNumber'
      fournisseur: {
        id: order.supplierId,
        nom: order.supplierName,
        email: order.supplierEmail,
        adresse: order.supplierAddress
      },
      statut: this.mapModelStatus(order.status), // Le backend utilise 'statut' au lieu de 'status'
      dateCommande: order.orderDate, // Le backend utilise 'dateCommande'
      dateLivraisonPrevue: order.expectedDeliveryDate, // Le backend utilise 'dateLivraisonPrevue'
      dateLivraisonEffective: order.deliveryDate, // Le backend utilise 'dateLivraisonEffective'
      lignes: order.items?.map(item => ({
        id: item.id,
        produit: {
          id: item.productId,
          nom: item.productName
        },
        designation: item.productName,
        quantite: item.quantity, // Le backend utilise 'quantite'
        prixUnitaire: item.unitPrice, // Le backend utilise 'prixUnitaire'
        montantHT: item.total // Le backend utilise 'montantHT'
      })) || [],
      montantTTC: order.total, // Le backend utilise 'montantTTC'
      notes: order.notes
    };
  }

  /**
   * Convertit les statuts du backend vers ceux du frontend
   * @param apiStatus Statut du backend
   * @returns Statut du frontend
   */
  private mapApiStatus(apiStatus: string): PurchaseOrderStatus {
    // Conversion des statuts du backend vers les statuts du frontend
    switch (apiStatus) {
      case 'BROUILLON': return 'DRAFT';
      case 'CONFIRMEE': return 'CONFIRMED';
      case 'EN_ATTENTE': 
      case 'EN_COURS': return 'SENT';
      case 'LIVRAISON_PARTIELLE':
      case 'LIVREE': return 'DELIVERED';
      case 'ANNULEE': return 'CANCELLED';
      default: return 'DRAFT';
    }
  }

  /**
   * Convertit les statuts du frontend vers ceux du backend
   * @param modelStatus Statut du frontend
   * @returns Statut du backend
   */
  private mapModelStatus(modelStatus: PurchaseOrderStatus): string {
    // Conversion des statuts du frontend vers les statuts du backend
    switch (modelStatus) {
      case 'DRAFT': return 'BROUILLON';
      case 'SENT': return 'EN_COURS';
      case 'CONFIRMED': return 'CONFIRMEE';
      case 'DELIVERED': return 'LIVREE';
      case 'CANCELLED': return 'ANNULEE';
      default: return 'BROUILLON';
    }
  }
}
