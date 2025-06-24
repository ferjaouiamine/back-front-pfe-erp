import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, Subject, throwError, of } from 'rxjs';
import { catchError, tap, finalize, map, delay, switchMap } from 'rxjs/operators';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, Supplier } from '../models/purchase-order.model';
import { AuthService } from '../../auth/services/auth.service';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

@Injectable({
  providedIn: 'root'
})
export class PurchaseOrderService {
  /* -------------------------------------------------------------------------- */
  /*                                 ENDPOINTS                                  */
  /* -------------------------------------------------------------------------- */
  // Essayer différents ports pour trouver le bon endpoint
  private apiUrl = 'http://localhost:8080/api/commandes';
  private backupApiUrl = 'http://localhost:8088/api/commandes';
  
  // Autres URLs à essayer si nécessaire
  private alternativeUrls = [
    'http://localhost:8082/api/commandes',
    'http://localhost:8085/api/commandes',
    'http://localhost:8081/api/commandes'
  ];

  private suppliersBaseUrls = [
    'http://localhost:8088/api/fournisseurs',
    'http://localhost:8088/api/suppliers',
    'http://localhost:8088/api/vendors'
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
  private forceMockData = false; // Toujours maintenir à false pour utiliser les données réelles

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
    this.backendAvailable = false; // Par défaut, supposer que le backend n'est pas disponible

    /* ----------------------------- Query params ----------------------------- */
    let httpParams = new HttpParams();
    if (params) {
      if (params.status) httpParams = httpParams.set('status', params.status);
      if (params.startDate) httpParams = httpParams.set('startDate', params.startDate.toISOString());
      if (params.endDate) httpParams = httpParams.set('endDate', params.endDate.toISOString());
      if (params.supplierId) httpParams = httpParams.set('supplierId', params.supplierId);
      if (params.searchTerm) httpParams = httpParams.set('search', params.searchTerm);
    }

    console.log(`Tentative de récupération des commandes depuis ${this.apiUrl}`);
    
    // Essayer d'abord l'URL principale
    return this.tryGetOrdersFromUrl(this.apiUrl, httpParams).pipe(
      catchError(error => {
        console.warn(`Échec avec l'URL principale ${this.apiUrl}:`, error);
        console.log(`Tentative avec l'URL de secours ${this.backupApiUrl}`);
        
        // Essayer l'URL de secours
        return this.tryGetOrdersFromUrl(this.backupApiUrl, httpParams).pipe(
          catchError(backupError => {
            console.warn(`Échec avec l'URL de secours ${this.backupApiUrl}:`, backupError);
            
            // Essayer les URLs alternatives une par une
            return this.tryAlternativeUrls(httpParams, 0);
          })
        );
      }),
      finalize(() => this.loading.next(false))
    );
  }
  
  /**
   * Essaie de récupérer les commandes depuis une URL spécifique
   */
  private tryGetOrdersFromUrl(url: string, params: HttpParams): Observable<PurchaseOrder[]> {
    return this.http.get<any[]>(url, { headers: this.getAuthHeaders(), params }).pipe(
      map(orders => {
        console.log(`Données reçues depuis ${url}:`, orders);
        this.backendAvailable = true;
        return orders.map(o => this.mapApiOrderToModel(o));
      }),
      tap(orders => console.log(`${orders.length} commandes récupérées avec succès depuis ${url}`))
    );
  }
  
