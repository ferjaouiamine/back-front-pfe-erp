import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from '../../auth/services/auth.service';

export interface Fournisseur {
  id: string;
  nom: string;
  adresse: string;
  telephone: string;
  email: string;
  contactNom?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AchatItem {
  id: string;
  achatId: string;
  productId: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
}

export interface Achat {
  id: string;
  numero: string;
  fournisseurId: string;
  fournisseurNom: string;
  date: Date;
  dateLivraison?: Date;
  status: 'COMMANDE' | 'LIVRAISON_PARTIELLE' | 'LIVREE' | 'ANNULEE';
  total: number;
  notes?: string;
  items: AchatItem[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class AchatService {
  private apiUrl = 'http://localhost:8082/api/achats';
  private fournisseursUrl = 'http://localhost:8082/api/fournisseurs';

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

  // Récupérer toutes les commandes d'achat
  getAchats(): Observable<Achat[]> {
    return this.http.get<Achat[]>(this.apiUrl, { headers: this.getAuthHeaders() }).pipe(
      map(achats => {
        console.log('Commandes récupérées depuis l\'API:', achats);
        return achats;
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des commandes:', error);
        // En cas d'erreur, utiliser des données factices comme fallback
        return of([]);
      })
    );
  }

  // Récupérer une commande par son ID
  getAchatById(id: string): Observable<Achat> {
    return this.http.get<Achat>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() }).pipe(
      map(achat => {
        console.log(`Commande ${id} récupérée depuis l'API:`, achat);
        return achat;
      }),
      catchError(error => {
        console.error(`Erreur lors de la récupération de la commande ${id}:`, error);
        throw error;
      })
    );
  }

  // Créer une nouvelle commande d'achat
  createAchat(achat: Achat): Observable<Achat> {
    return this.http.post<Achat>(this.apiUrl, achat, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        console.log('Commande créée avec succès:', response);
        return response;
      }),
      catchError(error => {
        console.error('Erreur lors de la création de la commande:', error);
        throw error;
      })
    );
  }

  // Mettre à jour le statut d'une commande
  updateAchatStatus(id: string, status: 'COMMANDE' | 'LIVRAISON_PARTIELLE' | 'LIVREE' | 'ANNULEE'): Observable<Achat> {
    return this.http.patch<Achat>(`${this.apiUrl}/${id}/status`, { status }, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        console.log(`Statut de la commande ${id} mis à jour avec succès:`, response);
        return response;
      }),
      catchError(error => {
        console.error(`Erreur lors de la mise à jour du statut de la commande ${id}:`, error);
        throw error;
      })
    );
  }

  // Générer un bon de commande PDF
  generateBonCommande(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/pdf`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        console.error(`Erreur lors de la génération du PDF pour la commande ${id}:`, error);
        throw error;
      })
    );
  }

  // Récupérer tous les fournisseurs
  getFournisseurs(): Observable<Fournisseur[]> {
    return this.http.get<Fournisseur[]>(this.fournisseursUrl, { headers: this.getAuthHeaders() }).pipe(
      map(fournisseurs => {
        console.log('Fournisseurs récupérés depuis l\'API:', fournisseurs);
        return fournisseurs;
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des fournisseurs:', error);
        return of([]);
      })
    );
  }

  // Récupérer un fournisseur par son ID
  getFournisseurById(id: string): Observable<Fournisseur> {
    return this.http.get<Fournisseur>(`${this.fournisseursUrl}/${id}`, { headers: this.getAuthHeaders() }).pipe(
      map(fournisseur => {
        console.log(`Fournisseur ${id} récupéré depuis l'API:`, fournisseur);
        return fournisseur;
      }),
      catchError(error => {
        console.error(`Erreur lors de la récupération du fournisseur ${id}:`, error);
        throw error;
      })
    );
  }

  // Créer un nouveau fournisseur
  createFournisseur(fournisseur: Fournisseur): Observable<Fournisseur> {
    return this.http.post<Fournisseur>(this.fournisseursUrl, fournisseur, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        console.log('Fournisseur créé avec succès:', response);
        return response;
      }),
      catchError(error => {
        console.error('Erreur lors de la création du fournisseur:', error);
        throw error;
      })
    );
  }

  // Mettre à jour un fournisseur
  updateFournisseur(id: string, fournisseur: Fournisseur): Observable<Fournisseur> {
    return this.http.put<Fournisseur>(`${this.fournisseursUrl}/${id}`, fournisseur, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        console.log(`Fournisseur ${id} mis à jour avec succès:`, response);
        return response;
      }),
      catchError(error => {
        console.error(`Erreur lors de la mise à jour du fournisseur ${id}:`, error);
        throw error;
      })
    );
  }

  // Supprimer un fournisseur
  deleteFournisseur(id: string): Observable<any> {
    return this.http.delete(`${this.fournisseursUrl}/${id}`, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        console.log(`Fournisseur ${id} supprimé avec succès`);
        return response;
      }),
      catchError(error => {
        console.error(`Erreur lors de la suppression du fournisseur ${id}:`, error);
        throw error;
      })
    );
  }
}
