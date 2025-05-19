import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Fournisseur {
  id: number;
  nom: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  ville?: string;
  codePostal?: string;
  pays?: string;
  siteWeb?: string;
  numeroTva?: string;
  commentaire?: string;
  actif?: boolean;
}

export interface FournisseurPageable {
  content: Fournisseur[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Injectable({
  providedIn: 'root'
})
export class FournisseurService {
  private apiUrl = `${environment.apiUrl}/fournisseurs`;

  constructor(private http: HttpClient) { }

  // Récupérer tous les fournisseurs
  getAllFournisseurs(): Observable<Fournisseur[]> {
    return this.http.get<Fournisseur[]>(`${this.apiUrl}`);
  }

  // Récupérer les fournisseurs avec pagination
  getFournisseursPagines(page: number = 0, size: number = 10): Observable<FournisseurPageable> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    return this.http.get<FournisseurPageable>(`${this.apiUrl}`, { params });
  }

  // Récupérer un fournisseur par son ID
  getFournisseurById(id: number): Observable<Fournisseur> {
    return this.http.get<Fournisseur>(`${this.apiUrl}/${id}`);
  }

  // Créer un nouveau fournisseur
  createFournisseur(fournisseur: Fournisseur): Observable<Fournisseur> {
    return this.http.post<Fournisseur>(`${this.apiUrl}`, fournisseur);
  }

  // Mettre à jour un fournisseur
  updateFournisseur(id: number, fournisseur: Fournisseur): Observable<Fournisseur> {
    return this.http.put<Fournisseur>(`${this.apiUrl}/${id}`, fournisseur);
  }

  // Supprimer un fournisseur
  deleteFournisseur(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Recherche avancée de fournisseurs
  rechercheAvancee(
    terme?: string,
    ville?: string,
    pays?: string,
    actif?: boolean,
    page: number = 0,
    size: number = 10
  ): Observable<FournisseurPageable> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    if (terme) params = params.set('terme', terme);
    if (ville) params = params.set('ville', ville);
    if (pays) params = params.set('pays', pays);
    if (actif !== undefined) params = params.set('actif', actif.toString());
    
    return this.http.get<FournisseurPageable>(`${this.apiUrl}/recherche`, { params });
  }
}