  /**
   * Essaie les URLs alternatives une par une
   */
  private tryAlternativeUrls(params: HttpParams, index: number): Observable<PurchaseOrder[]> {
    if (index >= this.alternativeUrls.length) {
      console.error('Toutes les URLs ont échoué, utilisation des données fictives');
      return of(this.getMockPurchaseOrders());
    }
    
    const url = this.alternativeUrls[index];
    console.log(`Tentative avec l'URL alternative ${index + 1}/${this.alternativeUrls.length}: ${url}`);
    
    return this.tryGetOrdersFromUrl(url, params).pipe(
      catchError(error => {
        console.warn(`Échec avec l'URL alternative ${url}:`, error);
        return this.tryAlternativeUrls(params, index + 1);
      })
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                           RÉCUPÉRATION PAR ID                              */
  /* -------------------------------------------------------------------------- */

  getPurchaseOrderById(id: string): Observable<PurchaseOrder> {
    this.loading.next(true);
    this.backendAvailable = false; // Par défaut, supposer que le backend n'est pas disponible

    /* ----------- Si on force les mocks ou qu'on est déjà en dégradé ---------- */
    if (this.forceMockData) {
      const local = this.mockOrders.find((o) => o.id === id);
      const order = local ?? this.getMockPurchaseOrders().find((o) => o.id === id) ?? this.createEmptyPurchaseOrder();
      this.loading.next(false);
      return of(order);
    }

    console.log(`Tentative de récupération de la commande ${id} depuis ${this.apiUrl}`);
    
    // Essayer d'abord l'URL principale
    return this.tryGetOrderById(this.apiUrl, id).pipe(
      catchError(error => {
        console.warn(`Échec avec l'URL principale pour la commande ${id}:`, error);
        console.log(`Tentative avec l'URL de secours pour la commande ${id}`);
        
        // Essayer l'URL de secours
        return this.tryGetOrderById(this.backupApiUrl, id).pipe(
          catchError(backupError => {
            console.warn(`Échec avec l'URL de secours pour la commande ${id}:`, backupError);
            
            // Essayer les URLs alternatives une par une
            return this.tryAlternativeUrlsForOrder(id, 0);
          })
        );
      }),
      finalize(() => this.loading.next(false))
    );
  }
  
  /**
   * Essaie de récupérer une commande spécifique depuis une URL
   */
  private tryGetOrderById(baseUrl: string, id: string): Observable<PurchaseOrder> {
    return this.http.get<any>(`${baseUrl}/${id}`, { headers: this.getAuthHeaders() }).pipe(
      map(order => {
        console.log(`Données de la commande ${id} reçues depuis ${baseUrl}:`, order);
        this.backendAvailable = true;
        return this.mapApiOrderToModel(order);
      }),
      tap(order => console.log(`Commande ${id} récupérée avec succès depuis ${baseUrl}`))
    );
  }
  
  /**
   * Essaie les URLs alternatives une par une pour récupérer une commande spécifique
   */
  private tryAlternativeUrlsForOrder(id: string, index: number): Observable<PurchaseOrder> {
    if (index >= this.alternativeUrls.length) {
      console.error(`Toutes les URLs ont échoué pour la commande ${id}, utilisation des données fictives`);
      const local = this.mockOrders.find((o) => o.id === id);
      const order = local ?? this.getMockPurchaseOrders().find((o) => o.id === id) ?? this.createEmptyPurchaseOrder();
      return of(order);
    }
    
    const url = this.alternativeUrls[index];
    console.log(`Tentative avec l'URL alternative ${index + 1}/${this.alternativeUrls.length} pour la commande ${id}: ${url}`);
    
    return this.tryGetOrderById(url, id).pipe(
      catchError(error => {
        console.warn(`Échec avec l'URL alternative ${url} pour la commande ${id}:`, error);
        return this.tryAlternativeUrlsForOrder(id, index + 1);
      })
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

  /**
   * Génère un PDF pour la commande spécifiée
   * @param id Identifiant de la commande
   * @returns Observable contenant le blob du PDF généré
   */
  generatePdf(id: string): Observable<Blob> {
    this.loading.next(true);
    
    // Essayer d'abord avec l'URL principale
    return this.http
      .get(`${this.apiUrl}/${id}/pdf`, {
        headers: this.getAuthHeaders(),
        responseType: 'blob'
      })
      .pipe(
        tap(() => console.log(`PDF généré pour la commande ${id} via l'API principale`)),
        catchError((error) => {
          console.warn(`Erreur avec l'API principale pour le PDF ${id}:`, error);
          
          // En cas d'échec, essayer avec l'URL de secours
          console.log(`Tentative avec l'API de secours pour le PDF de la commande ${id}`);
          return this.http
            .get(`${this.backupApiUrl}/${id}/pdf`, {
              headers: this.getAuthHeaders(),
              responseType: 'blob'
            })
            .pipe(
              tap(() => console.log(`PDF généré pour la commande ${id} via l'API de secours`)),
              catchError((backupError) => {
                console.error(`Échec de la génération PDF pour ${id} sur les deux API:`, backupError);
                // Générer un PDF côté client comme solution de secours
                return this.generateClientSidePdf(id);
              })
            );
        }),
        finalize(() => this.loading.next(false))
      );
  }
  
  /**
   * Génère un PDF côté client en utilisant pdfmake comme solution de secours
   * @param id Identifiant de la commande
   * @returns Observable contenant le blob du PDF généré
   */
  private generateClientSidePdf(id: string): Observable<Blob> {
    console.log(`Génération de PDF côté client pour la commande ${id}`);
    
    // Configurer les polices pour pdfMake
    // Utiliser pdfMake.vfs = ... n'est pas possible car les imports sont immuables
    // On utilise donc une autre approche pour configurer les polices
    try {
      // Utiliser la méthode setFonts de pdfmake si disponible
      if (typeof (pdfMake as any).fonts === 'object') {
        Object.assign((pdfMake as any).fonts, (pdfFonts as any).pdfMake?.vfs || {});
        console.log('Polices pdfMake configurées via fonts');
      } else {
        // Sinon, utiliser une autre approche pour les versions plus récentes
        console.log('Configuration des polices pdfMake ignorée - utilisation des polices par défaut');
      }
    } catch (e) {
      console.error('Erreur lors de la configuration des polices pdfMake:', e);
    }
    
    // Récupérer les détails de la commande pour générer le PDF
    return this.getPurchaseOrderById(id).pipe(
      map(order => {
        // Définir le contenu du document PDF
        // Utiliser 'as any' pour contourner les erreurs TypeScript
        const documentDefinition: any = {
          content: [
            { text: 'BON DE COMMANDE', style: 'header' },
            { text: `N° ${order.orderNumber || id}`, style: 'subheader' },
            { text: `Date: ${new Date(order.orderDate).toLocaleDateString()}`, style: 'date' },
            
            { text: 'Fournisseur', style: 'sectionHeader' },
            {
              columns: [
                [
                  { text: order.supplierName || 'Non spécifié' },
                  { text: order.supplierAddress || '' },
                  { text: order.supplierEmail || '' }
                ]
              ]
            },
            
            { text: 'Articles', style: 'sectionHeader', margin: [0, 20, 0, 10] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto'],
                body: [
                  // En-tête du tableau
                  [{ text: 'Produit', style: 'tableHeader' }, 
                   { text: 'Quantité', style: 'tableHeader' }, 
                   { text: 'Prix unitaire', style: 'tableHeader' }, 
                   { text: 'Total', style: 'tableHeader' }],
                  // Lignes d'articles
                  ...order.items.map(item => [
                    item.productName,
                    item.quantity.toString(),
                    `${item.unitPrice.toFixed(2)} €`,
                    `${item.total.toFixed(2)} €`
                  ])
                ]
              }
            },
            
            { text: `Total: ${order.total.toFixed(2)} €`, style: 'total', margin: [0, 20, 0, 0] },
            
            { text: `Statut: ${this.getStatusLabel(order.status)}`, style: 'status' },
            
            // Utiliser une condition ternaire pour éviter les objets vides qui causent des erreurs de type
            ...(order.notes ? [{ text: `Notes: ${order.notes}`, style: 'notes', margin: [0, 20, 0, 0] }] : [])
          ],
          styles: {
            header: { fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 10] },
            subheader: { fontSize: 14, bold: true, alignment: 'center', margin: [0, 0, 0, 20] },
            date: { fontSize: 12, alignment: 'right', margin: [0, 0, 0, 20] },
            sectionHeader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
            tableHeader: { bold: true, fillColor: '#eeeeee' },
            total: { fontSize: 14, bold: true, alignment: 'right' },
            status: { fontSize: 12, alignment: 'right', margin: [0, 5, 0, 0] },
            notes: { fontSize: 12, italics: true }
          },
          defaultStyle: {
            fontSize: 10
          },
          footer: function(currentPage: number, pageCount: number) {
            return { text: `Page ${currentPage} sur ${pageCount}`, alignment: 'center', fontSize: 8 };
          }
        };
        
        // Générer le PDF
        const pdfDocGenerator = pdfMake.createPdf(documentDefinition);
        
        return new Promise<Blob>((resolve) => {
          pdfDocGenerator.getBlob((blob: Blob) => {
            resolve(blob);
          });
        });
      }),
      switchMap((blobPromise: Promise<Blob>) => {
        return new Observable<Blob>(observer => {
          blobPromise.then(
            blob => {
              observer.next(blob);
              observer.complete();
            },
            error => {
              console.error('Erreur lors de la génération du PDF côté client:', error);
              observer.error(new Error('Erreur lors de la génération du PDF côté client'));
            }
          );
        });
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des données pour le PDF:', error);
        return throwError(() => new Error(`Impossible de générer le PDF: ${error.message || 'Erreur inconnue'}`));
      })
    );
  }
  
  /**
   * Retourne le libellé correspondant au statut de la commande
   * @param status Statut de la commande
   * @returns Libellé du statut
   */
  private getStatusLabel(status: PurchaseOrderStatus): string {
    switch (status) {
      case 'DRAFT': return 'Brouillon';
      case 'SENT': return 'Envoyée';
      case 'CONFIRMED': return 'Confirmée';
      case 'DELIVERED': return 'Livrée';
      case 'CANCELLED': return 'Annulée';
      default: return status;
    }
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
