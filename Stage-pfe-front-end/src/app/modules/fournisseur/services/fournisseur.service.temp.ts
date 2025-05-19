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
}
