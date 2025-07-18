import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from '../../auth/services/auth.service';

export enum StatutCommande {
  BROUILLON = 'BROUILLON',
  CONFIRMEE = 'CONFIRMEE',
  EN_ATTENTE = 'EN_ATTENTE',
  LIVRAISON_PARTIELLE = 'LIVRAISON_PARTIELLE',
  LIVREE = 'LIVREE',
  ANNULEE = 'ANNULEE'
}

export enum StatutLigne {
  EN_ATTENTE = 'EN_ATTENTE',
  RECEPTION_PARTIELLE = 'RECEPTION_PARTIELLE',
  RECEPTIONNE = 'RECEPTIONNE',
  ANNULE = 'ANNULE'
}

export interface LigneCommande {
  id?: number;
  reference?: string;
  designation: string;
  description?: string;
  quantite: number;
  prixUnitaireHT: number;
  tauxTVA: number;
  montantHT?: number;
  montantTVA?: number;
  montantTTC?: number;
  produitId?: number;
  statut?: StatutLigne;
  quantiteRecue?: number;
}

export interface Commande {
  id?: number;
  numero?: string;
  fournisseur?: {
    id?: number;
    nom?: string;
    email?: string;
  };
  dateCommande?: string;
  dateLivraisonPrevue?: string;
  dateLivraisonEffective?: string;
  statut?: StatutCommande;
  montantHT?: number;
  montantTVA?: number;
  montantTTC?: number;
  notes?: string;
  lignes?: LigneCommande[];
  dateCreation?: string;
  dateModification?: string;
  creePar?: string;
  modifiePar?: string;
}

