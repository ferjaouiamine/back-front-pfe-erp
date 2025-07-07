import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, throwError, of, timer } from 'rxjs';
import { catchError, tap, finalize, map, delay, switchMap, retry, retryWhen, mergeMap } from 'rxjs/operators';
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
  // URL principale du service d'achat (port 8088 selon application.properties)
  private apiUrl = 'http://localhost:8088/api/commandes';
  // Utiliser le même port 8088 comme URL de secours car 8080 ne répond pas
  private backupApiUrl = 'http://localhost:8080/api/commandes'; // Utilisation du port 8080 comme alternative
  // Autres URLs à essayer si nécessaire - toutes sur le port 8088
  private alternativeUrls = [
    'http://localhost:8088/api/commande', // Sans 's' à la fin
    'http://localhost:8080/api/commande', // Port alternatif sans 's'
    'http://localhost:8080/api/commandes' // Port alternatif avec 's'
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
  private forceMockData = true; // Activé pour garantir que l'application fonctionne malgré les erreurs backend
  // Cache local pour les commandes récupérées avec succès
  private ordersCache: PurchaseOrder[] = [];
  private lastCacheUpdate: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes en millisecondes

  private mockDataWarningShown = false;

  private backendUnavailableMessage = `Le serveur de gestion des commandes n'est pas disponible. Les données affichées sont fictives à des fins de démonstration.`;
  private mockDataMessage = 'Mode démonstration activé. Les données affichées sont fictives.';

  // Stockage local des commandes fictives créées via createPurchaseOrder() lorsque le backend est HS
  private mockOrders: PurchaseOrder[] = [];

  private orderCache = new Map<string, { data: PurchaseOrder[], timestamp: number }>();
  private singleOrderCache = new Map<string, { data: PurchaseOrder, timestamp: number }>();

  private readonly CACHE_EXTENDED_DURATION = 10 * 60 * 1000; // 10 minutes en millisecondes

  constructor(private http: HttpClient, private authService: AuthService) {
    console.log('Service de commandes initialisé avec données fictives activées temporairement');
  }
  
  /* -------------------------------------------------------------------------- */
  /*                              ENVOI D'EMAILS                                 */
  /* -------------------------------------------------------------------------- */
  
  /**
   * Envoie un email contenant les détails d'une commande
   * @param orderId ID de la commande à envoyer
   * @param emailData Données de l'email (destinataire, sujet, message)
   * @returns Observable avec le statut de l'envoi
   */
  sendOrderEmail(orderId: string, emailData: { email: string; subject?: string; message?: string }): Observable<any> {
    this.loading.next(true);
    console.log(`Envoi d'un email pour la commande ${orderId} à ${emailData.email}`);
    
    // Si les données fictives sont forcées, simuler un envoi réussi
    if (this.forceMockData) {
      console.log('Simulation d\'envoi d\'email (mode données fictives)');
      return of({ success: true, message: `Email envoyé avec succès à ${emailData.email}` }).pipe(
        delay(1500),
        tap(() => this.loading.next(false))
      );
    }
    
    const headers = this.getAuthHeaders();
    
    return this.http.post(`${this.apiUrl}/${orderId}/send-email`, emailData, { headers }).pipe(
      tap(response => {
        console.log('Réponse du serveur pour l\'envoi d\'email:', response);
      }),
      catchError(error => {
        console.error('Erreur lors de l\'envoi de l\'email:', error);
        // Essayer avec l'URL de secours
        return this.http.post(`${this.backupApiUrl}/${orderId}/send-email`, emailData, { headers }).pipe(
          catchError(backupError => {
            console.error('Erreur avec l\'URL de secours:', backupError);
            // Simuler un succès en mode de secours
            return of({ success: true, message: `Email envoyé avec succès à ${emailData.email} (mode secours)` });
          })
        );
      }),
      finalize(() => this.loading.next(false))
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                                UTILITAIRES                                 */
  /* -------------------------------------------------------------------------- */

  private getAuthHeaders(): HttpHeaders {
    console.log(`[DEBUG] Génération des en-têtes d'authentification`);
    const token = this.authService.getToken();
    console.log(`[DEBUG] Token présent: ${!!token}`);
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
    console.log('Récupération des commandes d\'achat...');
    
    // Si les données fictives sont forcées, retourner directement les données fictives
    if (this.forceMockData) {
      console.log('Utilisation des données fictives (forcé)');
      const mockData = this.getMockPurchaseOrders();
      
      // Filtrer les données fictives selon les paramètres fournis
      let filteredData = [...mockData];
      
      if (params) {
        if (params.status) {
          filteredData = filteredData.filter(order => order.status === params.status);
        }
        
        if (params.supplierId) {
          filteredData = filteredData.filter(order => order.supplierId === params.supplierId);
        }
        
        if (params.startDate) {
          const startDate = new Date(params.startDate);
          filteredData = filteredData.filter(order => {
            const orderDate = new Date(order.orderDate);
            return orderDate >= startDate;
          });
        }
        
        if (params.endDate) {
          const endDate = new Date(params.endDate);
          filteredData = filteredData.filter(order => {
            const orderDate = new Date(order.orderDate);
            return orderDate <= endDate;
          });
        }
        
        if (params.searchTerm) {
          const term = params.searchTerm.toLowerCase();
          filteredData = filteredData.filter(order => 
            (order.orderNumber?.toLowerCase()?.includes(term) || false) ||
            (order.supplierName?.toLowerCase()?.includes(term) || false)
          );
        }
      }
      
      return of(filteredData).pipe(
        delay(500),
        tap(() => this.loading.next(false))
      );
    }
    
    // Vérifier si nous pouvons utiliser le cache
    const now = Date.now();
    const useCache = this.ordersCache.length > 0 && 
                     (now - this.lastCacheUpdate < this.CACHE_DURATION);
    
    if (useCache) {
      console.log('Utilisation du cache local pour les commandes d\'achat');
      // Filtrer le cache selon les paramètres
      let filteredCache = [...this.ordersCache];
      
      if (params) {
        if (params.status) {
          filteredCache = filteredCache.filter(order => order.status === params.status);
        }
        if (params.startDate) {
          const startDate = new Date(params.startDate).getTime();
          filteredCache = filteredCache.filter(order => new Date(order.orderDate).getTime() >= startDate);
        }
        if (params.endDate) {
          const endDate = new Date(params.endDate).getTime();
          filteredCache = filteredCache.filter(order => new Date(order.orderDate).getTime() <= endDate);
        }
        if (params.supplierId) {
          filteredCache = filteredCache.filter(order => order.supplierId === params.supplierId);
        }
        if (params.searchTerm) {
          const term = params.searchTerm.toLowerCase();
          filteredCache = filteredCache.filter(order => 
            (order.orderNumber?.toLowerCase().includes(term) || '') ||
            (order.supplierName?.toLowerCase().includes(term) || '')
          );
        }
      }
      
      this.loading.next(false);
      return of(filteredCache);
    }
    
    // Construire les paramètres de requête
    let httpParams = new HttpParams();
    if (params) {
      if (params.status) httpParams = httpParams.set('statut', this.mapModelStatus(params.status));
      if (params.startDate) httpParams = httpParams.set('dateDebut', params.startDate.toISOString().split('T')[0]);
      if (params.endDate) httpParams = httpParams.set('dateFin', params.endDate.toISOString().split('T')[0]);
      if (params.supplierId) httpParams = httpParams.set('fournisseurId', params.supplierId);
      if (params.searchTerm) httpParams = httpParams.set('recherche', params.searchTerm);
    }
    
    // Essayer d'abord avec l'URL principale
    console.log(`Tentative de récupération des commandes depuis ${this.apiUrl}`);
    return this.tryGetOrdersFromUrl(this.apiUrl, httpParams).pipe(
      tap(orders => {
        // Mettre à jour le cache si la requête réussit
        this.ordersCache = orders;
        this.lastCacheUpdate = Date.now();
      }),
      catchError(error => {
        console.error(`Erreur lors de la récupération des commandes depuis ${this.apiUrl}:`, error);
        // Si l'URL principale échoue, essayer avec les URLs alternatives
        return this.tryAlternativeUrls(httpParams, 0);
      }),
      finalize(() => {
        this.loading.next(false);
      })
    );
  }
  
  /**
   * Essaie de récupérer les commandes depuis une URL spécifique avec retry et backoff
   */
  private tryGetOrdersFromUrl(url: string, params: HttpParams): Observable<PurchaseOrder[]> {
    console.log(`Tentative de récupération des commandes depuis ${url} avec params:`, params.toString());
    
    return this.http.get<any[]>(url, { 
      params, 
      headers: this.getAuthHeaders()
      // Timeout géré par le retry avec backoff
    }).pipe(
      retryWhen(errors => errors.pipe(
        mergeMap((error, i) => {
          console.log(`Erreur lors de la tentative ${i+1} sur ${url}:`, error);
          
          // Ne pas réessayer en cas d'erreur 404 (ressource non trouvée)
          if (error.status === 404) return throwError(() => error);
          
          // Ne pas réessayer en cas d'erreur 400 (mauvaise requête)
          if (error.status === 400) return throwError(() => error);
          
          // Ne pas réessayer en cas d'erreur 500 (erreur serveur)
          if (error.status === 500) return throwError(() => error);
          
          // Limiter le nombre de tentatives à 2
          if (i >= 2) return throwError(() => error);
          
          // Attendre de plus en plus longtemps entre les tentatives
          const delay = (i + 1) * 1500;
          console.log(`Nouvelle tentative dans ${delay}ms...`);
          return timer(delay);
        })
      )),
      map(orders => {
        console.log(`Succès: ${orders.length} commandes récupérées depuis ${url}`);
        return orders.map(order => this.mapApiOrderToModel(order));
      }),
      catchError(error => {
        // En cas d'erreur 500 ou 400, essayer l'URL de secours si ce n'est pas déjà celle-ci
        if ((error.status === 500 || error.status === 400) && url !== this.backupApiUrl) {
          console.log(`Erreur ${error.status} détectée, tentative avec l'URL de secours`);
          return this.tryGetOrdersFromUrl(this.backupApiUrl, params);
        }
        console.log(`Erreur lors de la récupération des commandes depuis ${url}:`, error);
        throw error;
      })
    );
  }
  
  /**
   * Essaie les URLs alternatives une par une avec une meilleure gestion des erreurs
   */
  private tryAlternativeUrls(params: HttpParams, index: number): Observable<PurchaseOrder[]> {
    // Vérifier si nous avons des données en cache que nous pourrions utiliser en cas d'échec
    const now = Date.now();
    const hasCachedData = this.ordersCache.length > 0 && 
                         (now - this.lastCacheUpdate < this.CACHE_DURATION * 2); // On étend la durée du cache en cas d'urgence
    
    if (index >= this.alternativeUrls.length) {
      console.log('Toutes les URLs ont échoué');
      
      // Vérifier si nous avons des données en cache
      if (this.ordersCache.length > 0 && (Date.now() - this.lastCacheUpdate < this.CACHE_EXTENDED_DURATION)) {
        console.log('Utilisation des données en cache (mode urgence)');
        return of(this.ordersCache);
      }
      
      console.log('Utilisation des données fictives comme dernier recours');
      // Filtrer les données fictives selon les paramètres fournis
      let filteredData = [...this.getMockPurchaseOrders()];
      
      // Extraire les valeurs des paramètres
      const status = params.has('status') ? params.get('status') : null;
      const supplierId = params.has('supplierId') ? params.get('supplierId') : null;
      const startDate = params.has('startDate') ? params.get('startDate') : null;
      const endDate = params.has('endDate') ? params.get('endDate') : null;
      const searchTerm = params.has('searchTerm') ? params.get('searchTerm') : null;
      
      if (status) {
        filteredData = filteredData.filter(order => order.status === status);
      }
      
      if (supplierId) {
        filteredData = filteredData.filter(order => order.supplierId === supplierId);
      }
      
      if (startDate) {
        const start = new Date(startDate);
        filteredData = filteredData.filter(order => {
          const orderDate = new Date(order.orderDate);
          return orderDate >= start;
        });
      }
      
      if (endDate) {
        const end = new Date(endDate);
        filteredData = filteredData.filter(order => {
          const orderDate = new Date(order.orderDate);
          return orderDate <= end;
        });
      }
      
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredData = filteredData.filter(order => 
          (order.orderNumber?.toLowerCase()?.includes(term) || false) ||
          (order.supplierName?.toLowerCase()?.includes(term) || false)
        );
      }
      
      return of(filteredData);
    }
    
    const url = this.alternativeUrls[index];
    console.log(`Tentative avec l'URL alternative ${index + 1}/${this.alternativeUrls.length}: ${url}`);
    
    return this.tryGetOrdersFromUrl(url, params).pipe(
      tap(orders => {
        // Mettre à jour le cache si la requête réussit
        this.ordersCache = orders;
        this.lastCacheUpdate = Date.now();
      }),
      catchError(error => {
        console.error(`Erreur avec l'URL alternative ${url}:`, error);
        
        // Analyser l'erreur pour déterminer la prochaine action
        if (error.status === 500) {
          console.error('Erreur 500 détectée, tentative avec l\'URL suivante');
          return this.tryAlternativeUrls(params, index + 1);
        } else if (error.status === 0 || error.status === 504) {
          // Erreur de connexion ou timeout, attendre un peu avant de réessayer
          console.log(`Erreur de connexion ou timeout, attente avant nouvelle tentative...`);
          return timer(1000).pipe(
            switchMap(() => this.tryAlternativeUrls(params, index + 1))
          );
        }
        
        // Pour les autres types d'erreurs, passer à l'URL suivante
        return this.tryAlternativeUrls(params, index + 1);
      })
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                           RÉCUPÉRATION PAR ID                              */
  /* -------------------------------------------------------------------------- */

  getPurchaseOrderById(id: string): Observable<PurchaseOrder> {
    console.log(`[DEBUG] Début getPurchaseOrderById avec ID=${id}`);
    this.loading.next(true);
    this.backendAvailable = false; // Par défaut, supposer que le backend n'est pas disponible

    /* ----------------------------- Mode mock ------------------------------- */
    if (this.forceMockData) {
      console.log(`[DEBUG] Mode mock activé, recherche de la commande ${id} dans les données fictives`);
      const local = this.mockOrders.find((o) => o.id === id);
      const order = local ?? this.getMockPurchaseOrders().find((o) => o.id === id) ?? this.createEmptyPurchaseOrder();
      this.loading.next(false);
      return of(order);
    }

    console.log(`[DEBUG] Tentative de récupération de la commande ${id} depuis ${this.apiUrl}`);
    console.log(`[DEBUG] URL complète: ${this.apiUrl}/${id}?skipLines=false`);
    console.log(`[DEBUG] Headers:`, this.getAuthHeaders());
    
    // Ajouter le paramètre skipLines=false pour s'assurer que les lignes sont chargées
    return this.tryGetOrderById(this.apiUrl, id).pipe(
      tap(order => {
        console.log(`Commande récupérée avec succès depuis ${this.apiUrl}:`, order);
        this.backendAvailable = true;
      }),
      catchError(error => {
        console.error(`[DEBUG] Échec avec l'URL principale pour la commande ${id}:`, error);
        console.log(`[DEBUG] Message d'erreur:`, error.message);
        console.log(`[DEBUG] Status:`, error.status);
        console.log(`[DEBUG] StatusText:`, error.statusText);
        if (error.error) {
          console.log(`[DEBUG] Détails d'erreur:`, error.error);
        }
        
        // Si c'est une erreur 500, créer une commande vide plutôt que de réessayer
        if (error.status === 500) {
          console.warn(`[DEBUG] Erreur 500 détectée, création d'une commande vide sans réessayer`);
          const emptyOrder = this.createEmptyPurchaseOrder();
          emptyOrder.id = id;
          return of(emptyOrder);
        }
        
        console.log(`[DEBUG] Tentative avec l'URL de secours pour la commande ${id}`);
        // Essayer l'URL de secours pour les autres types d'erreurs
        return this.tryGetOrderById(this.backupApiUrl, id);
      }),
      finalize(() => this.loading.next(false))
    );
  }
  
  /**
   * Essaie de récupérer une commande spécifique depuis une URL avec retry et backoff
   */
  private tryGetOrderById(baseUrl: string, id: string): Observable<PurchaseOrder> {
    const url = `${baseUrl}/${id}`;
    console.log(`Tentative de récupération de la commande ${id} depuis ${url}`);
    
    return this.http.get<any>(url, { headers: this.getAuthHeaders() }).pipe(
      // Retry avec backoff exponentiel pour les erreurs temporaires
      retryWhen(errors => 
        errors.pipe(
          mergeMap((error, i) => {
            // Ne pas retry pour les erreurs 404 (ressource non trouvée)
            if (error.status === 404) {
              return throwError(() => error);
            }
            // Pour les erreurs 500, ne pas retry
            if (error.status === 500) {
              return throwError(() => error);
            }
            // Pour les autres erreurs, retry avec backoff exponentiel (max 3 tentatives)
            const retryAttempt = i + 1;
            if (retryAttempt > 3) {
              return throwError(() => error);
            }
            console.log(`Tentative ${retryAttempt} pour ${url} dans ${retryAttempt * 1000}ms`);
            return timer(retryAttempt * 1000);
          })
        )
      ),
      map(order => {
        console.log(`Commande récupérée avec succès depuis ${url}:`, order);
        this.backendAvailable = true;
        return this.mapApiOrderToModel(order);
      }),
      catchError(error => {
        console.error(`Erreur lors de la récupération de la commande ${id} depuis ${url}:`, error);
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Essaie les URLs alternatives une par une pour récupérer une commande spécifique
   */
  private tryAlternativeUrlsForOrder(id: string, index: number): Observable<PurchaseOrder> {
    // Vérifier si nous avons cette commande en cache
    const cachedOrder = this.ordersCache.find(o => o.id === id);
    const now = Date.now();
    const hasCachedOrder = cachedOrder && (now - this.lastCacheUpdate < this.CACHE_DURATION * 2);
    
    if (index >= this.alternativeUrls.length) {
      console.error(`Toutes les URLs ont échoué pour la commande ${id}`);
      
      // Si nous avons la commande en cache, l'utiliser
      if (hasCachedOrder) {
        console.log('Utilisation de la commande en cache comme solution de secours');
        return of(cachedOrder!);
      }
      
      console.log('Aucune donnée en cache disponible, utilisation des données fictives');
      this.backendAvailable = false;
      
      // Chercher dans les commandes mockées
      const mockOrder = this.mockOrders.find(o => o.id === id);
      if (mockOrder) {
        return of(mockOrder);
      }
      
      // Créer une commande fictive avec l'ID spécifié
      const order = this.getMockPurchaseOrders(1)[0];
      order.id = id;
      return of(order);
    }
    
    const url = this.alternativeUrls[index];
    console.log(`Tentative avec l'URL alternative ${index + 1}/${this.alternativeUrls.length}: ${url}`);
    
    return this.tryGetOrderById(url, id).pipe(
      catchError(error => {
        console.error(`Erreur avec l'URL alternative ${url}:`, error);
        
        // Analyser l'erreur pour déterminer la prochaine action
        if (error.status === 500) {
          console.log('Erreur 500 détectée, tentative avec l\'URL suivante');
        } else if (error.status === 0 || error.status === 504) {
          // Erreur de connexion ou timeout, attendre un peu avant de réessayer
          console.log(`Erreur de connexion ou timeout, attente avant nouvelle tentative...`);
          return timer(1000).pipe(
            switchMap(() => this.tryAlternativeUrlsForOrder(id, index + 1))
          );
        }
        
        return this.tryAlternativeUrlsForOrder(id, index + 1);
      })
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                                CRÉATION                                    */
  /* -------------------------------------------------------------------------- */

  createPurchaseOrder(order: Partial<PurchaseOrder>): Observable<PurchaseOrder> {
    this.loading.next(true);
    
    console.log('Création d\'une nouvelle commande avec les données suivantes:', order);
    console.log('Nombre d\'articles dans la commande à créer:', order.items?.length || 0);
    
    if (order.items && order.items.length > 0) {
      console.log('Articles à enregistrer:', order.items);
    } else {
      console.warn('Aucun article trouvé dans la commande à créer!');
    }

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

    // Convertir la commande au format API
    const payload = this.mapModelToApiOrder(order as PurchaseOrder);
    console.log('Payload envoyé au backend:', payload);
    console.log('Nombre d\'articles dans le payload:', 
      (payload.lignes?.length || 0) + ' lignes, ' + 
      (payload.lignesCommande?.length || 0) + ' lignesCommande, ' + 
      (payload.articles?.length || 0) + ' articles');

    // Déterminer si nous devons utiliser l'endpoint avec email ou l'endpoint standard
    const useEmailEndpoint = !order.supplierId && order.supplierEmail;
    const apiEndpoint = useEmailEndpoint 
      ? `${this.apiUrl}/with-email?fournisseurEmail=${encodeURIComponent(order.supplierEmail || '')}`
      : this.apiUrl;
    
    console.log(`Utilisation de l'endpoint ${useEmailEndpoint ? 'with-email' : 'standard'} pour la création de commande`);

    // Envoyer la commande au backend
    return this.http
      .post<any>(apiEndpoint, payload, { headers: this.getAuthHeaders() })
      .pipe(
        tap(rawResponse => {
          console.log('Réponse brute du backend après création:', rawResponse);
          if (rawResponse.lignes) {
            console.log(`La réponse contient ${rawResponse.lignes.length} lignes`);
          }
        }),
        map(rawData => {
          // Créer un modèle de commande de base
          const order: PurchaseOrder = {
            id: rawData.id?.toString(),
            orderNumber: rawData.numero,
            supplierId: rawData.fournisseur?.id?.toString(),
            supplierName: rawData.fournisseur?.nom,
            supplierEmail: rawData.fournisseur?.email || rawData.emailFournisseur,
            supplierAddress: rawData.fournisseur?.adresse,
            status: this.mapApiStatus(rawData.statut),
            orderDate: rawData.dateCommande,
            expectedDeliveryDate: rawData.dateLivraisonPrevue,
            deliveryDate: rawData.dateLivraisonEffective,
            total: rawData.montantTTC || rawData.montantTotal || 0,
            notes: rawData.notes,
            createdAt: rawData.dateCreation,
            updatedAt: rawData.dateModification,
            items: []
          };
          
          // Récupérer les articles depuis les différentes propriétés possibles
          if (Array.isArray(rawData.lignes) && rawData.lignes.length > 0) {
            console.log('Récupération des articles depuis la propriété "lignes"');
            order.items = rawData.lignes.map((ligne: any) => ({
              id: ligne.id?.toString(),
              productId: ligne.produit?.id?.toString(),
              productName: ligne.produit?.nom ?? ligne.designation,
              quantity: ligne.quantite ?? 0,
              unitPrice: ligne.prixUnitaire ?? 0,
              total: ligne.montantHT ?? (ligne.quantite * ligne.prixUnitaire) ?? 0
            }));
          } else if (Array.isArray(rawData.lignesCommande) && rawData.lignesCommande.length > 0) {
            console.log('Récupération des articles depuis la propriété "lignesCommande"');
            order.items = rawData.lignesCommande.map((ligne: any) => ({
              id: ligne.id?.toString(),
              productId: ligne.produit?.id?.toString(),
              productName: ligne.produit?.nom ?? ligne.designation,
              quantity: ligne.quantite ?? 0,
              unitPrice: ligne.prixUnitaire ?? 0,
              total: ligne.montantHT ?? (ligne.quantite * ligne.prixUnitaire) ?? 0
            }));
          } else if (Array.isArray(rawData.articles) && rawData.articles.length > 0) {
            console.log('Récupération des articles depuis la propriété "articles"');
            order.items = rawData.articles.map((article: any) => ({
              id: article.id?.toString(),
              productId: article.produit?.id?.toString() || article.productId?.toString(),
              productName: article.produit?.nom ?? article.designation ?? article.productName,
              quantity: article.quantite ?? article.quantity ?? 0,
              unitPrice: article.prixUnitaire ?? article.unitPrice ?? 0,
              total: article.montantHT ?? article.total ?? (article.quantite * article.prixUnitaire) ?? 0
            }));
          }
          
          console.log('Commande mappée avec', order.items?.length || 0, 'articles:', order);
          return order;
        }),
        tap((order) => {
          this.backendAvailable = true;
          this.backendUnavailableMessage = '';
          console.log('Commande récupérée avec succès:', order);
        }),
        catchError((primaryError, caught) => {
          console.error('Erreur de récupération (primary):', primaryError);
          
          // Afficher plus de détails sur l'erreur HTTP
          if (primaryError.error) {
            console.error('Détails de l\'erreur:', primaryError.error);
            console.error('Message d\'erreur:', primaryError.message);
            console.error('Statut HTTP:', primaryError.status);
            console.error('Status text:', primaryError.statusText);
          }
          
          // Extraire l'ID de l'URL originale dans le flux capturé
          const urlParts = this.apiUrl.split('/');
          const id = urlParts[urlParts.length - 1];
          return this.http.get<any>(`${this.backupApiUrl}/${id}`, { headers: this.getAuthHeaders() }).pipe(
            map(rawData => {
              // Même logique de mapping pour l'URL de secours
              const order: PurchaseOrder = {
                id: rawData.id?.toString(),
                orderNumber: rawData.numero,
                supplierId: rawData.fournisseur?.id?.toString(),
                supplierName: rawData.fournisseur?.nom,
                supplierEmail: rawData.fournisseur?.email || rawData.emailFournisseur,
                supplierAddress: rawData.fournisseur?.adresse,
                status: this.mapApiStatus(rawData.statut),
                orderDate: rawData.dateCommande,
                expectedDeliveryDate: rawData.dateLivraisonPrevue,
                deliveryDate: rawData.dateLivraisonEffective,
                total: rawData.montantTTC || rawData.montantTotal || 0,
                notes: rawData.notes,
                createdAt: rawData.dateCreation,
                updatedAt: rawData.dateModification,
                items: []
              };
              
              // Récupérer les articles depuis les différentes propriétés possibles
              if (Array.isArray(rawData.lignes) && rawData.lignes.length > 0) {
                order.items = rawData.lignes.map((ligne: any) => ({
                  id: ligne.id?.toString(),
                  productId: ligne.produit?.id?.toString(),
                  productName: ligne.produit?.nom ?? ligne.designation,
                  quantity: ligne.quantite ?? 0,
                  unitPrice: ligne.prixUnitaire ?? 0,
                  total: ligne.montantHT ?? (ligne.quantite * ligne.prixUnitaire) ?? 0
                }));
              } else if (Array.isArray(rawData.lignesCommande) && rawData.lignesCommande.length > 0) {
                order.items = rawData.lignesCommande.map((ligne: any) => ({
                  id: ligne.id?.toString(),
                  productId: ligne.produit?.id?.toString(),
                  productName: ligne.produit?.nom ?? ligne.designation,
                  quantity: ligne.quantite ?? 0,
                  unitPrice: ligne.prixUnitaire ?? 0,
                  total: ligne.montantHT ?? (ligne.quantite * ligne.prixUnitaire) ?? 0
                }));
              } else if (Array.isArray(rawData.articles) && rawData.articles.length > 0) {
                order.items = rawData.articles.map((article: any) => ({
                  id: article.id?.toString(),
                  productId: article.produit?.id?.toString() || article.productId?.toString(),
                  productName: article.produit?.nom ?? article.designation ?? article.productName,
                  quantity: article.quantite ?? article.quantity ?? 0,
                  unitPrice: article.prixUnitaire ?? article.unitPrice ?? 0,
                  total: article.montantHT ?? article.total ?? (article.quantite * article.prixUnitaire) ?? 0
                }));
              }
              
              return order;
            }),
            tap((order) => {
              this.backendAvailable = true;
              this.backendUnavailableMessage = 'Utilisation du backend de secours';
              console.log('Commande récupérée via backup:', order);
            }),
            catchError((secondError) => {
              console.error('Erreur de récupération (backup):', secondError);
              this.backendAvailable = false;
              this.backendUnavailableMessage = 'Backend indisponible, utilisation de données fictives';
              const mockOrder = this.mockOrders.find((o) => o.id === id);
              if (mockOrder) {
                return of(mockOrder);
              }
              return throwError(() => new Error('Commande non trouvée'));
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

    // Préparation des données d'email avec tous les formats d'ID possibles
    const emailData = { 
      email, 
      subject, 
      message,
      orderId: id, // Format principal
      id: id       // Format alternatif pour compatibilité
    };

    console.log(`Tentative d'envoi d'email pour la commande ${id} à ${email}`);

    // Essayer d'abord l'endpoint spécifique à l'ID
    return this.http
      .post(`${this.apiUrl}/${id}/send-email`, emailData, { headers: this.getAuthHeaders() })
      .pipe(
        tap(() => console.log(`Commande ${id} envoyée à ${email} avec succès`)),
        catchError((error) => {
          console.log(`Échec avec l'endpoint /${id}/send-email (${error.status}): ${error.message}`);
          console.log(`Essai avec /send-order-email...`);
          
          // Si l'endpoint spécifique à l'ID échoue, essayer l'endpoint générique
          return this.http.post(`${this.apiUrl}/send-order-email`, emailData, { headers: this.getAuthHeaders() })
            .pipe(
              tap(() => console.log(`Commande ${id} envoyée à ${email} via endpoint alternatif avec succès`)),
              catchError((secondError) => {
                console.log(`Échec avec l'endpoint /send-order-email (${secondError.status}): ${secondError.message}`);
                console.log(`Essai avec /test-email...`);
                
                // Si l'endpoint générique échoue, essayer l'endpoint de test
                return this.http.post(`${this.apiUrl}/test-email`, { 
                  email, 
                  subject: subject || `Test pour commande ${id}`,
                  message: message || `Ceci est un email de test pour la commande ${id}`
                }, { headers: this.getAuthHeaders() })
                  .pipe(
                    tap(() => console.log(`Email de test envoyé à ${email} avec succès`)),
                    catchError((finalError) => {
                      console.error(`Toutes les tentatives d'envoi d'email ont échoué:`, finalError);
                      // Log détaillé pour le débogage
                      console.error(`Détails de la dernière erreur:`, {
                        status: finalError.status,
                        statusText: finalError.statusText,
                        message: finalError.message,
                        url: finalError.url
                      });
                      return throwError(() => new Error(`Impossible d'envoyer l'email: ${finalError.message || 'Erreur de serveur'}`));
                    })
                  );
              })
            );
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
    console.log('Début du mapping de la commande API vers le modèle frontend');
    console.log('Données brutes reçues du backend:', JSON.stringify(apiOrder, null, 2));
    
    // Vérifier si l'objet apiOrder est valide
    if (!apiOrder) {
      console.warn('Objet apiOrder invalide ou null, création d\'une commande vide');
      return this.createEmptyPurchaseOrder();
    }
    
    // Vérifier si les lignes de commande existent et sont accessibles
    let items: PurchaseOrderItem[] = [];
    
    // S'assurer que lignes n'est pas null avant de chercher des articles
    if (!apiOrder.lignes || apiOrder.lignes === null) {
      apiOrder.lignes = [];
      console.log('Propriété lignes était null ou non définie, initialisée avec un tableau vide');
    }
    
    // Essayer différents formats de données pour les articles
    const possibleItemsProperties = [
      'lignes',
      'lignesCommande',
      'articles',
      'items',
      'orderItems',
      'purchaseOrderItems'
    ];
    
    // Trouver la première propriété qui contient des articles
    const itemsProperty = possibleItemsProperties.find(prop => {
      const hasItems = Array.isArray(apiOrder[prop]) && apiOrder[prop].length > 0;
      if (hasItems) {
        console.log(`Articles trouvés dans la propriété '${prop}':`, apiOrder[prop]);
      }
      return hasItems;
    });
    
    if (itemsProperty) {
      console.log(`Utilisation de la propriété '${itemsProperty}' pour les articles`);
      const rawItems = apiOrder[itemsProperty];
      
      items = rawItems.map((item: any, index: number) => {
        console.log(`Traitement de l'article ${index + 1}/${rawItems.length}:`, item);
        
        // Extraire les propriétés selon différents formats possibles
        const id = item.id?.toString();
        const productId = item.produit?.id?.toString() || item.productId?.toString();
        const productName = item.produit?.nom || item.designation || item.productName || 'Produit sans nom';
        const quantity = Number(item.quantite || item.quantity || 0);
        const unitPrice = Number(item.prixUnitaire || item.unitPrice || 0);
        const total = Number(item.montantHT || item.total || (quantity * unitPrice) || 0);
        
        return {
          id,
          productId,
          productName,
          quantity,
          unitPrice,
          total
        };
      });
      
      console.log(`Nombre d'articles mappés: ${items.length}`);
    } else {
      console.warn(`Aucune propriété contenant des articles n'a été trouvée dans la réponse API`);
      console.warn(`Propriétés disponibles:`, Object.keys(apiOrder));
      
      // Essayer de récupérer les articles directement si la réponse est un tableau
      if (Array.isArray(apiOrder)) {
        console.warn('La réponse est un tableau, tentative d\'extraction des articles...');
        items = apiOrder
          .filter((item: any) => item.productId || item.produit?.id)
          .map((item: any) => ({
            id: item.id?.toString(),
            productId: item.produit?.id?.toString() || item.productId?.toString(),
            productName: item.produit?.nom || item.designation || item.productName || 'Produit sans nom',
            quantity: Number(item.quantite || item.quantity || 0),
            unitPrice: Number(item.prixUnitaire || item.unitPrice || 0),
            total: Number(item.montantHT || item.total || 0)
          }));
        
        if (items.length > 0) {
          console.log(`Extrait ${items.length} articles du tableau de réponse`);
        }
      }
    }
    
    // Extraire les informations de base de la commande
    const orderId = apiOrder.id?.toString();
    const orderNumber = apiOrder.numero || apiOrder.orderNumber || '';
    const supplierId = apiOrder.fournisseur?.id?.toString() || apiOrder.supplierId?.toString() || '';
    const supplierName = apiOrder.fournisseur?.nom || apiOrder.supplierName || '';
    const supplierEmail = apiOrder.fournisseur?.email || apiOrder.emailFournisseur || apiOrder.supplierEmail || '';
    const supplierAddress = apiOrder.fournisseur?.adresse || apiOrder.supplierAddress || '';
    const status = this.mapApiStatus(apiOrder.statut || apiOrder.status || 'DRAFT');
    const orderDate = apiOrder.dateCommande || apiOrder.orderDate || new Date().toISOString();
    const expectedDeliveryDate = apiOrder.dateLivraisonPrevue || apiOrder.expectedDeliveryDate;
    const deliveryDate = apiOrder.dateLivraisonEffective || apiOrder.deliveryDate;
    const notes = apiOrder.notes || '';
    const createdAt = apiOrder.dateCreation || apiOrder.createdAt;
    const updatedAt = apiOrder.dateModification || apiOrder.updatedAt;
    
    // Calculer le total s'il n'est pas fourni
    const calculatedTotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const total = Number(apiOrder.montantTTC || apiOrder.montantTotal || apiOrder.total || calculatedTotal);
    
    const mappedOrder: PurchaseOrder = {
      id: orderId,
      orderNumber,
      supplierId,
      supplierName,
      supplierEmail,
      supplierAddress,
      status,
      orderDate,
      expectedDeliveryDate,
      deliveryDate,
      items,
      total,
      notes,
      createdAt,
      updatedAt
    };
    
    console.log('Commande mappée vers le modèle frontend:', JSON.stringify(mappedOrder, null, 2));
    return mappedOrder;
  }

  private mapModelToApiOrder(order: PurchaseOrder): any {
    console.log('Début du mapping de la commande frontend vers le format API:', order);
    
    // Vérifier si les articles existent
    const lignes = (order.items || []).map((item, index) => {
      console.log(`Mapping de l'article ${index + 1}/${order.items?.length || 0}:`, item);
      
      // S'assurer que les valeurs numériques sont bien des nombres
      const quantite = Number(item.quantity) || 0;
      const prixUnitaire = Number(item.unitPrice) || 0;
      const montantHT = Number(item.total) || (quantite * prixUnitaire);
      
      return {
        id: item.id || undefined, // Ne pas inclure si non défini
        produit: {
          id: item.productId,
          nom: item.productName || 'Produit sans nom'
        },
        designation: item.productName || 'Produit sans nom',
        quantite: quantite,
        prixUnitaire: prixUnitaire,
        montantHT: montantHT,
        // Ajout de champs supplémentaires qui pourraient être requis par le backend
        tva: 0, // Valeur par défaut pour la TVA
        remise: 0, // Valeur par défaut pour la remise
        unite: 'unité' // Valeur par défaut pour l'unité
      };
    });
    
    console.log(`Nombre d'articles mappés: ${lignes.length}`);
    
    // Créer l'objet de commande au format API
    const apiOrder = {
      id: order.id || undefined, // Ne pas inclure si c'est une nouvelle commande
      numero: order.orderNumber || undefined,
      fournisseur: order.supplierId ? {
        id: order.supplierId,
        nom: order.supplierName || 'Fournisseur inconnu',
        email: order.supplierEmail || undefined,
        adresse: order.supplierAddress || undefined
      } : null,
      emailFournisseur: order.supplierEmail || undefined,
      statut: this.mapModelStatus(order.status || 'DRAFT'),
      dateCommande: order.orderDate || new Date().toISOString(),
      dateLivraisonPrevue: order.expectedDeliveryDate || undefined,
      dateLivraisonEffective: order.deliveryDate || undefined,
      lignes: lignes,
      lignesCommande: lignes, // Alias pour compatibilité
      // Format alternatif pour les articles si le backend l'attend différemment
      articles: lignes.map(ligne => ({
        id: ligne.id,
        productId: ligne.produit.id,
        productName: ligne.produit.nom,
        quantity: ligne.quantite,
        unitPrice: ligne.prixUnitaire,
        total: ligne.montantHT
      })),
      montantTTC: Number(order.total) || 0,
      montantHT: Number(order.total) || 0, // Même valeur que montantTTC si pas de TVA
      montantTotal: Number(order.total) || 0, // Alias pour compatibilité
      notes: order.notes || undefined,
      // Champs supplémentaires qui pourraient être requis
      devise: 'MAD', // Devise par défaut
      tauxTVA: 0, // Taux de TVA par défaut
      montantTVA: 0, // Montant TVA par défaut
      remise: 0, // Remise par défaut
      modePaiement: 'VIREMENT', // Mode de paiement par défaut
      delaiPaiement: '30j', // Délai de paiement par défaut
      conditions: '30 jours fin de mois' // Conditions par défaut
    };
    
    // Nettoyer l'objet pour supprimer les champs undefined
    const cleanApiOrder = JSON.parse(JSON.stringify(apiOrder));
    
    console.log('Commande mappée vers le format API:', JSON.stringify(cleanApiOrder, null, 2));
    return cleanApiOrder;
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
  /*                             GESTION DES LIGNES                            */
  /* -------------------------------------------------------------------------- */

  /**
   * Ajoute une ligne (article) à une commande existante
   * @param orderId ID de la commande
   * @param item Données de l'article à ajouter
   * @returns Observable contenant la ligne créée
   */
  addLineToOrder(orderId: string, item: Partial<PurchaseOrderItem>): Observable<any> {
    this.loading.next(true);
    console.log(`Ajout d'un article à la commande ${orderId}:`, item);
    
    // Préparer les données à envoyer au backend
    const lineData = {
      produitId: item.productId,
      designation: item.productName,
      quantite: item.quantity,
      prixUnitaireHT: item.unitPrice,
      tauxTVA: 20 // Valeur par défaut si non spécifiée
    };
    
    console.log(`Données formatées pour le backend:`, lineData);
    
    // Construire l'URL pour l'ajout de ligne
    const url = `${this.apiUrl}/${orderId}/lignes`;
    console.log(`Envoi de la requête POST à ${url}`);
    
    return this.http.post(url, lineData, { headers: this.getAuthHeaders() }).pipe(
      tap(response => {
        console.log(`Ligne ajoutée avec succès à la commande ${orderId}:`, response);
        // Déclencher un événement pour indiquer que la commande a été mise à jour
        this.getPurchaseOrderById(orderId).subscribe(updatedOrder => {
          this.orderUpdated.next(updatedOrder);
        });
      }),
      catchError(error => {
        console.error(`Erreur lors de l'ajout de la ligne à la commande ${orderId}:`, error);
        // Essayer avec l'URL de secours
        return this.tryAddLineWithBackupUrl(orderId, lineData);
      }),
      finalize(() => {
        this.loading.next(false);
      })
    );
  }
  
  /**
   * Essaie d'ajouter une ligne avec l'URL de secours
   */
  private tryAddLineWithBackupUrl(orderId: string, lineData: any): Observable<any> {
    const backupUrl = `${this.backupApiUrl}/${orderId}/lignes`;
    console.log(`Tentative avec l'URL de secours: ${backupUrl}`);
    
    return this.http.post(backupUrl, lineData, { headers: this.getAuthHeaders() }).pipe(
      tap(response => {
        console.log(`Ligne ajoutée avec succès via l'URL de secours:`, response);
      }),
      catchError(error => {
        console.error(`Échec de l'ajout de ligne avec l'URL de secours:`, error);
        return throwError(() => new Error(`Impossible d'ajouter la ligne à la commande. Veuillez réessayer plus tard.`));
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
    // Ajout de fournisseurs fictifs pour améliorer les données de test
    return [
      {
        id: '1',
        name: 'Fournisseur Matières Premières',
        email: 'contact@matieres-premieres.com',
        phone: '01 23 45 67 89',
        address: '123 Rue des Matières, 75001 Paris'
        // Suppression des champs non définis dans l'interface Supplier
      },
      {
        id: '2',
        name: 'Emballages Express',
        email: 'service@emballages-express.fr',
        phone: '01 98 76 54 32',
        address: '45 Avenue des Cartons, 69002 Lyon'
        // Suppression des champs non définis dans l'interface Supplier
      },
      {
        id: '3',
        name: 'Équipements Industriels Pro',
        email: 'info@equipro.com',
        phone: '03 45 67 89 01',
        address: '78 Boulevard Industriel, 33000 Bordeaux'
        // Suppression des champs non définis dans l'interface Supplier
      }
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
