import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, throwError, of } from 'rxjs';
import { catchError, tap, finalize, map, switchMap, timeout } from 'rxjs/operators';
import { AuthService } from '../../auth/services/auth.service';
import { MockDataService } from '../../fournisseur/services/mock-data.service';

type FactureStatus = 'DRAFT' | 'PENDING' | 'PAID' | 'CANCELLED';

export interface ProductCategory {
  id?: number;
  name?: string;
}

export interface Dimensions {
  length?: number;
  width?: number;
  height?: number;
}

export interface FactureItem {
  id: string;
  factureId: string;
  productId: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  price?: number; // Alias pour unitPrice pour la rétrocompatibilité
  total: number;
  taxRate?: number;
  tax?: number;
  discount?: number;
  imageUrl?: string;
  category?: ProductCategory;
  sku?: string;
  barcode?: string;
  weight?: number;
  dimensions?: Dimensions;
  metadata?: Record<string, any>;
  product?: {
    id: string;
    name: string;
    category?: ProductCategory;
    sku?: string;
    barcode?: string;
    price?: number;
    imageUrl?: string;
    weight?: number;
    dimensions?: Dimensions;
    metadata?: Record<string, any>;
  };
}

export interface Facture {
  id: string;
  number?: string;
  reference?: string;
  vendorId?: string;
  vendorName?: string;
  vendorEmail?: string;
  vendorAddress?: string;
  clientId?: string;
  clientName: string;
  clientEmail: string;
  clientAddress?: string;
  clientPhone?: string;
  date: Date | string;
  dueDate: Date | string;
  status: FactureStatus;
  total: number;
  subtotal?: number;
  tax?: number;
  discount?: number;
  notes?: string;
  items: FactureItem[];
  paymentMethod?: string;
  paymentStatus?: string;
  pdfUrl?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

@Injectable({ providedIn: 'root' })
export class FactureService {
  private apiUrl = 'http://localhost:8085/api/factures';
  private loading = new Subject<boolean>();
  loading$ = this.loading.asObservable();

  private factureCreated = new Subject<Facture>();
  factureCreated$ = this.factureCreated.asObservable();

  private factureUpdated = new Subject<Facture>();
  factureUpdated$ = this.factureUpdated.asObservable();
  
  // Propriétés pour gérer l'indisponibilité du backend
  private backendAvailable = true;
  private showedMockDataWarning = false;

  constructor(
    private http: HttpClient, 
    private authService: AuthService,
    private mockDataService: MockDataService
  ) {
    // Vérifie la disponibilité du backend au démarrage du service
    this.checkBackendAvailability().subscribe(available => {
      console.log(`Backend de facturation ${available ? 'disponible' : 'non disponible'} au démarrage`);
      if (!available) {
        this.showMockDataWarning();
      }
    });
  }
  
  /**
   * Vérifie la disponibilité du backend
   * @returns Observable<boolean> - true si le backend est disponible, false sinon
   */
  checkBackendAvailability(): Observable<boolean> {
    console.log('Vérification de la disponibilité du backend de facturation...');
    
    // Essayer d'abord l'URL principale (port 8085)
    const mainUrl = 'http://localhost:8085/api/factures';
    
    // Vérifier si le backend est disponible en essayant de récupérer une liste vide de factures
    return this.http.get<any>(`${mainUrl}`, { 
      headers: this.getAuthHeaders(),
      params: new HttpParams().set('limit', '1') // Limiter à 1 résultat pour minimiser les données
    }).pipe(
      timeout(3000), // Timeout après 3 secondes
      map(() => {
        console.log('Backend de facturation disponible sur le port 8085');
        this.apiUrl = mainUrl;
        this.backendAvailable = true;
        return true;
      }),
      catchError(error => {
        // Essayer une URL alternative sur le port 8080
        console.log(`Erreur avec l'URL principale (port 8085): ${error.message || error}`);
        console.log('Tentative avec le port 8080...');
        const alternativeUrl = 'http://localhost:8080/api/factures';
        
        return this.http.get<any>(`${alternativeUrl}`, { 
          headers: this.getAuthHeaders(),
          params: new HttpParams().set('limit', '1')
        }).pipe(
          timeout(3000),
          map(() => {
            console.log('Backend de facturation disponible sur le port 8080');
            this.apiUrl = alternativeUrl;
            this.backendAvailable = true;
            return true;
          }),
          catchError(err => {
            // Dernière tentative avec un autre chemin d'API
            console.log(`Erreur avec l'URL alternative (port 8080): ${err.message || err}`);
            console.log('Dernière tentative avec un autre chemin d\'API...');
            const lastAttemptUrl = 'http://localhost:8085/api/v1/factures';
            
            return this.http.get<any>(`${lastAttemptUrl}`, { 
              headers: this.getAuthHeaders(),
              params: new HttpParams().set('limit', '1')
            }).pipe(
              timeout(3000),
              map(() => {
                console.log('Backend de facturation disponible sur le chemin alternatif');
                this.apiUrl = lastAttemptUrl;
                this.backendAvailable = true;
                return true;
              }),
              catchError(finalErr => {
                console.warn(`Backend de facturation non disponible après toutes les tentatives: ${finalErr.message || finalErr}`);
                this.backendAvailable = false;
                this.showMockDataWarning();
                return of(false);
              })
            );
          })
        );
      })
    );
  }

  /**
   * Affiche un avertissement si les données fictives sont utilisées
   */
  private showMockDataWarning(): void {
    if (!this.backendAvailable && !this.showedMockDataWarning) {
      console.warn('ATTENTION: Le backend des factures n\'est pas disponible. Des données fictives sont affichées.');
      // Ici, vous pourriez ajouter un code pour afficher une notification à l'utilisateur
      this.showedMockDataWarning = true;
    }
  }

  /**
   * Notifie les autres composants qu'une facture a été mise à jour
   * @param facture La facture mise à jour
   */
  notifyFactureUpdated(facture: Facture): void {
    if (facture) {
      console.log('Notification de mise à jour de facture:', facture);
      this.factureUpdated.next(facture);
    }
  }

  /**
   * Crée une facture vide avec des valeurs par défaut
   */
  createEmptyFacture(): Facture {
    return {
      id: '',
      clientName: '',
      clientEmail: '',
      date: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 jours plus tard
      status: 'DRAFT',
      total: 0,
      subtotal: 0,
      tax: 0,
      discount: 0,
      items: []
    };
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Ajouter le token d'authentification s'il est disponible
    if (token) {
      return new HttpHeaders({
        ...headers,
        'Authorization': `Bearer ${token}`
      });
    }
    
    // Sinon, retourner les en-têtes de base sans authentification
    console.log('Aucun token d\'authentification disponible, envoi de la requête sans authentification');
    return new HttpHeaders(headers);
  }