export interface CommandePageable {
  content: Commande[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface CommandeStatistiques {
  nombreTotal: number;
  commandesParStatut: { [key in StatutCommande]?: number };
  montantTotalConfirmees: number;
  montantTotalLivrees: number;
  commandesParFournisseur: {
    fournisseurId: number;
    fournisseurNom: string;
    nombreCommandes: number;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class CommandeService {
  // Méthode pour gérer les erreurs de connexion
  private handleConnectionError<T>(error: any, fallbackValue: T): Observable<T> {
    console.error('Erreur de connexion au backend:', error);
    this.isBackendAvailable = false;
    console.warn('Le backend est considéré comme indisponible');
    return of(fallbackValue);
  }
  // URL principale de l'API
  private apiUrl = 'http://localhost:8088/api/commandes';
  private isBackendAvailable = true;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  // Obtenir les headers d'authentification
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // Récupérer toutes les commandes (uniquement les commandes réelles)
  getCommandes(): Observable<Commande[]> {
    return this.http.get<Commande[]>(this.apiUrl, { headers: this.getAuthHeaders() }).pipe(
      map(commandes => {
        console.log('Commandes récupérées depuis l\'API:', commandes);
        this.isBackendAvailable = true; // Marquer le backend comme disponible
        
        // Filtrer pour ne garder que les commandes réelles
        // Une commande est considérée comme réelle si elle a un numéro de commande valide
        // et si elle n'est pas marquée comme test ou fictive
        const commandesReelles = commandes.filter(commande => {
          // Vérifier si la commande a un numéro valide (pas null, undefined ou vide)
          const hasValidNumber = commande.numero && commande.numero.trim().length > 0;
          
          // Vérifier si le numéro de commande ne contient pas de mots-clés indiquant qu'il s'agit d'un test
          const isNotTest = !commande.numero?.toLowerCase().includes('test') && 
                           !commande.numero?.toLowerCase().includes('demo') && 
                           !commande.numero?.toLowerCase().includes('fictive');
          
          return hasValidNumber && isNotTest;
        });
        
        console.log('Commandes réelles après filtrage:', commandesReelles);
        return commandesReelles;
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des commandes:', error);
        return this.handleConnectionError(error, []);
      })
    );
  }

  // Récupérer les commandes avec pagination
  getCommandesPaginees(page: number, size: number): Observable<CommandePageable> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<CommandePageable>(`${this.apiUrl}/paginees`, { 
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération des commandes paginées:', error);
        throw error;
      })
    );
  }

  // Récupérer une commande par son ID avec gestion des erreurs et fallback
  getCommandeById(id: number): Observable<Commande> {
    // Essayer d'abord avec l'URL principale
    return this.http.get<Commande>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(error => {
          console.error(`Erreur lors de la récupération de la commande ${id} depuis ${this.apiUrl}:`, error);
          
          // Si l'erreur est une erreur 500, essayons de récupérer la commande sans les lignes
          if (error.status === 500) {
            console.log(`Tentative de récupération de la commande ${id} sans les lignes...`);
            return this.http.get<Commande>(`${this.apiUrl}/${id}?skipLines=true`, { headers: this.getAuthHeaders() })
              .pipe(
                catchError(innerError => {
                  console.error(`Échec de la récupération de la commande ${id} sans les lignes:`, innerError);
                  // Essayer avec une URL alternative sur le port 8080
                  console.log(`Tentative avec URL alternative sur le port 8080 pour la commande ${id}...`);
                  return this.http.get<Commande>(`http://localhost:8080/api/commandes/${id}`, { headers: this.getAuthHeaders() })
                    .pipe(
                      catchError(altError => {
                        console.error(`Échec de la récupération depuis l'URL alternative:`, altError);
                        // Dernière tentative avec une autre URL alternative
                        console.log(`Dernière tentative avec URL alternative sur le port 8086 pour la commande ${id}...`);
                        return this.http.get<Commande>(`http://localhost:8086/api/commandes/${id}`, { headers: this.getAuthHeaders() })
                          .pipe(
                            catchError(finalError => {
                              console.error(`Toutes les tentatives ont échoué pour la commande ${id}:`, finalError);
                              // Si toutes les tentatives échouent, retournons une commande vide mais avec l'ID demandé
                              const emptyCommande: Commande = {
                                id: id,
                                fournisseur: { id: 0 },
                                statut: StatutCommande.BROUILLON,
                                lignes: [],
                                montantHT: 0,
                                montantTVA: 0,
                                montantTTC: 0,
                                numero: `CMD-${id}-ERROR`
                              };
                              return of(emptyCommande);
                            })
                          );
                      })
                    );
                })
              );
          }
          
          // Si l'erreur est une erreur de connexion, essayons les URLs alternatives
          console.log(`Tentative avec URL alternative sur le port 8080 pour la commande ${id}...`);
          return this.http.get<Commande>(`http://localhost:8080/api/commandes/${id}`, { headers: this.getAuthHeaders() })
            .pipe(
              catchError(altError => {
                console.error(`Échec de la récupération depuis l'URL alternative:`, altError);
                // Dernière tentative avec une autre URL alternative
                console.log(`Dernière tentative avec URL alternative sur le port 8086 pour la commande ${id}...`);
                return this.http.get<Commande>(`http://localhost:8086/api/commandes/${id}`, { headers: this.getAuthHeaders() })
                  .pipe(
                    catchError(finalError => {
                      console.error(`Toutes les tentatives ont échoué pour la commande ${id}:`, finalError);
                      // Si toutes les tentatives échouent, retournons une commande vide mais avec l'ID demandé
                      const emptyCommande: Commande = {
                        id: id,
                        fournisseur: { id: 0 },
                        statut: StatutCommande.BROUILLON,
                        lignes: [],
                        montantHT: 0,
                        montantTVA: 0,
                        montantTTC: 0,
                        numero: `CMD-${id}-ERROR`
                      };
                      return of(emptyCommande);
                    })
                  );
              })
            );
        })
      );
  }

  // Créer une nouvelle commande
  createCommande(commande: Commande): Observable<Commande> {
    return this.http.post<Commande>(this.apiUrl, commande, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error('Erreur lors de la création de la commande:', error);
        throw error;
      })
    );
  }

  // Créer une nouvelle commande avec seulement l'email du fournisseur
  createCommandeWithEmail(commande: Commande, fournisseurEmail: string): Observable<Commande> {
    // Construire l'URL avec le paramètre d'email
    const url = `${this.apiUrl}/with-email?fournisseurEmail=${encodeURIComponent(fournisseurEmail)}`;
    
    console.log(`Création d'une commande avec l'email du fournisseur: ${fournisseurEmail}`);
    
    return this.http.post<Commande>(url, commande, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        console.log('Commande créée avec succès via email:', response);
        return response;
      }),
      catchError(error => {
        console.error(`Erreur lors de la création de la commande avec l'email ${fournisseurEmail}:`, error);
        throw error;
      })
    );
  }

  // Mettre à jour une commande
  updateCommande(id: number, commande: Commande): Observable<Commande> {
    return this.http.put<Commande>(`${this.apiUrl}/${id}`, commande, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error(`Erreur lors de la mise à jour de la commande ${id}:`, error);
        throw error;
      })
    );
  }

  // Supprimer une commande
  deleteCommande(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error(`Erreur lors de la suppression de la commande ${id}:`, error);
        throw error;
      })
    );
  }

  // Ajouter une ligne à une commande
  ajouterLigne(commandeId: number, ligne: LigneCommande): Observable<LigneCommande> {
    return this.http.post<LigneCommande>(`${this.apiUrl}/${commandeId}/lignes`, ligne, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error(`Erreur lors de l'ajout d'une ligne à la commande ${commandeId}:`, error);
        throw error;
      })
    );
  }

  // Mettre à jour une ligne de commande
  updateLigne(commandeId: number, ligneId: number, ligne: LigneCommande): Observable<LigneCommande> {
    return this.http.put<LigneCommande>(`${this.apiUrl}/${commandeId}/lignes/${ligneId}`, ligne, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error(`Erreur lors de la mise à jour de la ligne ${ligneId} de la commande ${commandeId}:`, error);
        throw error;
      })
    );
  }

  // Supprimer une ligne de commande
  deleteLigne(commandeId: number, ligneId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${commandeId}/lignes/${ligneId}`, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error(`Erreur lors de la suppression de la ligne ${ligneId} de la commande ${commandeId}:`, error);
        throw error;
      })
    );
  }

  // Mettre à jour le statut d'une commande
  updateStatut(id: number, statut: StatutCommande): Observable<Commande> {
    return this.http.put<Commande>(`${this.apiUrl}/${id}/statut?statut=${statut}`, {}, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error(`Erreur lors de la mise à jour du statut de la commande ${id}:`, error);
        throw error;
      })
    );
  }

  // Confirmer une commande
  confirmerCommande(id: number): Observable<Commande> {
    return this.http.put<Commande>(`${this.apiUrl}/${id}/confirmer`, {}, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error(`Erreur lors de la confirmation de la commande ${id}:`, error);
        throw error;
      })
    );
  }

  // Livrer une commande
  livrerCommande(id: number): Observable<Commande> {
    return this.http.put<Commande>(`${this.apiUrl}/${id}/livrer`, {}, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error(`Erreur lors de la livraison de la commande ${id}:`, error);
        throw error;
      })
    );
  }

  // Livrer partiellement une commande
  livrerCommandePartielle(id: number, quantitesRecues: { [ligneId: number]: number }): Observable<Commande> {
    return this.http.put<Commande>(`${this.apiUrl}/${id}/livrer-partielle`, quantitesRecues, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error(`Erreur lors de la livraison partielle de la commande ${id}:`, error);
        throw error;
      })
    );
  }

  // Annuler une commande
  annulerCommande(id: number): Observable<Commande> {
    return this.http.put<Commande>(`${this.apiUrl}/${id}/annuler`, {}, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error(`Erreur lors de l'annulation de la commande ${id}:`, error);
        throw error;
      })
    );
  }

  // Rechercher des commandes
  rechercherCommandes(terme: string, page: number, size: number): Observable<CommandePageable> {
    const params = new HttpParams()
      .set('terme', terme || '')
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<CommandePageable>(`${this.apiUrl}/recherche`, { 
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      catchError(error => {
        console.error('Erreur lors de la recherche de commandes:', error);
        throw error;
      })
    );
  }

  // Recherche avancée de commandes
  rechercheAvancee(
    numero?: string,
    fournisseurId?: number,
    statut?: StatutCommande,
    dateDebut?: string,
    dateFin?: string,
    page: number = 0,
    size: number = 10
  ): Observable<CommandePageable> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (numero) params = params.set('numero', numero);
    if (fournisseurId) params = params.set('fournisseurId', fournisseurId.toString());
    if (statut) params = params.set('statut', statut);
    if (dateDebut) params = params.set('dateDebut', dateDebut);
    if (dateFin) params = params.set('dateFin', dateFin);

    return this.http.get<CommandePageable>(`${this.apiUrl}/recherche-avancee`, { 
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      catchError(error => {
        console.error('Erreur lors de la recherche avancée de commandes:', error);
        throw error;
      })
    );
  }

  // Obtenir les commandes par fournisseur
  getCommandesByFournisseur(fournisseurId: number): Observable<Commande[]> {
    return this.http.get<Commande[]>(`${this.apiUrl}/fournisseur/${fournisseurId}`, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error(`Erreur lors de la récupération des commandes du fournisseur ${fournisseurId}:`, error);
        throw error;
      })
    );
  }

  // Obtenir les commandes par statut
  getCommandesByStatut(statut: StatutCommande): Observable<Commande[]> {
    return this.http.get<Commande[]>(`${this.apiUrl}/statut/${statut}`, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error(`Erreur lors de la récupération des commandes avec le statut ${statut}:`, error);
        throw error;
      })
    );
  }

  // Obtenir les commandes par période
  getCommandesByPeriode(debut: string, fin: string): Observable<Commande[]> {
    const params = new HttpParams()
      .set('debut', debut)
      .set('fin', fin);

    return this.http.get<Commande[]>(`${this.apiUrl}/periode`, { 
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      catchError(error => {
        console.error(`Erreur lors de la récupération des commandes pour la période du ${debut} au ${fin}:`, error);
        throw error;
      })
    );
  }

  // Obtenir le nombre total de commandes
  countCommandes(): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/count`, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error('Erreur lors du comptage des commandes:', error);
        throw error;
      })
    );
  }

  // Obtenir le nombre de commandes par statut
  getCommandesByStatutCount(): Observable<{ [key in StatutCommande]?: number }> {
    return this.http.get<{ [key in StatutCommande]?: number }>(`${this.apiUrl}/stats/par-statut`, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération du nombre de commandes par statut:', error);
        throw error;
      })
    );
  }

  // Obtenir les statistiques des commandes
  getStatistiquesCommandes(): Observable<CommandeStatistiques> {
    return this.http.get<CommandeStatistiques>(`${this.apiUrl}/stats`, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération des statistiques des commandes:', error);
        throw error;
      })
    );
  }

  // Générer un bon de commande PDF
  genererBonCommande(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/bon-commande`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        console.error(`Erreur lors de la génération du bon de commande pour la commande ${id}:`, error);
        throw error;
      })
    );
  }

  // Exporter des commandes spécifiques en PDF
  exportSelectedCommandesToPDF(commandeIds: number[]): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/export/pdf`, commandeIds, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        console.error('Erreur lors de l\'export des commandes en PDF:', error);
        throw error;
      })
    );
  }
  
  // Exporter toutes les commandes en PDF
  exportCommandesToPDF(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/pdf`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        console.error('Erreur lors de l\'export des commandes en PDF:', error);
        throw error;
      })
    );
  }

  // Exporter toutes les commandes en CSV
  exportCommandesToCSV(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/csv`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        console.error('Erreur lors de l\'export des commandes en CSV:', error);
        throw error;
      })
    );
  }

  // Exporter toutes les commandes en Excel
  exportCommandesToExcel(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/excel`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        console.error('Erreur lors de l\'export des commandes en Excel:', error);
        throw error;
      })
    );
  }
}
