import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthService } from '../../auth/services/auth.service';
import { MockDataService } from './mock-data.service';

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
  private apiUrl = 'http://localhost:8081/api/fournisseur';
  private backendAvailable = true;
  private showedMockDataWarning = false;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private mockDataService: MockDataService
  ) {
    // Vérifie la disponibilité du backend au démarrage du service
    this.checkBackendAvailability().subscribe();
  }

  /**
   * Affiche un avertissement si les données fictives sont utilisées
   */
  private showMockDataWarning(): void {
    if (!this.backendAvailable && !this.showedMockDataWarning) {
      console.warn('ATTENTION: Le backend n\'est pas disponible. Des données fictives sont affichées.');
      // Ici, vous pourriez ajouter un code pour afficher une notification à l'utilisateur
      this.showedMockDataWarning = true;
    }
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
   */
  getCommandes(page: number = 0, size: number = 10, statut?: StatutCommande): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    // Si le backend n'est pas disponible, utiliser les données fictives
    if (!this.backendAvailable) {
      this.showMockDataWarning();
      return this.mockDataService.getMockCommandes(page, size, statut as string);
    }
    
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
      
    if (statut) {
      params = params.set('statut', statut);
    }
    
    return this.http.get<any>(`${this.apiUrl}/commandes`, { params })
      .pipe(
        map(response => ({
          content: response.content,
          totalElements: response.totalElements,
          totalPages: response.totalPages,
          currentPage: response.number
        })),
        catchError(error => {
          console.error('Erreur lors de la récupération des commandes:', error);
          // Si l'erreur est due à un problème de connexion au backend, utiliser les données fictives
          if (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 404 || error.status === 403)) {
            console.warn('Utilisation des données fictives suite à une erreur de connexion au backend');
            this.backendAvailable = false;
            this.showMockDataWarning();
            return this.mockDataService.getMockCommandes(page, size, statut as string);
          }
          return throwError(() => new Error('Impossible de charger les commandes.'));
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
      return this.mockDataService.getMockFactures(page, size, statut);
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
            return this.mockDataService.getMockFactures(page, size, statut);
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
   */
  deleteProduit(id: string): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    // Si le backend n'est pas disponible, utiliser les données fictives
    if (!this.backendAvailable) {
      this.showMockDataWarning();
      return this.mockDataService.deleteMockProduit(id);
    }
    
    return this.http.delete<any>(`${this.apiUrl}/produits/${id}`)
      .pipe(
        catchError(error => {
          console.error(`Erreur lors de la suppression du produit ${id}:`, error);
          // Si l'erreur est due à un problème de connexion au backend, utiliser les données fictives
          if (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 404 || error.status === 403)) {
            console.warn('Utilisation des données fictives suite à une erreur de connexion au backend');
            this.backendAvailable = false;
            this.showMockDataWarning();
            return this.mockDataService.deleteMockProduit(id);
          }
          return throwError(() => new Error('Impossible de supprimer le produit.'));
        })
      );
  }
}