  getFactures(params?: {
    status?: FactureStatus;
    startDate?: Date;
    endDate?: Date;
    vendorId?: string;
    searchTerm?: string;   // Recherche par numéro ou référence
    clientName?: string;   // Recherche par nom de client
  }): Observable<Facture[]> {
    this.loading.next(true);
    
    // Si le backend n'est pas disponible, utiliser directement les données fictives
    if (!this.backendAvailable) {
      console.log('Backend indisponible, utilisation de données fictives pour la liste des factures');
      this.showMockDataWarning();
      return this.getMockFactures(params);
    }
    
    // Définir un timeout pour éviter les attentes trop longues
    const requestTimeout = 5000; // 5 secondes

    let httpParams = new HttpParams();
    if (params) {
      if (params.status) httpParams = httpParams.set('statut', params.status);
      
      // Vérifier que startDate est une instance de Date avant d'appeler toISOString()
      if (params.startDate) {
        const startDate = params.startDate instanceof Date ? 
                         params.startDate.toISOString() : params.startDate;
        httpParams = httpParams.set('dateDebut', startDate);
      }
      
      // Vérifier que endDate est une instance de Date avant d'appeler toISOString()
      if (params.endDate) {
        const endDate = params.endDate instanceof Date ? 
                       params.endDate.toISOString() : params.endDate;
        httpParams = httpParams.set('dateFin', endDate);
      }
      
      if (params.vendorId) httpParams = httpParams.set('vendorId', params.vendorId);
      if (params.searchTerm) httpParams = httpParams.set('searchTerm', params.searchTerm);
      if (params.clientName) httpParams = httpParams.set('clientName', params.clientName);
    }

    return this.http.get(`${this.apiUrl}`, {
      headers: this.getAuthHeaders(),
      params: httpParams,
      responseType: 'text'
    }).pipe(
      timeout(requestTimeout),
      map(responseText => {
        try {
          const response = JSON.parse(responseText);
          console.log('Réponse du backend pour getFactures:', response);
          return Array.isArray(response)
            ? response.map(facture => this.mapSpringBootFactureToAngular(facture))
            : [];
        } catch (parseError) {
          console.error('Erreur lors du parsing de la réponse JSON:', parseError);
          console.log('Réponse brute reçue:', responseText);
          return []; // Retourner un tableau vide en cas d'erreur de parsing
        }
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des factures:', error);
        console.warn('Utilisation des données fictives pour la liste des factures suite à une erreur');
        this.backendAvailable = false;
        this.showMockDataWarning();
        return this.getMockFactures(params);
      }),
      finalize(() => this.loading.next(false))
    );  
  }

  getFactureById(id: string): Observable<Facture> {
    console.log(`Récupération de la facture avec ID: ${id}`);
    this.loading.next(true);
    
    // Si le backend n'est pas disponible, utiliser directement les données fictives
    if (!this.backendAvailable) {
      console.log(`Backend indisponible, utilisation de données fictives pour la facture ${id}`);
      this.showMockDataWarning();
      return this.getMockFactureById(id);
    }
    
    // Définir un timeout pour éviter les attentes trop longues
    const requestTimeout = 5000; // 5 secondes
    
    // Récupérer la facture avec ses lignes (grâce aux annotations Jackson)
    return this.http.get<any>(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      timeout(requestTimeout),
      map(response => {
        console.log('Réponse brute du backend pour getFactureById:', JSON.stringify(response, null, 2));
        const mappedFacture = this.mapSpringBootFactureToAngular(response);
        
        // Recalculer les totaux si nécessaire
        if (!mappedFacture.subtotal || !mappedFacture.tax || !mappedFacture.total) {
          mappedFacture.subtotal = this.calculateSubtotal(mappedFacture.items);
          mappedFacture.tax = this.calculateTaxAmount(mappedFacture.subtotal, 20); // 20% de TVA
          mappedFacture.total = this.calculateTotal(mappedFacture.subtotal, mappedFacture.tax, mappedFacture.discount || 0);
        }
        
        return mappedFacture;
      }),
      catchError(error => {
        console.error(`Erreur lors de la récupération de la facture ${id}:`, error);
        console.warn(`Utilisation des données fictives pour la facture ${id} suite à une erreur`);
        this.backendAvailable = false;
        this.showMockDataWarning();
        return this.getMockFactureById(id);
      }),
      finalize(() => this.loading.next(false))
    );
  }
  
  /**
   * Récupère les lignes d'une facture
   * @param factureId ID de la facture
   * @returns Observable des lignes de facture
   */
  private getFactureLines(factureId: string): Observable<FactureItem[]> {
    console.log(`Tentative de récupération des lignes pour la facture ${factureId}`);
    
    // Définir un timeout pour éviter les attentes trop longues
    const requestTimeout = 5000; // 5 secondes
    
    // Essayer d'abord avec l'endpoint /lignes
    return this.http.get<any>(`${this.apiUrl}/${factureId}/lignes`, {
      headers: this.getAuthHeaders()
    }).pipe(
      timeout(requestTimeout),
      map(response => {
        console.log(`Réponse pour les lignes de la facture ${factureId}:`, JSON.stringify(response, null, 2));
        
        const items: FactureItem[] = [];
        
        // Cas 1: La réponse est un tableau d'objets
        if (Array.isArray(response)) {
          console.log(`La réponse est un tableau de ${response.length} éléments`);
          response.forEach((ligne: any, index: number) => {
            items.push(this.mapLigneFactureToFactureItem(ligne, factureId, index));
          });
        } 
        // Cas 2: La réponse est un objet avec une propriété contenant un tableau
        else if (response && typeof response === 'object') {
          // Vérifier les propriétés possibles qui pourraient contenir les lignes
          const possibleArrayProps = ['lignes', 'items', 'content', 'data', 'results'];
          const responseObj = response as Record<string, any>;
          
          for (const prop of possibleArrayProps) {
            if (responseObj[prop] && Array.isArray(responseObj[prop])) {
              console.log(`Trouvé un tableau dans la propriété '${prop}' avec ${responseObj[prop].length} éléments`);
              responseObj[prop].forEach((ligne: any, index: number) => {
                items.push(this.mapLigneFactureToFactureItem(ligne, factureId, index));
              });
              break;
            }
          }
        }
        
        if (items.length === 0) {
          console.warn(`Aucune ligne trouvée pour la facture ${factureId} dans la réponse`);
        } else {
          console.log(`${items.length} lignes mappées avec succès pour la facture ${factureId}`);
        }
        
        return items;
      }),
      catchError(error => {
        console.error(`Erreur lors de la récupération des lignes de la facture ${factureId}:`, error);
        
        // Si l'endpoint /lignes échoue, essayer avec l'endpoint principal de la facture
        console.log(`Tentative alternative: récupération de la facture complète ${factureId}`);
        return this.http.get<any>(`${this.apiUrl}/${factureId}`, {
          headers: this.getAuthHeaders()
        }).pipe(
          timeout(requestTimeout),
          map(factureResponse => {
            console.log(`Réponse alternative pour la facture ${factureId}:`, JSON.stringify(factureResponse, null, 2));
            
            const items: FactureItem[] = [];
            const response = factureResponse as Record<string, any>;
            
            // Vérifier si la facture contient des lignes
            if (response['lignes'] && Array.isArray(response['lignes'])) {
              response['lignes'].forEach((ligne: any, index: number) => {
                items.push(this.mapLigneFactureToFactureItem(ligne, factureId, index));
              });
            } else if (response['items'] && Array.isArray(response['items'])) {
              response['items'].forEach((item: any, index: number) => {
                items.push(this.mapLigneFactureToFactureItem(item, factureId, index));
              });
            }
            
            return items;
          }),
          catchError(secondError => {
            console.error(`Échec de la récupération alternative pour la facture ${factureId}:`, secondError);
            
            // Les deux méthodes ont échoué, utiliser des données fictives
            console.warn(`Toutes les tentatives de récupération des lignes ont échoué, utilisation de données fictives`);
            
            // Marquer le backend comme indisponible
            this.backendAvailable = false;
            this.showMockDataWarning();
            
            // Utiliser le MockDataService pour générer des lignes fictives
            return this.mockDataService.getMockLignesFacture(factureId).pipe(
              map(mockLignes => {
                console.log(`Génération de ${mockLignes.length} lignes fictives pour la facture ${factureId}`);
                
                // Convertir les lignes fictives au format FactureItem
                return mockLignes.map((ligne: any, index: number) => this.mapLigneFactureToFactureItem(ligne, factureId, index));
              })
            );
          })
        );
      })
    );
  }

