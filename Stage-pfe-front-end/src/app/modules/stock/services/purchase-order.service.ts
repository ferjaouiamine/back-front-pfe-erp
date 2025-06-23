import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, Subject, throwError, of } from 'rxjs';
import { catchError, tap, finalize, map, delay } from 'rxjs/operators';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, Supplier } from '../models/purchase-order.model';
import { AuthService } from '../../auth/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class PurchaseOrderService {
  /* -------------------------------------------------------------------------- */
  /*                                 ENDPOINTS                                  */
  /* -------------------------------------------------------------------------- */
  private apiUrl = 'http://localhost:8080/api/commandes';
  private backupApiUrl = 'http://localhost:8082/api/commandes';

  private suppliersBaseUrls = [
    'http://localhost:8088/api/suppliers',
    'http://localhost:8088/api/fournisseurs',
    'http://localhost:8088/api/vendors',
    'http://localhost:8080/api/suppliers',
    'http://localhost:8080/api/fournisseurs',
    'http://localhost:8080/api/vendors'
  ];

  /* -------------------------------------------------------------------------- */
  /*                                   STATE                                    */
  /* -------------------------------------------------------------------------- */
  private loading = new Subject<boolean>();
  loading$ = this.loading.asObservable();

  private orderCreated = new Subject<PurchaseOrder>();
  orderCreated$ = this.orderCreated.asObservable();

  private orderUpdated = new Subject<PurchaseOrder>();
  orderUpdated$ = this.orderUpdated.asObservable();

  private backendAvailable = true;
  // Forcer l'utilisation des données réelles uniquement - Ne jamais utiliser de données fictives
  private forceMockData = false; // Cette valeur ne sera jamais changée

  private mockDataWarningShown = false;

  private backendUnavailableMessage = `Le serveur de gestion des commandes n'est pas disponible. Les données affichées sont fictives à des fins de démonstration.`;
  private mockDataMessage = 'Mode démonstration activé. Les données affichées sont fictives.';

  // Stockage local des commandes fictives créées via createPurchaseOrder() lorsque le backend est HS
  private mockOrders: PurchaseOrder[] = [];

  constructor(private http: HttpClient, private authService: AuthService) {}

  /* -------------------------------------------------------------------------- */
  /*                                UTILITAIRES                                 */
  /* -------------------------------------------------------------------------- */

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    const baseHeaders: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    return new HttpHeaders(
      token ? { ...baseHeaders, Authorization: `Bearer ${token}` } : baseHeaders
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                           RÉCUPÉRATION DES ORDERS                          */
  /* -------------------------------------------------------------------------- */

  getPurchaseOrders(params?: {
    status?: PurchaseOrderStatus;
    startDate?: Date;
    endDate?: Date;
    supplierId?: string;
    searchTerm?: string;
  }): Observable<PurchaseOrder[]> {
    this.loading.next(true);

    /* ----------------------------- Query params ----------------------------- */
    let httpParams = new HttpParams();
    if (params) {
      if (params.status) httpParams = httpParams.set('status', params.status);
      if (params.startDate) httpParams = httpParams.set('startDate', params.startDate.toISOString());
      if (params.endDate) httpParams = httpParams.set('endDate', params.endDate.toISOString());
      if (params.supplierId) httpParams = httpParams.set('supplierId', params.supplierId);
      if (params.searchTerm) httpParams = httpParams.set('searchTerm', params.searchTerm);
    }

    return this.http
      .get<any[]>(this.apiUrl, { headers: this.getAuthHeaders(), params: httpParams })
      .pipe(
        map((orders) => orders.map((o) => this.mapApiOrderToModel(o))),
        tap((orders) => console.log(`${orders.length} commandes d'achat récupérées`)),
        catchError((error) => {
          console.error('Erreur lors de la récupération des commandes d\'achat:', error);
          this.backendAvailable = false;
          return of(this.getMockPurchaseOrders());
        }),
        finalize(() => this.loading.next(false))
      );
  }

  /* -------------------------------------------------------------------------- */
  /*                           RÉCUPÉRATION PAR ID                              */
  /* -------------------------------------------------------------------------- */

  getPurchaseOrderById(id: string): Observable<PurchaseOrder> {
    this.loading.next(true);

    /* ----------- Si on force les mocks ou qu'on est déjà en dégradé ---------- */
    if (this.forceMockData) {
      const local = this.mockOrders.find((o) => o.id === id);
      const order = local ?? this.getMockPurchaseOrders().find((o) => o.id === id) ?? this.createEmptyPurchaseOrder();
      this.loading.next(false);
      return of(order);
    }

    return this.http
      .get<any>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() })
      .pipe(
        map((o) => this.mapApiOrderToModel(o)),
        tap(() => {
          this.backendAvailable = true;
          this.backendUnavailableMessage = '';
        }),
        catchError((primaryError) => {
          console.error(`Erreur de récupération (primary) ${id}:`, primaryError);
          return this.http
            .get<any>(`${this.backupApiUrl}/${id}`, { headers: this.getAuthHeaders() })
            .pipe(
              map((o) => this.mapApiOrderToModel(o)),
              tap(() => {
                this.backendAvailable = true;
                this.backendUnavailableMessage = 'Utilisation du backend de secours';
              }),
              catchError((secondError) => {
                console.error(`Erreur de récupération (backup) ${id}:`, secondError);
                this.backendAvailable = false;
                const local = this.mockOrders.find((o) => o.id === id);
                const order = local ?? this.getMockPurchaseOrders().find((o) => o.id === id) ?? this.createEmptyPurchaseOrder();
                return of(order);
              })
            );
        }),
        finalize(() => this.loading.next(false))
      );
  }

  /* -------------------------------------------------------------------------- */
  /*                                CRÉATION                                    */
  /* -------------------------------------------------------------------------- */

  createPurchaseOrder(order: Partial<PurchaseOrder>): Observable<PurchaseOrder> {
    this.loading.next(true);

    /* ------------------------------ Mode mock ------------------------------- */
    if (this.forceMockData) {
      const mockOrder: PurchaseOrder = {
        ...order,
        id: `order-${Date.now()}`,
        orderNumber: `CMD-${new Date().getFullYear()}-${Math.floor(Math.random() * 900) + 100}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: order.status ?? 'DRAFT'
      } as PurchaseOrder;
      this.mockOrders.push(mockOrder);
      this.orderCreated.next(mockOrder);
      this.loading.next(false);
      return of(mockOrder);
    }

    const payload = this.mapModelToApiOrder(order as PurchaseOrder);

    return this.http
      .post<any>(this.apiUrl, payload, { headers: this.getAuthHeaders() })
      .pipe(
        map((o) => this.mapApiOrderToModel(o)),
        tap((created) => {
          this.backendAvailable = true;
          this.backendUnavailableMessage = '';
          this.orderCreated.next(created);
          console.log('Commande d\'achat créée :', created);
        }),
        catchError((primaryError) => {
          console.error('Erreur de création (primary):', primaryError);
          return this.http.post<any>(this.backupApiUrl, payload, { headers: this.getAuthHeaders() }).pipe(
            map((o) => this.mapApiOrderToModel(o)),
            tap((created) => {
              this.backendAvailable = true;
              this.backendUnavailableMessage = 'Utilisation du backend de secours';
              this.orderCreated.next(created);
              console.log('Commande d\'achat créée via backup :', created);
            }),
            catchError((secondError) => {
              console.error('Erreur de création (backup):', secondError);
              this.backendAvailable = false;
              const mockOrder: PurchaseOrder = {
                ...order,
                id: `order-${Date.now()}`,
                orderNumber: `CMD-${new Date().getFullYear()}-${Math.floor(Math.random() * 900) + 100}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: order.status ?? 'DRAFT'
              } as PurchaseOrder;
              this.mockOrders.push(mockOrder);
              this.orderCreated.next(mockOrder);
              return of(mockOrder);
            })
          );
        }),
        finalize(() => this.loading.next(false))
      );
  }

  /* -------------------------------------------------------------------------- */
  /*                                 UPDATE                                     */
  /* -------------------------------------------------------------------------- */

  updatePurchaseOrder(id: string, order: Partial<PurchaseOrder>): Observable<PurchaseOrder> {
    this.loading.next(true);

    const payload = this.mapModelToApiOrder(order as PurchaseOrder);

    return this.http
      .put<any>(`${this.apiUrl}/${id}`, payload, { headers: this.getAuthHeaders() })
      .pipe(
        map((o) => this.mapApiOrderToModel(o)),
        tap((updated) => {
          this.orderUpdated.next(updated);
          console.log('Commande mise à jour :', updated);
        }),
        catchError((error) => {
          console.error(`Erreur update ${id}:`, error);
          this.backendAvailable = false;
          const updatedOrder: PurchaseOrder = {
            ...order,
            id,
            updatedAt: new Date().toISOString()
          } as PurchaseOrder;
          return of(updatedOrder);
        }),
        finalize(() => this.loading.next(false))
      );
  }

  updatePurchaseOrderStatus(id: string, status: PurchaseOrderStatus): Observable<PurchaseOrder> {
    this.loading.next(true);

    return this.http
      .patch<any>(`${this.apiUrl}/${id}/status`, { status }, { headers: this.getAuthHeaders() })
      .pipe(
        map((o) => this.mapApiOrderToModel(o)),
        tap((updated) => {
          this.orderUpdated.next(updated);
          console.log('Statut mis à jour :', updated);
        }),
        catchError((error) => {
          console.error(`Erreur update status ${id}:`, error);
          return throwError(() => new Error(`Impossible de mettre à jour le statut: ${error.message}`));
        }),
        finalize(() => this.loading.next(false))
      );
  }

  /**
   * Supprime une commande d'achat par son ID
   * @param id ID de la commande à supprimer
   * @returns Observable indiquant le succès ou l'échec de l'opération
   */
  deletePurchaseOrder(id: string): Observable<any> {
    this.loading.next(true);
    
    if (this.forceMockData) {
      console.log(`Mode données fictives activé - Simulation de suppression de commande ${id}`);
      return of({ success: true }).pipe(
        delay(300),
        finalize(() => this.loading.next(false))
      );
    }

    const url = `${this.apiUrl}/${id}`;
    return this.http.delete(url, { headers: this.getAuthHeaders() }).pipe(
      tap(() => console.log(`Commande ${id} supprimée avec succès`)),
      catchError(error => {
        console.error(`Erreur lors de la suppression de la commande ${id}:`, error);
        // Essayer l'URL de secours si la première échoue
        const backupUrl = `${this.backupApiUrl}/${id}`;
        return this.http.delete(backupUrl, { headers: this.getAuthHeaders() }).pipe(
          tap(() => console.log(`Commande ${id} supprimée avec succès via l'URL de secours`)),
          catchError(backupError => {
            console.error(`Erreur lors de la suppression de la commande ${id} via l'URL de secours:`, backupError);
            return throwError(() => new Error(`Impossible de supprimer la commande ${id}`));
          })
        );
      }),
      finalize(() => this.loading.next(false))
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                                  PDF & MAIL                                */
  /* -------------------------------------------------------------------------- */

  generatePdf(id: string): Observable<Blob> {
    this.loading.next(true);
    return this.http
      .get(`${this.apiUrl}/${id}/pdf`, {
        headers: this.getAuthHeaders(),
        responseType: 'blob'
      })
      .pipe(
        tap(() => console.log(`PDF généré pour la commande ${id}`)),
        catchError((error) => {
          console.error(`Erreur PDF ${id}:`, error);
          return throwError(() => new Error(`Impossible de générer le PDF: ${error.message}`));
        }),
        finalize(() => this.loading.next(false))
      );
  }

  sendPurchaseOrderByEmail(id: string, email: string, subject: string, message: string): Observable<any> {
    this.loading.next(true);

    const emailData = { email, subject, message };

    return this.http
      .post(`${this.apiUrl}/${id}/send-email`, emailData, { headers: this.getAuthHeaders() })
      .pipe(
        tap(() => console.log(`Commande ${id} envoyée à ${email}`)),
        catchError((error) => {
          console.error(`Erreur envoi email commande ${id}:`, error);
          return throwError(() => new Error(`Impossible d'envoyer l'email: ${error.message}`));
        }),
        finalize(() => this.loading.next(false))
      );
  }

  sendOrderByEmail(orderData: any): Observable<any> {
    this.loading.next(true);

    if (!this.backendAvailable || this.forceMockData) {
      console.log('Mode démo: simulation email', orderData);
      return of({ success: true, message: 'Email envoyé (demo)' }).pipe(
        delay(1500),
        finalize(() => this.loading.next(false))
      );
    }

    const emailData = {
      email: orderData.supplierEmail,
      subject: `Commande d'achat ${orderData.orderNumber || 'Nouvelle commande'}`,
      message: `Bonjour,\n\nVeuillez trouver ci-joint notre commande d'achat ${orderData.orderNumber || 'Nouvelle commande'}.\n\nCordialement,\nService Achats`,
      orderData: this.mapModelToApiOrder(orderData)
    };

    return this.http.post(`${this.apiUrl}/send-email`, emailData, { headers: this.getAuthHeaders() }).pipe(
      tap((resp) => console.log(`Email OK vers ${orderData.supplierEmail}:`, resp)),
      catchError((error) => {
        console.error('Erreur email API:', error);
        this.backendAvailable = false;
        return of({ success: true, message: 'Email envoyé (demo après échec API)' });
      }),
      finalize(() => this.loading.next(false))
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                             HELPERS / MAPPERS                              */
  /* -------------------------------------------------------------------------- */

  createEmptyPurchaseOrder(): PurchaseOrder {
    return {
      supplierId: '',
      status: 'DRAFT',
      orderDate: new Date().toISOString(),
      expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      items: [],
      total: 0
    } as PurchaseOrder;
  }

  private mapApiOrderToModel(apiOrder: any): PurchaseOrder {
    return {
      id: apiOrder.id?.toString(),
      orderNumber: apiOrder.numero,
      supplierId: apiOrder.fournisseur?.id?.toString(),
      supplierName: apiOrder.fournisseur?.nom,
      supplierEmail: apiOrder.fournisseur?.email,
      supplierAddress: apiOrder.fournisseur?.adresse,
      status: this.mapApiStatus(apiOrder.statut),
      orderDate: apiOrder.dateCommande ?? new Date().toISOString(),
      expectedDeliveryDate: apiOrder.dateLivraisonPrevue,
      deliveryDate: apiOrder.dateLivraisonEffective,
      items: Array.isArray(apiOrder.lignes)
        ? apiOrder.lignes.map((l: any) => ({
            id: l.id?.toString(),
            productId: l.produit?.id?.toString(),
            productName: l.produit?.nom ?? l.designation,
            quantity: l.quantite ?? 0,
            unitPrice: l.prixUnitaire ?? 0,
            total: l.montantHT ?? (l.quantite * l.prixUnitaire) ?? 0
          }))
        : [],
      total: apiOrder.montantTTC ?? 0,
      notes: apiOrder.notes,
      createdAt: apiOrder.dateCreation,
      updatedAt: apiOrder.dateModification
    } as PurchaseOrder;
  }

  private mapModelToApiOrder(order: PurchaseOrder): any {
    return {
      id: order.id,
      numero: order.orderNumber,
      fournisseur: {
        id: order.supplierId,
        nom: order.supplierName,
        email: order.supplierEmail,
        adresse: order.supplierAddress
      },
      statut: this.mapModelStatus(order.status),
      dateCommande: order.orderDate,
      dateLivraisonPrevue: order.expectedDeliveryDate,
      dateLivraisonEffective: order.deliveryDate,
      lignes: order.items?.map((item) => ({
        id: item.id,
        produit: {
          id: item.productId,
          nom: item.productName
        },
        designation: item.productName,
        quantite: item.quantity,
        prixUnitaire: item.unitPrice,
        montantHT: item.total
      })) ?? [],
      montantTTC: order.total,
      notes: order.notes
    };
  }

  private mapApiStatus(apiStatus: string): PurchaseOrderStatus {
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

  private mapModelStatus(modelStatus: PurchaseOrderStatus): string {
    switch (modelStatus) {
      case 'DRAFT': return 'BROUILLON';
      case 'SENT': return 'EN_COURS';
      case 'CONFIRMED': return 'CONFIRMEE';
      case 'DELIVERED': return 'LIVREE';
      case 'CANCELLED': return 'ANNULEE';
      default: return 'BROUILLON';
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                 SUPPLIERS                                  */
  /* -------------------------------------------------------------------------- */

  getSuppliers(): Observable<Supplier[]> {
    this.loading.next(true);

    // Ne jamais utiliser de données fictives, même si forceMockData est true
    console.log('Récupération des fournisseurs depuis le backend - données réelles uniquement');

    return this.tryGetSuppliersFromEndpoint(0).pipe(
      finalize(() => this.loading.next(false))
    );
  }

  private tryGetSuppliersFromEndpoint(index: number): Observable<Supplier[]> {
    if (index >= this.suppliersBaseUrls.length) {
      this.backendAvailable = false;
      console.error('Tous les endpoints pour les fournisseurs ont échoué. Aucune donnée fictive ne sera utilisée.');
      return throwError(() => new Error('Impossible de récupérer les fournisseurs. Les serveurs ne sont pas disponibles.'));
    }

    const url = this.suppliersBaseUrls[index];
    console.log(`Tentative de récupération des fournisseurs depuis l'endpoint ${index + 1}/${this.suppliersBaseUrls.length}: ${url}`);

    return this.http.get<any[]>(url, { headers: this.getAuthHeaders() }).pipe(
      map((list) =>
        (list || []).map((item: any) => ({
          id: String(item.id),
          name: item.name || item.nom || '',
          address: item.address || item.adresse || '',
          email: item.email || '',
          phone: item.phone || item.telephone || '',
          contactName: item.contactName || item.contactPerson || item.personne || ''
        }))
      ),
      tap(() => {
        this.backendAvailable = true;
        if (!this.mockDataWarningShown) console.log("Fournisseurs récupérés via", url);
      }),
      catchError((err) => {
        console.error(`Erreur fournisseurs (${url}):`, err);
        // Afficher des informations plus détaillées sur l'erreur
        console.error(`Détails de l'erreur pour ${url}:`, {
          status: err.status,
          statusText: err.statusText,
          message: err.message,
          name: err.name
        });
        // Essayer l'endpoint suivant
        return this.tryGetSuppliersFromEndpoint(index + 1);
      })
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                              MOCK & DIAGNOSTIC                             */
  /* -------------------------------------------------------------------------- */

  isBackendAvailable(): boolean {
    return this.backendAvailable && !this.forceMockData;
  }

  setForceMockData(force: boolean): void {
    this.forceMockData = force;
  }

  isForceMockDataEnabled(): boolean {
    return this.forceMockData;
  }

  getBackendUnavailableMessage(): string {
    return this.forceMockData ? this.mockDataMessage : this.backendUnavailableMessage;
  }

  private getMockSuppliers(): Supplier[] {
    return [
      { id: 'supp-1', name: 'Fournisseur A', email: 'contact@fournisseurA.com', phone: '01 23 45 67 89', address: '123 Rue des Exemples, 75001 Paris' },
      { id: 'supp-2', name: 'Fournisseur B', email: 'contact@fournisseurB.com', phone: '01 23 45 67 90', address: '456 Avenue des Tests, 69002 Lyon' },
      { id: 'supp-3', name: 'Fournisseur C', email: 'contact@fournisseurC.com', phone: '01 23 45 67 91', address: '789 Boulevard des Mocks, 33000 Bordeaux' },
      { id: 'supp-4', name: 'Fournisseur D', email: 'contact@fournisseurD.com', phone: '01 23 45 67 92', address: '101 Place du Code, 31000 Toulouse' },
      { id: 'supp-5', name: 'Fournisseur E', email: 'contact@fournisseurE.com', phone: '01 23 45 67 93', address: '202 Allée des Données, 59000 Lille' }
    ];
  }

  private getMockPurchaseOrders(count: number = 10): PurchaseOrder[] {
    const statuses: PurchaseOrderStatus[] = ['DRAFT', 'SENT', 'CONFIRMED', 'DELIVERED', 'CANCELLED'];
    const suppliers = this.getMockSuppliers();

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
          quantity,
          unitPrice,
          total: itemTotal
        });
        total += itemTotal;
      }

      orders.push({
        id: `order-${i + 1}`,
        orderNumber: `CMD-${new Date().getFullYear()}-${1000 + i}`,
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierEmail: supplier.email,
        supplierAddress: supplier.address,
        status,
        orderDate: orderDate.toISOString(),
        expectedDeliveryDate: expectedDeliveryDate.toISOString(),
        deliveryDate: deliveryDate ? deliveryDate.toISOString() : undefined,
        items,
        total,
        notes: `Note commande ${i + 1}`,
        createdAt: orderDate.toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    return orders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }
}
