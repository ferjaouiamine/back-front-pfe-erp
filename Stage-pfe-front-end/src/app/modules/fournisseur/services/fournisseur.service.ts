import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../../auth/services/auth.service';

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

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  /**
   * Récupère les détails d'une commande spécifique
   */
  getCommandeById(id: string): Observable<CommandeFournisseur> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    return this.http.get<any>(`${this.apiUrl}/commandes/${id}`)
      .pipe(
        map(response => ({
          id: response.id,
          numero: response.numero,
          date: new Date(response.date),
          statut: response.statut as StatutCommande,
          montantTotal: response.montantTotal,
          client: response.client,
          lignes: response.lignes.map((ligne: any) => ({
            id: ligne.id,
            produit: ligne.produit,
            quantite: ligne.quantite,
            prixUnitaire: ligne.prixUnitaire,
            montantTotal: ligne.montantTotal,
            statut: ligne.statut as StatutLigne
          })),
          dateCreation: new Date(response.dateCreation),
          dateModification: response.dateModification ? new Date(response.dateModification) : undefined,
          dateLivraison: response.dateLivraison ? new Date(response.dateLivraison) : undefined,
          commentaire: response.commentaire
        })),
        catchError(error => {
          console.error(`Erreur lors de la récupération de la commande ${id}:`, error);
          return throwError(() => new Error('Impossible de récupérer les détails de la commande.'));
        })
      );
  }

  /**
   * Récupère la liste des factures du fournisseur
   */
  getFactures(page: number = 0, size: number = 10, statut?: StatutPaiement): Observable<any> {
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
    
    return this.http.get<any>(`${this.apiUrl}/factures`, { params })
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la récupération des factures:', error);
          return throwError(() => new Error('Impossible de charger les factures.'));
        })
      );
  }

  /**
   * Recherche des factures par mot-clé
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
        catchError(error => {
          console.error('Erreur lors de la recherche des factures:', error);
          return throwError(() => new Error('Impossible de rechercher les factures.'));
        })
      );
  }

  /**
   * Récupère une facture par son ID
   */
  getFactureById(factureId: string): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    return this.http.get<any>(`${this.apiUrl}/factures/${factureId}`)
      .pipe(
        map(response => ({
          id: response.id,
          numero: response.numero,
          dateFacture: new Date(response.dateFacture),
          dateEcheance: new Date(response.dateEcheance),
          montantHT: response.montantHT,
          montantTVA: response.montantTVA,
          montantTTC: response.montantTTC,
          commentaires: response.commentaires,
          cheminFichier: response.cheminFichier,
          statutPaiement: response.statutPaiement,
          datePaiement: response.datePaiement ? new Date(response.datePaiement) : undefined,
          commandeId: response.commandeId,
          commandeNumero: response.commandeNumero
        })),
        catchError(error => {
          console.error(`Erreur lors de la récupération de la facture ${factureId}:`, error);
          return throwError(() => new Error('Impossible de récupérer la facture.'));
        })
      );
  }

  /**
   * Crée une nouvelle facture pour une commande
   */
  createFacture(commandeId: string, factureData: any): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    // Préparer les données à envoyer
    const data: any = { ...factureData };
    if (data.dateFacture instanceof Date) {
      data.dateFacture = data.dateFacture.toISOString().split('T')[0]; // Format YYYY-MM-DD
    }
    if (data.dateEcheance instanceof Date) {
      data.dateEcheance = data.dateEcheance.toISOString().split('T')[0]; // Format YYYY-MM-DD
    }
    
    return this.http.post<any>(`${this.apiUrl}/commandes/${commandeId}/factures`, data)
      .pipe(
        catchError(error => {
          console.error(`Erreur lors de la création de la facture pour la commande ${commandeId}:`, error);
          return throwError(() => new Error('Impossible de créer la facture.'));
        })
      );
  }

  /**
   * Met à jour une facture existante
   */
  updateFacture(factureId: string, factureData: any): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    // Préparer les données à envoyer
    const data: any = { ...factureData };
    if (data.dateFacture instanceof Date) {
      data.dateFacture = data.dateFacture.toISOString().split('T')[0]; // Format YYYY-MM-DD
    }
    if (data.dateEcheance instanceof Date) {
      data.dateEcheance = data.dateEcheance.toISOString().split('T')[0]; // Format YYYY-MM-DD
    }
    
    return this.http.put<any>(`${this.apiUrl}/factures/${factureId}`, data)
      .pipe(
        catchError(error => {
          console.error(`Erreur lors de la mise à jour de la facture ${factureId}:`, error);
          return throwError(() => new Error('Impossible de mettre à jour la facture.'));
        })
      );
  }

  /**
   * Récupère la liste des paiements avec pagination et filtrage
   */
  getPaiements(page: number = 0, size: number = 10, statut?: string): Observable<any> {
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
    
    return this.http.get<any>(`${this.apiUrl}/paiements`, { params })
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la récupération des paiements:', error);
          return throwError(() => new Error('Impossible de charger les paiements.'));
        })
      );
  }
  
  /**
   * Récupère les paiements associés à une facture spécifique
   */
  getPaiementsByFacture(factureId: string): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    return this.http.get<any>(`${this.apiUrl}/factures/${factureId}/paiements`)
      .pipe(
        catchError(error => {
          console.error(`Erreur lors de la récupération des paiements pour la facture ${factureId}:`, error);
          return throwError(() => new Error('Impossible de charger les paiements pour cette facture.'));
        })
      );
  }
  
  /**
   * Récupère les paiements pour une période spécifique
   */
  getPaiementsByPeriode(debut: string, fin: string, page: number = 0, size: number = 10): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    let params = new HttpParams()
      .set('debut', debut)
      .set('fin', fin)
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
   * Crée un nouveau paiement pour une facture
   */
  createPaiement(factureId: string, paiementData: any): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    // Préparer les données à envoyer
    const data: any = { ...paiementData };
    if (data.datePaiement instanceof Date) {
      data.datePaiement = data.datePaiement.toISOString().split('T')[0]; // Format YYYY-MM-DD
    }
    
    return this.http.post<any>(`${this.apiUrl}/factures/${factureId}/paiements`, data)
      .pipe(
        catchError(error => {
          console.error(`Erreur lors de la création du paiement pour la facture ${factureId}:`, error);
          return throwError(() => new Error('Impossible de créer le paiement.'));
        })
      );
  }

  /**
   * Récupère le profil du fournisseur connecté
   */
  getProfilFournisseur(): Observable<ProfilFournisseur> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    return this.http.get<any>(`${this.apiUrl}/profil`)
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
          console.error('Erreur lors de la récupération du profil:', error);
          return throwError(() => new Error('Impossible de récupérer le profil du fournisseur.'));
        })
      );
  }

  /**
   * Met à jour le profil du fournisseur
   */
  updateProfilFournisseur(profil: Partial<ProfilFournisseur>): Observable<ProfilFournisseur> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    return this.http.put<any>(`${this.apiUrl}/profil`, profil)
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
          console.error('Erreur lors de la mise à jour du profil:', error);
          return throwError(() => new Error('Impossible de mettre à jour le profil du fournisseur.'));
        })
      );
  }

  /**
   * Récupère la liste des produits du fournisseur
   */
  getProduits(page: number = 0, size: number = 10, filters?: { categorie?: string, disponible?: boolean, searchText?: string, sortBy?: string, sortDir?: string }): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    if (filters) {
      if (filters.categorie) {
        params = params.set('categorie', filters.categorie);
      }
      if (filters.disponible !== undefined) {
        params = params.set('disponible', filters.disponible.toString());
      }
      if (filters.searchText) {
        params = params.set('search', filters.searchText);
      }
      if (filters.sortBy) {
        params = params.set('sortBy', filters.sortBy);
      }
      if (filters.sortDir) {
        params = params.set('sortDir', filters.sortDir);
      }
    }
    
    return this.http.get<any>(`${this.apiUrl}/produits`, { params })
      .pipe(
        map(response => ({
          content: response.content.map((produit: any) => ({
            id: produit.id,
            reference: produit.reference,
            nom: produit.nom,
            description: produit.description,
            prix: produit.prix,
            categorie: produit.categorie,
            disponible: produit.disponible,
            stock: produit.stock,
            dateCreation: new Date(produit.dateCreation),
            dateModification: produit.dateModification ? new Date(produit.dateModification) : undefined
          })),
          totalElements: response.totalElements,
          totalPages: response.totalPages,
          currentPage: response.number
        })),
        catchError(error => {
          console.error('Erreur lors de la récupération des produits:', error);
          return throwError(() => new Error('Impossible de charger les produits.'));
        })
      );
  }

  /**
   * Récupère la liste des catégories de produits
   */
  getCategories(): Observable<string[]> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    return this.http.get<string[]>(`${this.apiUrl}/produits/categories`)
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la récupération des catégories:', error);
          return throwError(() => new Error('Impossible de charger les catégories de produits.'));
        })
      );
  }

  /**
   * Crée un nouveau produit
   */
  createProduit(produitData: any): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    return this.http.post<any>(`${this.apiUrl}/produits`, produitData)
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la création du produit:', error);
          return throwError(() => new Error('Impossible de créer le produit.'));
        })
      );
  }

  /**
   * Met à jour un produit existant
   */
  updateProduit(id: string, produitData: any): Observable<any> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
    }
    
    return this.http.put<any>(`${this.apiUrl}/produits/${id}`, produitData)
      .pipe(
        catchError(error => {
          console.error(`Erreur lors de la mise à jour du produit ${id}:`, error);
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
    
    return this.http.patch<any>(`${this.apiUrl}/produits/${id}/disponibilite`, { disponible })
      .pipe(
        catchError(error => {
          console.error(`Erreur lors de la mise à jour de la disponibilité du produit ${id}:`, error);
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
    
    return this.http.delete<any>(`${this.apiUrl}/produits/${id}`)
      .pipe(
        catchError(error => {
          console.error(`Erreur lors de la suppression du produit ${id}:`, error);
          return throwError(() => new Error('Impossible de supprimer le produit.'));
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
  getDashboardStats(): Observable<DashboardStats> {
    // Récupère l'utilisateur connecté pour vérifier son rôle
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.hasRole('FOURNISSEUR')) {
      return throwError(() => new Error('Accès non autorisé. Vous devez être connecté en tant que fournisseur.'));
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
          return throwError(() => new Error('Impossible de charger les statistiques du tableau de bord.'));
        })
      );
  }
}