  /**
   * Convertit une ligne de facture du format backend au format FactureItem
   */
  private mapLigneFactureToFactureItem(ligne: any, factureId: string, index: number): FactureItem {
    // Afficher les détails de la ligne pour le débogage
    console.log(`Mapping de la ligne ${index}:`, JSON.stringify(ligne, null, 2));
    
    // Déterminer si c'est une ligne au format Spring Boot ou au format Angular
    if (ligne.produitId || ligne.nomProduit) {
      // Format Spring Boot
      return {
        id: ligne.id?.toString() || `LIGNE-${index}`,
        factureId: factureId,
        productId: ligne.produitId?.toString() || '',
        productName: ligne.nomProduit || `Produit ${index}`,
        description: ligne.description || '',
        quantity: ligne.quantite || 0,
        unitPrice: ligne.prixUnitaire || 0,
        total: ligne.montant || (ligne.quantite * ligne.prixUnitaire) || 0,
        taxRate: ligne.tva || 0,
        tax: ligne.montantTva || 0,
        discount: ligne.remise || 0
      };
    } else {
      // Format Angular ou autre
      return {
        id: ligne.id?.toString() || index.toString(),
        factureId: factureId,
        productId: ligne.productId?.toString() || '',
        productName: ligne.productName || ligne.name || `Produit ${index}`,
        description: ligne.description || '',
        quantity: ligne.quantity || 0,
        unitPrice: ligne.unitPrice || ligne.price || 0,
        total: ligne.total || (ligne.quantity * ligne.unitPrice) || 0,
        taxRate: ligne.taxRate || 0,
        tax: ligne.tax || 0,
        discount: ligne.discount || 0
      };
    }
  }

