import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthService } from '../../auth/services/auth.service';
import { MockDataService } from './mock-data.service';
import { MatSnackBar } from '@angular/material/snack-bar';

// Interfaces
export interface CommandeFournisseur {
  id: string;
  numero: string;
  date: Date;
  statut: StatutCommande;
  montantTotal: number;
  client: {
    id: string;
    nom: string;
    email: string;
    telephone: string;
  };
  lignes: LigneCommandeFournisseur[];
  dateCreation: Date;
  dateModification?: Date;
  dateLivraison?: Date;
  commentaire?: string;
}

export interface ProduitFournisseur {
  id: string;
  reference: string;
  nom: string;
  description: string;
  prix: number;
  categorie: string;
  disponible: boolean;
  stock: number;
  dateCreation: Date;
  dateModification?: Date;
}

export interface LigneCommandeFournisseur {
  id: string;
  produit: {
    id: string;
    nom: string;
    reference: string;
    prix: number;
  };
  quantite: number;
  prixUnitaire: number;
  montantTotal: number;
  statut: StatutLigne;
}

export enum StatutCommande {
  BROUILLON = 'BROUILLON',
  EN_ATTENTE = 'EN_ATTENTE',
  CONFIRMEE = 'CONFIRMEE',
  EN_COURS = 'EN_COURS',
  LIVREE = 'LIVREE',
  ANNULEE = 'ANNULEE'
}

export enum StatutLigne {
  EN_ATTENTE = 'EN_ATTENTE',
  DISPONIBLE = 'DISPONIBLE',
  INDISPONIBLE = 'INDISPONIBLE',
  LIVREE = 'LIVREE'
}

export enum StatutPaiement {
  EN_ATTENTE = 'EN_ATTENTE',
  PARTIEL = 'PARTIEL',
  PAYE = 'PAYE',
  REJETE = 'REJETE',
  ANNULE = 'ANNULE'
}

export interface AvisExpedition {
  id: string;
  numero: string;
  dateExpedition: Date;
  dateLivraisonEstimee: Date;
  transporteur: string;
  numeroSuivi: string;
  commentaires?: string;
  expeditionPartielle: boolean;
  commandeId: string;
  commandeNumero: string;
}

export interface FactureFournisseur {
  id: string;
  numero: string;
  dateFacture: Date;
  dateEcheance: Date;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  commentaires?: string;
  cheminFichier?: string;
  statutPaiement: StatutPaiement;
  datePaiement?: Date;
  commandeId: string;
  commandeNumero: string;
}

export interface DashboardStats {
  commandesEnAttente: number;
  commandesEnCours: number;
  commandesLivrees: number;
  totalCommandes: number;
}

export interface ProfilFournisseur {
  id: string;
  nom: string;
  email: string;
  telephone: string;
  adresse: string;
  description?: string;
  categorieProduits: string[];
  dateInscription: Date;
}