  /**
   * Met à jour le statut d'une facture
   * @param id Identifiant de la facture
   * @param status Nouveau statut de la facture
   */
  updateFactureStatus(id: string, status: FactureStatus): Observable<Facture> {
    this.loading.next(true);
    
    // Convertir le statut du format Angular au format attendu par le backend
    const backendStatus = this.mapFactureStatusToStatut(status);
    console.log(`Mise à jour du statut de la facture ${id} de ${status} vers ${backendStatus} (format backend)`);
    
    // Créer l'objet de mise à jour avec uniquement le statut
    const updateData = {
      statut: backendStatus
    };
    
    return this.http.patch<any>(`${this.apiUrl}/${id}/statut`, updateData, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        console.log('Réponse brute du backend après mise à jour du statut:', response);
        const updatedFacture = this.mapSpringBootFactureToAngular(response);
        return updatedFacture;
      }),
      tap(updatedFacture => {
        console.log('Statut de la facture mis à jour avec succès:', updatedFacture);
        this.factureUpdated.next(updatedFacture);
      }),
      catchError(error => {
        console.error(`Erreur lors de la mise à jour du statut de la facture ${id}:`, error);
        return throwError(() => new Error(`Échec de la mise à jour du statut: ${error.message}`));
      }),
      finalize(() => this.loading.next(false))
    );
  }
  
  /**
   * Convertit une facture du format Spring Boot au format Angular
   * @param springBootFacture Facture au format Spring Boot
   * @returns Facture au format Angular
   */
  private mapSpringBootFactureToAngular(springBootFacture: any): Facture {
    console.log('Facture reçue du backend:', JSON.stringify(springBootFacture, null, 2));
    
    // Mapper les lignes de facture
    const items: FactureItem[] = [];
    
    // Vérifier si les lignes existent sous la propriété 'lignes'
    if (springBootFacture.lignes && Array.isArray(springBootFacture.lignes)) {
      console.log(`Traitement de ${springBootFacture.lignes.length} lignes de facture`);
      
      springBootFacture.lignes.forEach((ligne: any, index: number) => {
        console.log(`Ligne ${index}:`, JSON.stringify(ligne, null, 2));
        
        items.push({
          id: ligne.id?.toString() || index.toString(),
          factureId: springBootFacture.id?.toString() || '',
          productId: ligne.idProduit?.toString() || '',
          productName: ligne.nomProduit || '',
          description: ligne.description || '',
          quantity: ligne.quantite || 0,
          unitPrice: ligne.prixUnitaire || 0,
          total: ligne.total || (ligne.quantite * ligne.prixUnitaire) || 0,
          taxRate: ligne.tva || 0,
          tax: ligne.montantTva || 0,
          discount: ligne.remise || 0
        });
      });
    } 
    // Vérifier si les lignes existent sous la propriété 'items'
    else if (springBootFacture.items && Array.isArray(springBootFacture.items)) {
      console.log(`Traitement de ${springBootFacture.items.length} items de facture`);
      
      springBootFacture.items.forEach((item: any, index: number) => {
        console.log(`Item ${index}:`, JSON.stringify(item, null, 2));
        
        items.push({
          id: item.id?.toString() || index.toString(),
          factureId: springBootFacture.id?.toString() || '',
          productId: item.productId?.toString() || '',
          productName: item.productName || '',
          description: item.description || '',
          quantity: item.quantity || 0,
          unitPrice: item.unitPrice || 0,
          total: item.total || (item.quantity * item.unitPrice) || 0,
          taxRate: item.taxRate || 0,
          tax: item.tax || 0,
          discount: item.discount || 0
        });
      });
    }
    
    if (items.length === 0) {
      console.warn('Aucune ligne de facture trouvée dans la réponse du backend');
    } else {
      console.log(`${items.length} lignes de facture mappées avec succès`);
    }
    
    // Mapper la facture
    const facture: Facture = {
      id: springBootFacture.id?.toString() || '',
      number: springBootFacture.numeroFacture || '',
      clientName: springBootFacture.client?.nom || '',
      clientEmail: springBootFacture.client?.email || '',
      clientAddress: springBootFacture.client?.adresse || '',
      clientPhone: springBootFacture.client?.telephone || '',
      date: this.formatDate(springBootFacture.dateCreation),
      dueDate: this.formatDate(springBootFacture.dateFinalisation) || this.formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      status: this.mapStatutToFactureStatus(springBootFacture.statut),
      total: springBootFacture.totalTTC || 0,
      subtotal: springBootFacture.totalHT || 0,
      tax: springBootFacture.totalTVA || 0,
      discount: springBootFacture.remise || 0,
      notes: springBootFacture.notes || '',
      items: items
    };
    
    console.log('Facture convertie pour Angular:', facture);
    return facture;
  }
  
  /**
   * Mappe le statut de la facture du format Spring Boot au format Angular
   */
  private mapStatutToFactureStatus(statut: string): FactureStatus {
    if (!statut) return 'DRAFT';
    
    // Ajouter des logs pour déboguer le mappage des statuts
    console.log('Mappage du statut Spring Boot vers Angular:', statut);
    
    switch(statut.toUpperCase()) {
      // Format français
      case 'BROUILLON':
        return 'DRAFT';
      case 'EN_ATTENTE':
        return 'PENDING';
      case 'PAYEE':
      case 'PAYÉE':
        return 'PAID';
      case 'ANNULEE':
      case 'ANNULÉE':
        return 'CANCELLED';
        
      // Format anglais
      case 'DRAFT':
        return 'DRAFT';
      case 'PENDING':
        return 'PENDING';
      case 'PAID':
        return 'PAID';
      case 'CANCELLED':
        return 'CANCELLED';
        
      default:
        console.warn('Statut inconnu reçu du backend:', statut);
        return 'PENDING';
    }
  }
  
  /**
   * Formate une date pour l'affichage
   */
  private formatDate(date: any): string {
    if (!date) return new Date().toISOString();
    
    // Si c'est déjà une chaîne de caractères, la retourner
    if (typeof date === 'string') return date;
    
    // Si c'est un tableau (format Spring Boot), le convertir en Date
    if (Array.isArray(date) && date.length >= 3) {
      // Format: [année, mois, jour, heure, minute, seconde, ...]
      const year = date[0];
      const month = date[1] - 1; // Les mois commencent à 0 en JavaScript
      const day = date[2];
      const hour = date.length > 3 ? date[3] : 0;
      const minute = date.length > 4 ? date[4] : 0;
      const second = date.length > 5 ? date[5] : 0;
      
      return new Date(year, month, day, hour, minute, second).toISOString();
    }
    
    // Si c'est une Date, la convertir en chaîne ISO
    if (date instanceof Date) return date.toISOString();
    
    // Par défaut, retourner la date actuelle
    return new Date().toISOString();
  }

  createFacture(facture: Partial<Facture>): Observable<Facture> {
    this.loading.next(true);

    // Convertir du format Angular au format Spring Boot
    const springBootFacture: any = {
      // Données de base de la facture
      dateCreation: facture.date || new Date().toISOString(),
      dateFinalisation: facture.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      statut: facture.status || 'DRAFT',
      notes: facture.notes || '',
      remise: facture.discount || 0,
      totalHT: facture.subtotal || 0,
      totalTVA: facture.tax || 0,
      totalTTC: facture.total || 0
    };

    // Ajouter les données du client si elles existent
    // Vérifier si des informations client significatives ont été fournies
    if ((facture.clientName && facture.clientName.trim() !== '') || 
        (facture.clientEmail && facture.clientEmail.trim() !== '')) {
      
      // Créer l'objet client avec tous les champs, même vides
      springBootFacture.client = {
        nom: facture.clientName ? facture.clientName.trim() : '',
        email: facture.clientEmail ? facture.clientEmail.trim() : '',
        adresse: facture.clientAddress ? facture.clientAddress.trim() : '',
        telephone: facture.clientPhone ? facture.clientPhone.trim() : ''
      };
      
      // Ajouter également les champs plats pour la rétrocompatibilité
      // Cela permet au contrôleur de récupérer les données même s'il ne traite pas l'objet client
      springBootFacture.clientName = facture.clientName ? facture.clientName.trim() : '';
      springBootFacture.clientEmail = facture.clientEmail ? facture.clientEmail.trim() : '';
      springBootFacture.clientAddress = facture.clientAddress ? facture.clientAddress.trim() : '';
      springBootFacture.clientPhone = facture.clientPhone ? facture.clientPhone.trim() : '';
      
      console.log('Données client ajoutées à la facture:', springBootFacture.client);
    } else {
      console.log('Aucune donnée client significative fournie');
    }

    // Convertir les lignes de facture si elles existent
    if (facture.items && facture.items.length > 0) {
      springBootFacture.lignes = facture.items.map(item => ({
        idProduit: parseInt(item.productId) || null,
        nomProduit: item.productName || '',
        description: item.description || '',
        quantite: item.quantity || 0,
        prixUnitaire: item.unitPrice || 0,
        remise: item.discount || 0,
        tva: item.taxRate || 20,
        montantTva: item.tax || 0
      }));
    }

    console.log('Données envoyées au backend Spring Boot:', JSON.stringify(springBootFacture, null, 2));

    // Utiliser une approche plus robuste pour gérer les erreurs
    return this.http.post<any>(this.apiUrl, springBootFacture, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        console.log('Réponse du backend après création de facture:', response);
        try {
          // Vérifier si la réponse est valide
          if (!response || typeof response !== 'object') {
            throw new Error('Réponse invalide du serveur');
          }
          return this.mapSpringBootFactureToAngular(response);
        } catch (error) {
          console.error('Erreur lors du mapping de la réponse:', error);
          // Créer une facture minimale avec l'ID si disponible
          const minimalFacture: Facture = {
            id: response.id || '',
            number: response.numeroFacture || '',
            date: response.dateCreation || new Date().toISOString(),
            dueDate: response.dateFinalisation || new Date().toISOString(),
            status: response.statut || 'DRAFT',
            clientName: response.client?.nom || '',
            clientEmail: response.client?.email || '',
            items: [],
            subtotal: response.totalHT || 0,
            tax: response.totalTVA || 0,
            total: response.totalTTC || 0
          };
          return minimalFacture;
        }
      }),
      tap(createdFacture => {
        console.log('Facture créée avec succès:', createdFacture);
        this.factureCreated.next(createdFacture);
      }),
      catchError(error => {
        console.error('Erreur lors de la création de la facture:', error);
        // Essayer de récupérer des informations utiles de l'erreur
        let errorMessage = 'Erreur lors de la création de la facture';
        if (error.error && error.error.message) {
          errorMessage = error.error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        return throwError(() => new Error(`Échec de la création de la facture: ${errorMessage}`));
      }),
      finalize(() => this.loading.next(false))
    );
  }

  /**
   * Convertit un statut du format Angular au format Spring Boot
   */
  private mapFactureStatusToStatut(status: FactureStatus): string {
    // Ajouter des logs pour déboguer le mappage des statuts
    console.log('Mappage du statut Angular vers Spring Boot:', status);
    
    // Essayer les deux formats (anglais et français) pour s'assurer que le backend comprend
    switch(status) {
      case 'DRAFT':
        return 'BROUILLON'; // Utiliser le format français que le backend pourrait attendre
      case 'PENDING':
        return 'EN_ATTENTE'; // Utiliser le format français que le backend pourrait attendre
      case 'PAID':
        return 'PAYEE'; // Utiliser le format français que le backend pourrait attendre
      case 'CANCELLED':
        return 'ANNULEE'; // Utiliser le format français que le backend pourrait attendre
      default:
        return 'BROUILLON';
    }
  }
  
  // La méthode updateFactureStatusInDetail est implémentée plus bas dans le fichier



  updateFacture(id: string, facture: Partial<Facture>): Observable<Facture> {
    this.loading.next(true);

    // Convertir du format Angular au format Spring Boot
    const springBootFacture: any = {
      // Données de base de la facture
      dateCreation: facture.date || new Date().toISOString(),
      dateFinalisation: facture.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      statut: facture.status || 'DRAFT',
      notes: facture.notes || '',
      remise: facture.discount || 0,
      totalHT: facture.subtotal || 0,
      totalTVA: facture.tax || 0,
      totalTTC: facture.total || 0
    };

    // Ajouter les données du client si elles existent
    // Vérifier si des informations client significatives ont été fournies
    if ((facture.clientName && facture.clientName.trim() !== '') || 
        (facture.clientEmail && facture.clientEmail.trim() !== '')) {
      
      // Créer l'objet client avec tous les champs, même vides
      springBootFacture.client = {
        nom: facture.clientName ? facture.clientName.trim() : '',
        email: facture.clientEmail ? facture.clientEmail.trim() : '',
        adresse: facture.clientAddress ? facture.clientAddress.trim() : '',
        telephone: facture.clientPhone ? facture.clientPhone.trim() : ''
      };
      
      // Ajouter également les champs plats pour la rétrocompatibilité
      springBootFacture.clientName = facture.clientName ? facture.clientName.trim() : '';
      springBootFacture.clientEmail = facture.clientEmail ? facture.clientEmail.trim() : '';
      springBootFacture.clientAddress = facture.clientAddress ? facture.clientAddress.trim() : '';
      springBootFacture.clientPhone = facture.clientPhone ? facture.clientPhone.trim() : '';
      
      console.log('Données client ajoutées à la mise à jour de facture:', springBootFacture.client);
    } else {
      console.log('Aucune donnée client significative fournie pour la mise à jour');
    }

    console.log('Données envoyées au backend pour mise à jour:', JSON.stringify(springBootFacture, null, 2));

    return this.http.put<any>(`${this.apiUrl}/${id}`, springBootFacture, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        console.log('Réponse du backend après mise à jour de facture:', response);
        return this.mapSpringBootFactureToAngular(response);
      }),
      tap(updatedFacture => {
        console.log('Facture mise à jour avec succès:', updatedFacture);
        this.factureUpdated.next(updatedFacture);
      }),
      catchError(error => {
        console.error(`Erreur lors de la mise à jour de la facture ${id}:`, error);
        return throwError(() => new Error(`Échec de la mise à jour: ${error.message}`));
      }),
      finalize(() => this.loading.next(false))
    );
  }

  deleteFacture(id: string): Observable<void> {
    this.loading.next(true);

    return this.http.delete<void>(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => {
        console.log(`Facture ${id} supprimée avec succès`);
      }),
      catchError(error => {
        console.error(`Erreur lors de la suppression de la facture ${id}:`, error);
        return throwError(() => new Error(`Échec de la suppression: ${error.message}`));
      }),
      finalize(() => this.loading.next(false))
    );
  }

  generatePdf(factureId: string): Observable<Blob> {
    console.log(`Tentative de génération du PDF pour la facture ${factureId} via ${this.apiUrl}/${factureId}/pdf`);
    this.loading.next(true);
    
    return this.http.get(`${this.apiUrl}/${factureId}/pdf`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    }).pipe(
      tap(response => {
        console.log(`PDF généré avec succès pour la facture ${factureId}`, response);
      }),
      catchError(error => {
        console.error(`Erreur lors de la génération du PDF pour la facture ${factureId}:`, error);
        
        // Essayer une URL alternative si la première échoue
        console.log(`Tentative avec l'URL alternative pour la génération du PDF...`);
        const alternativeUrl = `http://localhost:8085/api/factures/generate-pdf/${factureId}`;
        
        return this.http.get(alternativeUrl, {
          headers: this.getAuthHeaders(),
          responseType: 'blob'
        }).pipe(
          tap(response => {
            console.log(`PDF généré avec succès via l'URL alternative`, response);
          }),
          catchError(secondError => {
            console.error(`Échec de la génération du PDF via l'URL alternative:`, secondError);
            return throwError(() => new Error(`Échec de la génération du PDF: ${error.message}. Veuillez vérifier que le service de facturation est bien démarré sur le port 8085.`));
          })
        );
      }),
      finalize(() => this.loading.next(false))
    );
  }
  
  /**
   * Télécharge le reçu d'une facture au format PDF
   * @param factureId ID de la facture
   * @returns Observable contenant le blob du PDF
   */
  downloadReceipt(factureId: string): Observable<Blob> {
    console.log(`Téléchargement du reçu pour la facture ${factureId}`);
    this.loading.next(true);
    
    return this.http.get(`${this.apiUrl}/${factureId}/receipt`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    }).pipe(
      tap(blob => {
        console.log(`Reçu téléchargé avec succès pour la facture ${factureId}`);
        // Créer un URL pour le blob et déclencher le téléchargement
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recu-facture-${factureId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }),
      catchError(error => {
        console.error(`Erreur lors du téléchargement du reçu pour la facture ${factureId}:`, error);
        // En cas d'erreur, essayer de générer un reçu côté client
        return this.generateClientSideReceipt(factureId);
      }),
      finalize(() => this.loading.next(false))
    );
  }
  
  /**
   * Génère un reçu côté client en cas d'échec de l'API
   * @param factureId ID de la facture
   * @returns Observable contenant le blob du PDF généré côté client
   */
  private generateClientSideReceipt(factureId: string): Observable<Blob> {
    console.log(`Génération d'un reçu côté client pour la facture ${factureId}`);
    
    // Récupérer les détails de la facture
    return this.getFactureById(factureId).pipe(
      switchMap(facture => {
        // Utiliser pdfmake ou jspdf pour générer un PDF côté client
        // Pour l'instant, on utilise la méthode generatePdf existante comme fallback
        console.log(`Utilisation de la méthode generatePdf comme fallback pour la facture ${factureId}`);
        return this.generatePdf(factureId);
      }),
      catchError(error => {
        console.error(`Échec de la génération du reçu côté client pour la facture ${factureId}:`, error);
        return throwError(() => new Error(`Impossible de télécharger ou générer le reçu: ${error.message}`));
      })
    );
  }

  sendFactureByEmail(id: string, email: string, emailSubject: string, emailMessage: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/${id}/envoyer-email`,
      { email, subject: emailSubject, message: emailMessage },
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(error => {
        console.error(`Erreur lors de l'envoi de la facture ${id} par email:`, error);
        return throwError(() => new Error(`Échec de l'envoi de l'email: ${error.message}`));
      })
    );
  }

  /**
   * Calcule le sous-total d'une facture
   * @param items Les articles de la facture
   * @returns Le sous-total calculé
   */
  calculateSubtotal(items: FactureItem[]): number {
    if (!items || !Array.isArray(items)) return 0;
    return items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  }

  /**
   * Calcule le montant de la taxe
   * @param subtotal Le sous-total de la facture
   * @param taxRate Le taux de taxe en pourcentage
   * @returns Le montant de la taxe
   */
  calculateTaxAmount(subtotal: number, taxRate: number = 0): number {
    if (isNaN(subtotal) || isNaN(taxRate)) return 0;
    return subtotal * (taxRate / 100);
  }

  /**
   * Calcule le total de la facture
   * @param subtotal Le sous-total
   * @param taxAmount Le montant de la taxe
   * @param discount Le montant de la remise
   * @returns Le total de la facture
   */
  calculateTotal(subtotal: number, taxAmount: number = 0, discount: number = 0): number {
    return subtotal + taxAmount - discount;
  }

  /**
   * Recherche des factures avec des critères avancés
   * @param searchParams Paramètres de recherche
   * @returns Observable des factures correspondant aux critères
   */
  searchFactures(searchParams: {
    searchTerm?: string;       // Recherche par numéro ou référence
    clientName?: string;      // Recherche par nom de client
    status?: FactureStatus;   // Filtrer par statut
    startDate?: Date;         // Date de début
    endDate?: Date;           // Date de fin
  }): Observable<Facture[]> {
    this.loading.next(true);
    console.log('Recherche de factures avec critères avancés:', searchParams);
    
    // Stratégie de recherche basée sur les critères disponibles
    let observable: Observable<any[]>;
    
    // Si nous avons une période de dates complète, utiliser la recherche par période
    if (searchParams.startDate && searchParams.endDate) {
      console.log('Recherche par période');
      observable = this.rechercherParPeriode(searchParams.startDate, searchParams.endDate);
    }
    // Si nous avons un statut, utiliser la recherche par statut
    else if (searchParams.status) {
      console.log('Recherche par statut:', searchParams.status);
      observable = this.rechercherParStatut(searchParams.status);
    }
    // Si nous avons un nom de client, utiliser la recherche par client
    else if (searchParams.clientName) {
      console.log('Recherche par client:', searchParams.clientName);
      observable = this.rechercherParClient(searchParams.clientName);
    }
    // Si nous avons un terme de recherche général, utiliser la recherche par terme
    else if (searchParams.searchTerm) {
      console.log('Recherche par terme:', searchParams.searchTerm);
      // Comme il n'y a pas d'endpoint spécifique pour la recherche par terme,
      // nous allons récupérer toutes les factures et filtrer côté client
      observable = this.http.get<any[]>(`${this.apiUrl}`).pipe(
        map(factures => {
          const searchTerm = searchParams.searchTerm!.toLowerCase();
          return factures.filter((f: any) => 
            (f.numeroFacture && f.numeroFacture.toLowerCase().includes(searchTerm)) ||
            (f.client && f.client.nom && f.client.nom.toLowerCase().includes(searchTerm))
          );
        })
      );
    }
    // Par défaut, récupérer toutes les factures
    else {
      console.log('Aucun critère spécifique, récupération de toutes les factures');
      observable = this.http.get<any[]>(`${this.apiUrl}`);
    }
    
    return observable.pipe(
      map(factures => factures.map(f => this.mapSpringBootFactureToAngular(f))),
      tap(factures => {
        console.log(`${factures.length} factures trouvées avec les critères de recherche`);
      }),
      catchError(error => {
        console.error('Erreur lors de la recherche de factures:', error);
        return of([]);
      }),
      finalize(() => this.loading.next(false))
    );
  }

  /**
   * Recherche des factures par client
   * @param nomClient Nom du client à rechercher
   */
  private rechercherParClient(nomClient: string): Observable<any[]> {
    console.log(`Appel de l'API pour rechercher les factures du client ${nomClient}`);
    return this.http.get<any[]>(`${this.apiUrl}/client/${nomClient}`).pipe(
      catchError(error => {
        console.error(`Erreur lors de la recherche par client ${nomClient}:`, error);
        // En cas d'erreur, récupérer toutes les factures et filtrer côté client
        return this.getAllFacturesAndFilter(f => 
          f.client && f.client.nom && f.client.nom.toLowerCase().includes(nomClient.toLowerCase())
        );
      })
    );
  }

  /**
   * Recherche des factures par statut
   * @param statut Statut à rechercher (PAID, PENDING, CANCELLED)
   */
  private rechercherParStatut(statut: string): Observable<any[]> {
    console.log(`Appel de l'API pour rechercher les factures avec le statut ${statut}`);
    
    // Convertir le statut au format attendu par le backend (EN_ATTENTE, PAYEE, ANNULEE)
    const backendStatut = this.mapFactureStatusToStatut(statut as FactureStatus);
    
    return this.http.get<any[]>(`${this.apiUrl}/statut/${backendStatut}`).pipe(
      catchError(error => {
        console.error(`Erreur lors de la recherche par statut ${statut}:`, error);
        // En cas d'erreur, récupérer toutes les factures et filtrer côté client
        return this.getAllFacturesAndFilter(f => f.statut === backendStatut);
      })
    );
  }

  /**
   * Recherche des factures par période
   * @param debut Date de début de la période
   * @param fin Date de fin de la période
   */
  private rechercherParPeriode(debut: Date, fin: Date): Observable<any[]> {
    // Formater les dates au format ISO
    const debutStr = debut instanceof Date ? debut.toISOString() : new Date(debut).toISOString();
    const finStr = fin instanceof Date ? fin.toISOString() : new Date(fin).toISOString();
    
    console.log(`Appel de l'API pour rechercher les factures entre ${debutStr} et ${finStr}`);
    
    return this.http.get<any[]>(`${this.apiUrl}/periode?debut=${debutStr}&fin=${finStr}`).pipe(
      catchError(error => {
        console.error(`Erreur lors de la recherche par période:`, error);
        // En cas d'erreur, récupérer toutes les factures et filtrer côté client
        return this.getAllFacturesAndFilter(f => {
          const factureDate = new Date(f.dateCreation);
          return factureDate >= new Date(debut) && factureDate <= new Date(fin);
        });
      })
    );
  }
  
  /**
   * Récupère toutes les factures et applique un filtre côté client
   * Utilisé comme solution de secours en cas d'erreur avec les endpoints de recherche spécifiques
   */
  private getAllFacturesAndFilter(filterFn: (facture: any) => boolean): Observable<any[]> {
    console.log('Utilisation de la solution de secours: récupération de toutes les factures et filtrage côté client');
    return this.http.get<any[]>(`${this.apiUrl}`).pipe(
      map(factures => factures.filter(filterFn))
    );
  }

  /**
   * Met à jour le statut d'une facture depuis la page de détail
   * @param id Identifiant de la facture
   * @param status Nouveau statut de la facture
   * @param commentaire Commentaire optionnel sur le changement de statut
   */
  updateFactureStatusInDetail(id: string, status: FactureStatus, commentaire?: string): Observable<Facture> {
    this.loading.next(true);
    
    // Convertir le statut du format Angular au format attendu par le backend
    const backendStatus = this.mapFactureStatusToStatut(status);
    console.log(`Mise à jour du statut de la facture ${id} vers ${backendStatus} avec commentaire: ${commentaire || 'aucun'}`);
    
    // Créer l'objet de mise à jour avec le statut et le commentaire optionnel
    const updateData: any = {
      statut: backendStatus
    };
    
    // Ajouter le commentaire s'il est fourni
    if (commentaire) {
      updateData.commentaire = commentaire;
    }
    
    // Ajouter la date de paiement si le statut est PAID
    if (status === 'PAID') {
      updateData.datePaiement = new Date().toISOString();
    }
    
    // Afficher l'URL complète et les données envoyées pour le débogage
    console.log('URL de la requête PATCH:', `${this.apiUrl}/${id}/statut`);
    console.log('Données envoyées au backend:', JSON.stringify(updateData, null, 2));
    console.log('En-têtes de la requête:', this.getAuthHeaders());
    
    return this.http.patch<any>(`${this.apiUrl}/${id}/statut`, updateData, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        console.log('Réponse du backend après mise à jour du statut:', JSON.stringify(response, null, 2));
        const updatedFacture = this.mapSpringBootFactureToAngular(response);
        console.log('Facture mise à jour après mappage:', JSON.stringify(updatedFacture, null, 2));
        return updatedFacture;
      }),
      tap(updatedFacture => {
        console.log('Statut de la facture mis à jour avec succès dans la page de détail:', updatedFacture);
        // Notifier les composants que la facture a été mise à jour
        this.factureUpdated.next(updatedFacture);
      }),
      catchError(error => {
        console.error(`Erreur lors de la mise à jour du statut de la facture ${id} dans la page de détail:`, error);
        
        // En cas d'erreur, récupérer la facture à jour
        return this.getFactureById(id).pipe(
          map(facture => {
            // Mettre à jour le statut localement
            facture.status = status;
            return facture;
          }),
          catchError(() => {
            // Si on ne peut pas récupérer la facture, créer une facture factice avec le nouveau statut
            const dummyFacture: Facture = this.createEmptyFacture();
            dummyFacture.id = id;
            dummyFacture.status = status;
            return of(dummyFacture);
          })
        );
      }),
      finalize(() => this.loading.next(false))
    );
  }

  /**
   * Récupère les factures du vendeur connecté
   * @returns Observable des factures du vendeur
   */
  getVendorFactures(): Observable<Facture[]> {
    this.loading.next(true);
    console.log('Récupération des factures du vendeur');
    
    // Utiliser la méthode getFactures standard au lieu d'un endpoint spécifique
    // qui peut ne pas exister dans le backend
    return this.getFactures().pipe(
      tap(factures => {
        console.log(`${factures.length} factures récupérées`);
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des factures du vendeur:', error);
        // Retourner un tableau vide au lieu de propager l'erreur
        return of([]);
      }),
      finalize(() => this.loading.next(false))
    );
  }

  /**
   * Ajoute une ligne de facture
   * @param factureId ID de la facture
   * @param item L'élément à ajouter
   * @returns Observable de la facture mise à jour
   */
  /**
   * Notifie les autres composants qu'une facture a été créée
   * @param facture La facture créée
   */
  notifyFactureCreated(facture: Facture): void {
    if (facture) {
      console.log('Notification de création de facture:', facture);
      this.factureCreated.next(facture);
    }
  }

  ajouterLigneFacture(factureId: string, item: Omit<FactureItem, 'id' | 'factureId' | 'total'>): Observable<Facture> {
    this.loading.next(true);
    // Si le backend n'est pas disponible, utiliser directement les données fictives
    if (!this.backendAvailable) {
      this.showMockDataWarning();
      return this.addMockFactureLine(factureId, item);
    }
    
    const headers = this.getAuthHeaders();
    
    // Extraire les valeurs nécessaires pour l'ajout de ligne
    const idProduit = parseInt(item.productId) || 0;
    const quantite = item.quantity || 1;
    const nomProduit = item.productName || '';
    const prixUnitaire = item.unitPrice || 0;
    
    console.log('Ajout de la ligne de facture:', {
      idFacture: factureId,
      idProduit,
      quantite,
      nomProduit,
      prixUnitaire
    });
    
    // Ajouter la ligne via l'API JSON (méthode principale)
    return this.http.post<any>(`${this.apiUrl}/${factureId}/lignes`, {
      idProduit: idProduit,
      quantite: quantite,
      nomProduit: nomProduit,
      prixUnitaire: prixUnitaire,
      description: item.description || ''
    }, { headers }).pipe(
      switchMap((response: any) => {
        console.log('Réponse du backend après ajout de ligne:', response);
        return this.getFactureById(factureId);
      }),
      tap(updatedFacture => {
        // Notifier les autres composants de la mise à jour
        this.notifyFactureUpdated(updatedFacture);
      }),
      catchError(error => {
        console.error('Erreur lors de l\'ajout de ligne:', error);
        
        // Si l'erreur est due à un problème de connexion ou un statut d'erreur spécifique
        if (error instanceof HttpErrorResponse && 
            (error.status === 0 || error.status === 403 || error.status === 404 || error.status === 500)) {
          console.warn(`Utilisation des données fictives pour l'ajout de ligne à la facture ${factureId} en raison d'une erreur HTTP ${error.status}`);
          this.showMockDataWarning();
          return this.addMockFactureLine(factureId, item);
        }
        
        return throwError(() => new Error(`Échec de l'ajout de ligne: ${error.message}`));
      }),
      finalize(() => this.loading.next(false))
    );
  }
  
  /**
   * Récupère une liste de factures fictives avec filtrage optionnel
   * @param params Paramètres de filtrage optionnels
   * @returns Observable de la liste de factures fictives
   */
  private getMockFactures(params?: {
    status?: FactureStatus;
    startDate?: Date;
    endDate?: Date;
    vendorId?: string;
    searchTerm?: string;
    clientName?: string;
  }): Observable<Facture[]> {
    console.log('Génération de factures fictives avec paramètres:', params);
    
    return this.mockDataService.getMockFactures().pipe(
      map(mockFactures => {
        // Convertir les factures fictives au format Angular
        const factures: Facture[] = mockFactures.map((mockFacture: any) => ({
          id: mockFacture.id,
          number: mockFacture.reference,
          reference: mockFacture.reference,
          clientName: mockFacture.nomClient || `Client Fictif ${mockFacture.id.replace('FACT-', '')}`,
          clientEmail: mockFacture.emailClient || `client${mockFacture.id.replace('FACT-', '')}@example.com`,
          date: this.formatDate(mockFacture.dateEmission),
          dueDate: this.formatDate(mockFacture.dateEcheance),
          status: this.mapStatutToFactureStatus(mockFacture.statut),
          total: mockFacture.montantTotal,
          subtotal: mockFacture.montantTotal * 0.8, // Estimation du sous-total (80% du total)
          tax: mockFacture.montantTotal * 0.2, // Estimation de la TVA (20% du total)
          discount: 0,
          notes: 'Facture fictive générée en mode hors ligne',
          items: []
        }));
        
        // Appliquer les filtres si nécessaire
        let filteredFactures = [...factures];
        
        if (params) {
          // Filtrer par statut
          if (params.status) {
            filteredFactures = filteredFactures.filter(f => f.status === params.status);
          }
          
          // Filtrer par date de début
          if (params.startDate) {
            const startDate = params.startDate instanceof Date ? params.startDate : new Date(params.startDate);
            filteredFactures = filteredFactures.filter(f => {
              const factureDate = f.date instanceof Date ? f.date : new Date(f.date);
              return factureDate >= startDate;
            });
          }
          
          // Filtrer par date de fin
          if (params.endDate) {
            const endDate = params.endDate instanceof Date ? params.endDate : new Date(params.endDate);
            filteredFactures = filteredFactures.filter(f => {
              const factureDate = f.date instanceof Date ? f.date : new Date(f.date);
              return factureDate <= endDate;
            });
          }
          
          // Filtrer par terme de recherche (numéro ou référence)
          if (params.searchTerm) {
            const searchTerm = params.searchTerm.toLowerCase();
            filteredFactures = filteredFactures.filter(f => 
              (f.number && f.number.toLowerCase().includes(searchTerm)) || 
              (f.reference && f.reference.toLowerCase().includes(searchTerm))
            );
          }
          
          // Filtrer par nom de client
          if (params.clientName) {
            const clientName = params.clientName.toLowerCase();
            filteredFactures = filteredFactures.filter(f => 
              f.clientName && f.clientName.toLowerCase().includes(clientName)
            );
          }
        }
        
        console.log(`${filteredFactures.length} factures fictives générées après filtrage`);
        return filteredFactures;
      }),
      catchError(error => {
        console.error('Erreur lors de la génération des factures fictives:', error);
        return of([]);
      })
    );
  }

  /**
   * Récupère une facture fictive par son ID
   * @param id ID de la facture
   * @returns Observable de la facture fictive
   */
  private getMockFactureById(id: string): Observable<Facture> {
    console.log(`Génération d'une facture fictive avec ID: ${id}`);
    
    return this.mockDataService.getMockFactureById(id).pipe(
      switchMap(mockFacture => {
        // Convertir la facture fictive au format Angular
        const facture: Facture = {
          id: mockFacture.id,
          number: mockFacture.reference,
          reference: mockFacture.reference,
          clientName: `Client Fictif ${id.replace('FACT-', '')}`,
          clientEmail: `client${id.replace('FACT-', '')}@example.com`,
          date: this.formatDate(mockFacture.dateEmission),
          dueDate: this.formatDate(mockFacture.dateEcheance),
          status: this.mapStatutToFactureStatus(mockFacture.statut),
          total: mockFacture.montantTotal,
          subtotal: mockFacture.montantTotal * 0.8, // Estimation du sous-total (80% du total)
          tax: mockFacture.montantTotal * 0.2, // Estimation de la TVA (20% du total)
          discount: 0,
          notes: 'Facture fictive générée en mode hors ligne',
          items: []
        };
        
        // Récupérer les lignes de facture fictives
        return this.mockDataService.getMockLignesFacture(id).pipe(
          map(mockLignes => {
            // Convertir les lignes fictives au format FactureItem
            facture.items = mockLignes.map((ligne: any, index: number) => 
              this.mapLigneFactureToFactureItem(ligne, id, index)
            );
            
            // Recalculer les totaux
            facture.subtotal = this.calculateSubtotal(facture.items);
            facture.tax = this.calculateTaxAmount(facture.subtotal, 20); // 20% de TVA
            facture.total = this.calculateTotal(facture.subtotal, facture.tax, facture.discount);
            
            console.log(`Facture fictive générée avec ${facture.items.length} lignes:`, facture);
            return facture;
          })
        );
      }),
      catchError(error => {
        console.error(`Erreur lors de la génération de la facture fictive ${id}:`, error);
        // Créer une facture vide en cas d'erreur
        const emptyFacture = this.createEmptyFacture();
        emptyFacture.id = id;
        return of(emptyFacture);
      })
    );
  }

  /**
   * Ajoute une ligne de facture fictive et retourne la facture mise à jour
   * @param factureId ID de la facture
   * @param item L'élément à ajouter
   * @returns Observable de la facture mise à jour avec la nouvelle ligne
   */
  private addMockFactureLine(factureId: string, item: Omit<FactureItem, 'id' | 'factureId' | 'total'>): Observable<Facture> {
    console.log(`Ajout d'une ligne fictive à la facture ${factureId}`);
    
    // Récupérer d'abord la facture fictive
    return this.mockDataService.getMockFactureById(factureId).pipe(
      map(mockFacture => {
        // Créer une nouvelle ligne
        const newLine = {
          id: `LF-${Date.now()}`,
          produitId: item.productId,
          nomProduit: item.productName,
          quantite: item.quantity,
          prixUnitaire: item.unitPrice,
          montant: item.quantity * item.unitPrice,
          description: item.description || ''
        };
        
        // Ajouter la ligne à la facture
        if (!mockFacture.lignes) {
          mockFacture.lignes = [];
        }
        mockFacture.lignes.push(newLine);
        
        // Recalculer les totaux
        mockFacture.montantTotal = (mockFacture.lignes || []).reduce((sum: number, ligne: any) => sum + (ligne.montant || 0), 0);
        
        // Convertir au format Angular
        return this.mapSpringBootFactureToAngular(mockFacture);
      }),
      catchError(error => {
        console.error(`Erreur lors de l'ajout de ligne fictive à la facture ${factureId}:`, error);
        
        // En dernier recours, créer une facture vide avec la ligne ajoutée
        const emptyFacture = this.createEmptyFacture();
        emptyFacture.id = factureId;
        
        const newItem: FactureItem = {
          id: `LF-${Date.now()}`,
          factureId: factureId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
          description: item.description,
          taxRate: 0,
          tax: 0,
          discount: 0
        };
        
        emptyFacture.items = [newItem];
        emptyFacture.total = newItem.total;
        
        return of(emptyFacture);
      })
    );
  }
}