@Injectable({
  providedIn: 'root'
})
export class FournisseurService {
  private apiUrl = 'http://localhost:8088/api/fournisseurs';
  private backendAvailable = true;
  private showedMockDataWarning = false;
  private mockDataEnabled = false; // Désactivation complète des données fictives

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private mockDataService: MockDataService,
    private snackBar: MatSnackBar
  ) {
    // Vérifie la disponibilité du backend au démarrage du service
    this.checkBackendAvailability().subscribe();
  }

  /**
   * Affiche un avertissement si le backend n'est pas disponible
   * Conformément à la mémoire 1f72386f-cedc-4d18-8bc0-90c0cc06d114, les données fictives sont désactivées
   */
  private showMockDataWarning(): void {
    if (!this.backendAvailable && !this.showedMockDataWarning) {
      console.warn('ATTENTION: Le backend n\'est pas disponible. Le service est temporairement indisponible.');
      // Notification à l'utilisateur que le service est indisponible (pas de données fictives)
      this.snackBar.open(
        'Le service de commandes est temporairement indisponible. Veuillez réessayer plus tard.',
        'Fermer',
        { duration: 10000, panelClass: ['warning-snackbar'] }
      );
      this.showedMockDataWarning = true;
    }
  }
  
  /**
   * Obtient les headers d'authentification pour les requêtes HTTP
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Vérifie la disponibilité du backend
   * @returns Observable<boolean> - true si le backend est disponible, false sinon
   */
  checkBackendAvailability(): Observable<boolean> {
    return this.http.get<any>(`${this.apiUrl}/health-check`)
      .pipe(
        map(() => {
          this.backendAvailable = true;
          return true;
        }),
        catchError(error => {
          console.error('Erreur lors de la vérification de la disponibilité du backend:', error);
          // Même si l'erreur est 403, cela signifie que le backend est disponible mais l'accès est refusé
          // Nous considérons donc que le backend est disponible dans ce cas
          if (error instanceof HttpErrorResponse && error.status === 403) {
            this.backendAvailable = true;
            return of(true);
          }
          // Pour les autres erreurs (connexion refusée, timeout, etc.), le backend est considéré comme indisponible
          this.backendAvailable = false;
          return of(false);
        })
      );
  }

  /**
   * Récupère la liste des commandes du fournisseur avec pagination et filtrage
   * Utilise exclusivement les données réelles du backend
   */
  getCommandes(page: number = 0, size: number = 10, statut?: StatutCommande): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
      
    if (statut) {
      params = params.set('statut', statut);
    }
    
    // Utiliser l'API du service achat pour récupérer les commandes réelles
    // Configuration conforme à la mémoire 86decbb4-0afe-4c6c-ace0-2a38f568ef01
    const achatApiUrl = 'http://localhost:8088/api/commandes';
    const fallbackApiUrl = 'http://localhost:8080/api/commandes';
    
    return this.http.get<any>(`${achatApiUrl}/paginees`, { params, headers: this.getAuthHeaders() })
      .pipe(
        map(response => {
          console.log('Commandes récupérées depuis l\'API achat:', response);
          
          // Filtrer les commandes pour ne garder que celles qui sont réelles
          if (response && response.content) {
            response.content = response.content.filter((commande: any) => {
              // Vérifier que la commande a un numéro valide
              const hasValidNumber = commande.numero && commande.numero.trim().length > 0;
              
              // Liste étendue de mots-clés pour identifier les commandes fictives
              const fictiveKeywords = ['test', 'demo', 'fictive', 'exemple', 'sample', 'mock'];
              
              // Vérifier que la commande n'est pas fictive
              const isNotFictive = !fictiveKeywords.some(keyword => 
                commande.numero?.toLowerCase().includes(keyword) || 
                commande.commentaire?.toLowerCase().includes(keyword)
              );
              
              // Vérifier que la commande a un fournisseur valide
              const hasValidSupplier = commande.fournisseur && commande.fournisseur.id;
              
              return hasValidNumber && isNotFictive && hasValidSupplier;
            });
            
            // Adapter la structure des commandes du magasinier pour l'interface fournisseur
            response.content = response.content.map((commande: any) => {
              return {
                ...commande,
                // Créer la structure client à partir du fournisseur pour compatibilité avec l'interface
                client: {
                  id: commande.fournisseur?.id || '',
                  nom: commande.fournisseur?.nom || 'Magasinier',
                  email: commande.fournisseur?.email || '',
                  telephone: commande.fournisseur?.telephone || ''
                },
                // Convertir la date de string à Date si nécessaire
                date: commande.dateCommande ? new Date(commande.dateCommande) : new Date(commande.dateCreation || Date.now()),
                // S'assurer que montantTotal est disponible
                montantTotal: commande.montantTTC || commande.montantTotal || 0,
                // Ajouter des informations supplémentaires pour l'interface fournisseur
                statut: commande.statut || 'EN_ATTENTE',
                reference: commande.numero || '',
                produits: commande.lignes || []
              };
            });
          }
          
          return {
            content: response.content || [],
            totalElements: response.totalElements || 0,
            totalPages: response.totalPages || 0,
            currentPage: response.number || 0
          };
        }),
        catchError(error => {
          console.error('Erreur lors de la récupération des commandes:', error);
          
          // Essayer l'URL de secours si la principale échoue
          if (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 404)) {
            console.warn('Tentative de connexion à l\'URL de secours:', fallbackApiUrl);
            
            return this.http.get<any>(`${fallbackApiUrl}/paginees`, { params, headers: this.getAuthHeaders() })
              .pipe(
                map(response => {
                  console.log('Commandes récupérées depuis l\'API de secours:', response);
                  
                  // Même logique de filtrage et d'adaptation que pour l'URL principale
                  if (response && response.content) {
                    response.content = response.content.filter((commande: any) => {
                      const hasValidNumber = commande.numero && commande.numero.trim().length > 0;
                      const fictiveKeywords = ['test', 'demo', 'fictive', 'exemple', 'sample', 'mock'];
                      const isNotFictive = !fictiveKeywords.some(keyword => 
                        commande.numero?.toLowerCase().includes(keyword) || 
                        commande.commentaire?.toLowerCase().includes(keyword)
                      );
                      const hasValidSupplier = commande.fournisseur && commande.fournisseur.id;
                      
                      return hasValidNumber && isNotFictive && hasValidSupplier;
                    });
                    
                    // Adapter la structure des commandes
                    response.content = response.content.map((commande: any) => ({
                      ...commande,
                      client: {
                        id: commande.fournisseur?.id || '',
                        nom: commande.fournisseur?.nom || 'Magasinier',
                        email: commande.fournisseur?.email || '',
                        telephone: commande.fournisseur?.telephone || ''
                      },
                      date: commande.dateCommande ? new Date(commande.dateCommande) : new Date(commande.dateCreation || Date.now()),
                      montantTotal: commande.montantTTC || commande.montantTotal || 0,
                      statut: commande.statut || 'EN_ATTENTE',
                      reference: commande.numero || '',
                      produits: commande.lignes || []
                    }));
                  }
                  
                  return {
                    content: response.content || [],
                    totalElements: response.totalElements || 0,
                    totalPages: response.totalPages || 0,
                    currentPage: response.number || 0
                  };
                }),
                catchError(fallbackError => {
                  console.error('Erreur lors de la récupération des commandes depuis l\'URL de secours:', fallbackError);
                  this.backendAvailable = false;
                  // Ne pas utiliser de données fictives, renvoyer une erreur explicite
                  return throwError(() => new Error('Impossible de charger les commandes. Le service est actuellement indisponible.'));
                })
              );
          }
          
          // Pour toute autre erreur, renvoyer un message d'erreur explicite
          return throwError(() => new Error(`Impossible de charger les commandes: ${error.message || 'Erreur inconnue'}`));
        })
      );
  }

  /**
   * Met à jour le statut d'une commande
   */
  updateCommandeStatut(commandeId: string, statut: StatutCommande): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    return this.http.patch<any>(`${this.apiUrl}/commandes/${commandeId}/statut`, { statut })
      .pipe(
        catchError(error => {
          console.error(`Erreur lors de la mise à jour du statut de la commande ${commandeId}:`, error);
          return throwError(() => new Error('Impossible de mettre à jour le statut de la commande.'));
        })
      );
  }

  /**
   * Met à jour le statut d'une ligne de commande
   */
  updateLigneStatut(commandeId: string, ligneId: string, statut: StatutLigne): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    return this.http.patch<any>(`${this.apiUrl}/commandes/${commandeId}/lignes/${ligneId}/statut`, { statut })
      .pipe(
        catchError(error => {
          console.error(`Erreur lors de la mise à jour du statut de la ligne ${ligneId}:`, error);
          return throwError(() => new Error('Impossible de mettre à jour le statut de la ligne.'));
        })
      );
  }

  /**
   * Récupère un avis d'expédition pour une commande
   */
  getAvisExpedition(commandeId: string): Observable<AvisExpedition> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    return this.http.get<any>(`${this.apiUrl}/commandes/${commandeId}/avis-expedition`)
      .pipe(
        map(response => ({
          id: response.id,
          numero: response.numero,
          dateExpedition: new Date(response.dateExpedition),
          dateLivraisonEstimee: new Date(response.dateLivraisonEstimee),
          transporteur: response.transporteur,
          numeroSuivi: response.numeroSuivi,
          commentaires: response.commentaires,
          expeditionPartielle: response.expeditionPartielle,
          commandeId: response.commandeId,
          commandeNumero: response.commandeNumero
        })),
        catchError(error => {
          // Si l'erreur est 404, c'est normal (pas d'avis pour cette commande)
          if (error.status === 404) {
            return throwError(() => new Error('Aucun avis d\'expédition trouvé pour cette commande.'));
          }
          console.error(`Erreur lors de la récupération de l'avis d'expédition:`, error);
          return throwError(() => new Error('Impossible de charger l\'avis d\'expédition.'));
        })
      );
  }

  /**
   * Crée un nouvel avis d'expédition pour une commande
   */
  createAvisExpedition(commandeId: string, avisData: any): Observable<AvisExpedition> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    return this.http.post<any>(`${this.apiUrl}/commandes/${commandeId}/avis-expedition`, avisData)
      .pipe(
        map(response => ({
          id: response.id,
          numero: response.numero,
          dateExpedition: new Date(response.dateExpedition),
          dateLivraisonEstimee: new Date(response.dateLivraisonEstimee),
          transporteur: response.transporteur,
          numeroSuivi: response.numeroSuivi,
          commentaires: response.commentaires,
          expeditionPartielle: response.expeditionPartielle,
          commandeId: response.commandeId,
          commandeNumero: response.commandeNumero
        })),
        catchError(error => {
          console.error(`Erreur lors de la création de l'avis d'expédition:`, error);
          return throwError(() => new Error('Impossible de créer l\'avis d\'expédition.'));
        })
      );
  }

  /**
   * Met à jour un avis d'expédition existant
   */
  updateAvisExpedition(avisId: string, avisData: any): Observable<AvisExpedition> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    return this.http.put<any>(`${this.apiUrl}/avis-expedition/${avisId}`, avisData)
      .pipe(
        map(response => ({
          id: response.id,
          numero: response.numero,
          dateExpedition: new Date(response.dateExpedition),
          dateLivraisonEstimee: new Date(response.dateLivraisonEstimee),
          transporteur: response.transporteur,
          numeroSuivi: response.numeroSuivi,
          commentaires: response.commentaires,
          expeditionPartielle: response.expeditionPartielle,
          commandeId: response.commandeId,
          commandeNumero: response.commandeNumero
        })),
        catchError(error => {
          console.error(`Erreur lors de la mise à jour de l'avis d'expédition:`, error);
          return throwError(() => new Error('Impossible de mettre à jour l\'avis d\'expédition.'));
        })
      );
  }

  /**
   * Récupère les statistiques pour le tableau de bord du fournisseur
   */
  /**
   * Récupère le profil du fournisseur connecté
   */
  getProfilFournisseur(): Observable<ProfilFournisseur> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    // Si le backend n'est pas disponible, utiliser les données fictives
    if (!this.backendAvailable) {
      this.showMockDataWarning();
      return this.mockDataService.getMockProfilFournisseur();
    }
    
    return this.http.get<ProfilFournisseur>(`${this.apiUrl}/profil`)
      .pipe(
        map(response => ({
          id: response.id,
          nom: response.nom,
          email: response.email,
          telephone: response.telephone,
          adresse: response.adresse,
          description: response.description,
          categorieProduits: response.categorieProduits || [],
          dateInscription: new Date(response.dateInscription)
        })),
        catchError(error => {
          if (error.status === 404) {
            return throwError(() => new Error('Profil fournisseur non trouvé.'));
          }
          if (error.status === 401 || error.status === 403) {
            console.warn('Utilisation des données fictives suite à une erreur d\'authentification');
            this.backendAvailable = false;
            this.showMockDataWarning();
            return this.mockDataService.getMockProfilFournisseur();
          }
          if (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 404)) {
            console.warn('Utilisation des données fictives suite à une erreur de connexion au backend');
            this.backendAvailable = false;
            this.showMockDataWarning();
            return this.mockDataService.getMockProfilFournisseur();
          }
          console.error('Erreur lors de la récupération du profil:', error);
          return throwError(() => new Error('Impossible de charger le profil fournisseur.'));
        })
      );
  }

  /**
   * Met à jour le profil du fournisseur connecté
   */
  updateProfilFournisseur(profilData: Partial<ProfilFournisseur>): Observable<ProfilFournisseur> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    return this.http.put<ProfilFournisseur>(`${this.apiUrl}/profil`, profilData)
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la mise à jour du profil fournisseur:', error);
          return throwError(() => new Error('Impossible de mettre à jour les informations du profil.'));
        })
      );
  }

  getDashboardStats(): Observable<DashboardStats> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    // Si le backend n'est pas disponible, utiliser les données fictives
    if (!this.backendAvailable) {
      this.showMockDataWarning();
      return this.mockDataService.getMockDashboardStats() as Observable<DashboardStats>;
    }
    
    return this.http.get<any>(`${this.apiUrl}/dashboard/stats`)
      .pipe(
        map(response => ({
          commandesEnAttente: response.commandesEnAttente,
          commandesEnCours: response.commandesEnCours,
          commandesLivrees: response.commandesLivrees,
          totalCommandes: response.totalCommandes
        })),
        catchError(error => {
          console.error('Erreur lors de la récupération des statistiques:', error);
          // Si l'erreur est due à un problème de connexion au backend, utiliser les données fictives
          if (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 404 || error.status === 403)) {
            console.warn('Utilisation des données fictives suite à une erreur de connexion au backend');
            this.backendAvailable = false;
            this.showMockDataWarning();
            return this.mockDataService.getMockDashboardStats() as Observable<DashboardStats>;
          }
          return throwError(() => new Error('Impossible de charger les statistiques du tableau de bord.'));
        })
      );
  }

  /**
   * Récupère les détails d'une commande spécifique
   */
  getCommandeById(id: string): Observable<CommandeFournisseur> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé.'));
    }

    // Si le backend n'est pas disponible, utiliser les données fictives
    if (!this.backendAvailable) {
      this.showMockDataWarning();
      return this.mockDataService.getMockCommandeById(id) as Observable<CommandeFournisseur>;
    }

    return this.http.get<CommandeFournisseur>(`${this.apiUrl}/commandes/${id}`)
      .pipe(
        catchError(error => {
          console.error(`Erreur lors de la récupération de la commande ${id}:`, error);
          // Si l'erreur est due à un problème de connexion au backend, utiliser les données fictives
          if (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 404 || error.status === 403)) {
            console.warn('Utilisation des données fictives suite à une erreur de connexion au backend');
            this.backendAvailable = false;
            this.showMockDataWarning();
            return this.mockDataService.getMockCommandeById(id) as Observable<CommandeFournisseur>;
          }
          return throwError(() => new Error('Impossible de charger les détails de la commande.'));
        })
      );
  }

  /**
   * Récupère les factures du fournisseur avec pagination et filtrage
   * @param page Numéro de page (commence à 0)
   * @param size Nombre d'éléments par page
   * @param statut Statut optionnel des factures à filtrer
   */
  getFactures(page: number = 0, size: number = 10, statut?: string): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    // Si le backend n'est pas disponible, utiliser les données fictives
    if (!this.backendAvailable) {
      this.showMockDataWarning();
      return this.mockDataService.getMockFacturesWithPagination(page, size, statut);
    }
    
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    // Ajout du statut s'il est fourni
    if (statut) {
      params = params.set('statut', statut);
    }
    
    return this.http.get<any>(`${this.apiUrl}/factures`, { params })
      .pipe(
        map(response => ({
          content: response.content,
          totalElements: response.totalElements,
          totalPages: response.totalPages,
          currentPage: response.number
        })),
        catchError(error => {
          console.error('Erreur lors de la récupération des factures:', error);
          // Si l'erreur est due à un problème de connexion au backend, utiliser les données fictives
          if (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 404 || error.status === 403)) {
            console.warn('Utilisation des données fictives suite à une erreur de connexion au backend');
            this.backendAvailable = false;
            this.showMockDataWarning();
            return this.mockDataService.getMockFacturesWithPagination(page, size, statut);
          }
          return throwError(() => new Error('Impossible de charger les factures.'));
        })
      );
  }

  /**
   * Recherche des factures par critères
   */
  searchFactures(query: string, page: number = 0, size: number = 10): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    let params = new HttpParams()
      .set('query', query)
      .set('page', page.toString())
      .set('size', size.toString());
    
    return this.http.get<any>(`${this.apiUrl}/factures/search`, { params })
      .pipe(
        map(response => ({
          content: response.content,
          totalElements: response.totalElements,
          totalPages: response.totalPages,
          currentPage: response.number
        })),
        catchError(error => {
          console.error('Erreur lors de la recherche des factures:', error);
          return throwError(() => new Error('Impossible de rechercher les factures.'));
        })
      );
  }

  /**
   * Récupère les détails d'une facture spécifique
   */
  getFactureById(id: string): Observable<FactureFournisseur> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    // Si le backend n'est pas disponible, utiliser les données fictives
    if (!this.backendAvailable) {
      this.showMockDataWarning();
      return this.mockDataService.getMockFactureById(id) as Observable<FactureFournisseur>;
    }
    
    return this.http.get<FactureFournisseur>(`${this.apiUrl}/factures/${id}`)
      .pipe(
        catchError(error => {
          console.error(`Erreur lors de la récupération de la facture ${id}:`, error);
          // Si l'erreur est due à un problème de connexion au backend, utiliser les données fictives
          if (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 404 || error.status === 403)) {
            console.warn('Utilisation des données fictives suite à une erreur de connexion au backend');
            this.backendAvailable = false;
            this.showMockDataWarning();
            return this.mockDataService.getMockFactureById(id) as Observable<FactureFournisseur>;
          }
          return throwError(() => new Error('Impossible de charger les détails de la facture.'));
        })
      );
  }

  /**
   * Récupère une facture par l'ID de la commande associée
   */
  getFactureByCommandeId(commandeId: string): Observable<FactureFournisseur> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    // Si le backend n'est pas disponible, utiliser les données fictives
    if (!this.backendAvailable) {
      this.showMockDataWarning();
      // Générer une facture fictive avec l'ID de commande spécifié
      const mockFacture = this.mockDataService.getMockFactureById(`FACT-${commandeId.replace('CMD-', '')}`) as Observable<FactureFournisseur>;
      return mockFacture;
    }
    
    return this.http.get<FactureFournisseur>(`${this.apiUrl}/factures/commande/${commandeId}`)
      .pipe(
        catchError(error => {
          console.error(`Erreur lors de la récupération de la facture pour la commande ${commandeId}:`, error);
          // Si l'erreur est due à un problème de connexion au backend, utiliser les données fictives
          if (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 404 || error.status === 403)) {
            console.warn('Utilisation des données fictives suite à une erreur de connexion au backend');
            this.backendAvailable = false;
            this.showMockDataWarning();
            // Générer une facture fictive avec l'ID de commande spécifié
            const mockFacture = this.mockDataService.getMockFactureById(`FACT-${commandeId.replace('CMD-', '')}`) as Observable<FactureFournisseur>;
            return mockFacture;
          }
          return throwError(() => new Error('Impossible de charger la facture associée à cette commande.'));
        })
      );
  }

  /**
   * Crée une nouvelle facture pour une commande
   */
  createFacture(commandeId: string, factureData: any): Observable<FactureFournisseur> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    return this.http.post<FactureFournisseur>(`${this.apiUrl}/factures/commande/${commandeId}`, factureData)
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la création de la facture:', error);
          return throwError(() => new Error('Impossible de créer la facture.'));
        })
      );
  }

  /**
   * Met à jour une facture existante
   */
  updateFacture(factureId: string, factureData: any): Observable<FactureFournisseur> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    return this.http.put<FactureFournisseur>(`${this.apiUrl}/factures/${factureId}`, factureData)
      .pipe(
        catchError(error => {
          console.error(`Erreur lors de la mise à jour de la facture ${factureId}:`, error);
          return throwError(() => new Error('Impossible de mettre à jour la facture.'));
        })
      );
  }

  /**
   * Récupère les paiements d'une facture
   */
  getPaiementsByFacture(factureId: string): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    return this.http.get<any>(`${this.apiUrl}/paiements/facture/${factureId}`)
      .pipe(
        catchError(error => {
          console.error(`Erreur lors de la récupération des paiements pour la facture ${factureId}:`, error);
          return throwError(() => new Error('Impossible de charger les paiements.'));
        })
      );
  }

  /**
   * Récupère les paiements par période
   */
  getPaiementsByPeriode(dateDebut: string, dateFin: string, page: number = 0, size: number = 10): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    let params = new HttpParams()
      .set('dateDebut', dateDebut)
      .set('dateFin', dateFin)
      .set('page', page.toString())
      .set('size', size.toString());
    
    return this.http.get<any>(`${this.apiUrl}/paiements/periode`, { params })
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la récupération des paiements par période:', error);
          return throwError(() => new Error('Impossible de charger les paiements pour cette période.'));
        })
      );
  }

  /**
   * Récupère tous les paiements avec pagination et filtrage optionnel par statut
   * @param page Numéro de page (commence à 0)
   * @param size Nombre d'éléments par page
   * @param statut Statut optionnel des paiements à filtrer
   */
  getPaiements(page: number = 0, size: number = 10, statut?: string): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    // Si le backend n'est pas disponible, utiliser les données fictives
    if (!this.backendAvailable) {
      this.showMockDataWarning();
      return this.mockDataService.getMockPaiements(page, size, statut);
    }
    
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    // Ajout du statut s'il est fourni
    if (statut) {
      params = params.set('statut', statut);
    }
    
    return this.http.get<any>(`${this.apiUrl}/paiements`, { params })
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la récupération des paiements:', error);
          
          // Si l'erreur est due à un problème de connexion au backend, utiliser les données fictives
          if (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 404 || error.status === 403 || error.status === 500)) {
            console.warn('Utilisation des données fictives suite à une erreur de connexion au backend');
            this.backendAvailable = false;
            this.showMockDataWarning();
            return this.mockDataService.getMockPaiements(page, size, statut);
          }
          
          return throwError(() => new Error('Impossible de charger les paiements.'));
        })
      );
  }

  /**
   * Crée un nouveau paiement pour une facture
   */
  createPaiement(factureId: string, paiementData: any): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    return this.http.post<any>(`${this.apiUrl}/paiements/facture/${factureId}`, paiementData)
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la création du paiement:', error);
          return throwError(() => new Error('Impossible de créer le paiement.'));
        })
      );
  }

  /**
   * Récupère la liste des produits du fournisseur avec pagination et filtrage
   * @param page Numéro de page (commence à 0)
   * @param size Nombre d'éléments par page
   * @param filters Filtres optionnels (catégorie, disponibilité, etc.)
   */
  getProduits(page: number = 0, size: number = 10, filters?: any): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    // Si le backend n'est pas disponible, utiliser les données fictives
    if (!this.backendAvailable) {
      this.showMockDataWarning();
      return this.mockDataService.getMockProduits(page, size, filters);
    }
    
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    // Ajout des filtres s'ils sont fournis
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
          params = params.set(key, filters[key]);
        }
      });
    }
    
    return this.http.get<any>(`${this.apiUrl}/produits`, { params })
      .pipe(
        map(response => ({
          content: response.content,
          totalElements: response.totalElements,
          totalPages: response.totalPages,
          currentPage: response.number
        })),
        catchError(error => {
          console.error('Erreur lors de la récupération des produits:', error);
          // Si l'erreur est due à un problème de connexion au backend, utiliser les données fictives
          if (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 404 || error.status === 403)) {
            console.warn('Utilisation des données fictives suite à une erreur de connexion au backend');
            this.backendAvailable = false;
            this.showMockDataWarning();
            return this.mockDataService.getMockProduits(page, size, filters);
          }
          return throwError(() => new Error('Impossible de charger les produits.'));
        })
      );
  }
  /**
   * Récupère les catégories de produits disponibles
   */
  getCategories(): Observable<string[]> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    // Si le backend n'est pas disponible, utiliser les données fictives
    if (!this.backendAvailable) {
      this.showMockDataWarning();
      return this.mockDataService.getMockCategories();
    }
    
    return this.http.get<string[]>(`${this.apiUrl}/produits/categories`)
      .pipe(
        catchError(error => {
          console.error('Erreur lors du chargement des catégories:', error);
          // Si l'erreur est due à un problème de connexion au backend, utiliser les données fictives
          if (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 404 || error.status === 403)) {
            console.warn('Utilisation des données fictives suite à une erreur de connexion au backend');
            this.backendAvailable = false;
            this.showMockDataWarning();
            return this.mockDataService.getMockCategories();
          }
          return throwError(() => new Error('Impossible de charger les catégories de produits.'));
        })
      );
  }

  /**
   * Crée un nouveau produit
   */
  createProduit(produitData: any): Observable<ProduitFournisseur> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    // Si le backend n'est pas disponible, utiliser les données fictives
    if (!this.backendAvailable) {
      this.showMockDataWarning();
      return this.mockDataService.createMockProduit(produitData) as Observable<ProduitFournisseur>;
    }
    
    return this.http.post<ProduitFournisseur>(`${this.apiUrl}/produits`, produitData)
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la création du produit:', error);
          // Si l'erreur est due à un problème de connexion au backend, utiliser les données fictives
          if (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 404 || error.status === 403)) {
            console.warn('Utilisation des données fictives suite à une erreur de connexion au backend');
            this.backendAvailable = false;
            this.showMockDataWarning();
            return this.mockDataService.createMockProduit(produitData) as Observable<ProduitFournisseur>;
          }
          return throwError(() => new Error('Impossible de créer le produit.'));
        })
      );
  }

  /**
   * Met à jour un produit existant
   */
  updateProduit(id: string, produitData: any): Observable<ProduitFournisseur> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    // Si le backend n'est pas disponible, utiliser les données fictives
    if (!this.backendAvailable) {
      this.showMockDataWarning();
      return this.mockDataService.updateMockProduit(id, produitData) as Observable<ProduitFournisseur>;
    }
    
    return this.http.put<ProduitFournisseur>(`${this.apiUrl}/produits/${id}`, produitData)
      .pipe(
        catchError(error => {
          console.error(`Erreur lors de la mise à jour du produit ${id}:`, error);
          // Si l'erreur est due à un problème de connexion au backend, utiliser les données fictives
          if (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 404 || error.status === 403)) {
            console.warn('Utilisation des données fictives suite à une erreur de connexion au backend');
            this.backendAvailable = false;
            this.showMockDataWarning();
            return this.mockDataService.updateMockProduit(id, produitData) as Observable<ProduitFournisseur>;
          }
          return throwError(() => new Error('Impossible de mettre à jour le produit.'));
        })
      );
  }

  /**
   * Met à jour la disponibilité d'un produit
   */
  updateProduitDisponibilite(id: string, disponible: boolean): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    // Si le backend n'est pas disponible, utiliser les données fictives
    if (!this.backendAvailable) {
      this.showMockDataWarning();
      return this.mockDataService.updateMockProduitDisponibilite(id, disponible);
    }
    
    return this.http.patch<any>(`${this.apiUrl}/produits/${id}/disponibilite`, { disponible })
      .pipe(
        catchError(error => {
          console.error(`Erreur lors de la mise à jour de la disponibilité du produit ${id}:`, error);
          // Si l'erreur est due à un problème de connexion au backend, utiliser les données fictives
          if (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 404 || error.status === 403)) {
            console.warn('Utilisation des données fictives suite à une erreur de connexion au backend');
            this.backendAvailable = false;
            this.showMockDataWarning();
            return this.mockDataService.updateMockProduitDisponibilite(id, disponible);
          }
          return throwError(() => new Error('Impossible de mettre à jour la disponibilité du produit.'));
        })
      );
  }

  /**
   * Supprime un produit du fournisseur
   * Conformément à la mémoire 1f72386f-cedc-4d18-8bc0-90c0cc06d114, les données fictives sont désactivées
   */
  deleteProduit(id: string): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    // Si le backend n'est pas disponible, afficher un avertissement
    // et retourner une erreur (pas de données fictives)
    if (!this.backendAvailable) {
      this.showMockDataWarning();
      return throwError(() => new Error('Service temporairement indisponible. Veuillez réessayer plus tard.'));
    }
    
    // URL principale conforme à la mémoire 86decbb4-0afe-4c6c-ace0-2a38f568ef01
    const mainApiUrl = 'http://localhost:8088/api/fournisseurs';
    const fallbackApiUrl = 'http://localhost:8080/api/fournisseurs';
    
    return this.http.delete<any>(`${mainApiUrl}/produits/${id}`, { headers: this.getAuthHeaders() })
      .pipe(
        tap(() => {
          console.log(`Produit ${id} supprimé avec succès`);
          this.snackBar.open('Le produit a été supprimé avec succès', 'Fermer', { duration: 5000, panelClass: ['success-snackbar'] });
        }),
        catchError(error => {
          console.error(`Erreur lors de la suppression du produit ${id}:`, error);
          
          // Essayer l'URL de secours si la principale échoue
          if (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 404)) {
            console.warn('Tentative de connexion à l\'URL de secours pour la suppression du produit');
            
            return this.http.delete<any>(`${fallbackApiUrl}/produits/${id}`, { headers: this.getAuthHeaders() })
              .pipe(
                tap(() => {
                  console.log(`Produit ${id} supprimé avec succès via l'URL de secours`);
                  this.snackBar.open('Le produit a été supprimé avec succès', 'Fermer', { duration: 5000, panelClass: ['success-snackbar'] });
                }),
                catchError(fallbackError => {
                  console.error(`Erreur lors de la suppression du produit ${id} via l'URL de secours:`, fallbackError);
                  this.backendAvailable = false;
                  this.snackBar.open('Impossible de supprimer le produit. Le service est actuellement indisponible.', 'Fermer', { duration: 5000, panelClass: ['error-snackbar'] });
                  return throwError(() => new Error('Service temporairement indisponible. Veuillez réessayer plus tard.'));
                })
              );
          }
          
          // Pour les erreurs d'autorisation
          if (error.status === 403) {
            this.snackBar.open('Vous n\'avez pas les droits nécessaires pour supprimer ce produit', 'Fermer', { duration: 5000, panelClass: ['error-snackbar'] });
            return throwError(() => new Error('Accès refusé. Vous n\'avez pas les droits nécessaires.'));
          }
          
          // Pour toute autre erreur
          this.snackBar.open('Impossible de supprimer le produit', 'Fermer', { duration: 5000, panelClass: ['error-snackbar'] });
          return throwError(() => new Error(`Impossible de supprimer le produit: ${error.message || 'Erreur inconnue'}`));
        })
      );
  }
}
