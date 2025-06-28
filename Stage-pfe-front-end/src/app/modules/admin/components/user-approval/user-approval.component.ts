import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, throwError, map, of } from 'rxjs';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-user-approval',
  templateUrl: './user-approval.component.html',
  styleUrls: ['./user-approval.component.scss']
})
export class UserApprovalComponent implements OnInit {
  pendingUsers: any[] = [];
  activeUsers: any[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  
  // URLs pour les API - 8081 est le port du service d'authentification
  private apiUrl = 'http://localhost:8081/api/admin';
  private serviceAvailable = true;

  constructor(private http: HttpClient, private authService: AuthService) { }

  ngOnInit(): void {
    this.loadPendingUsers();
    this.loadActiveUsers();
  }
  
  /**
   * Obtient l'URL de l'API d'authentification
   */
  private getApiUrl(): string {
    return this.apiUrl;
  }
  
  /**
   * Marque le service comme indisponible en cas d'échec
   */
  private markServiceAsUnavailable(): void {
    console.error('Échec de la connexion au service d\'authentification sur le port 8081');
    this.serviceAvailable = false;
  }
  
  isServiceAvailable(): boolean {
    return this.serviceAvailable;
  }
  
  loadPendingUsers(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    this.http.get<any[]>(`${this.getApiUrl()}/users/pending`, { headers: this.getAuthHeaders() })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('Erreur lors du chargement des utilisateurs en attente:', error);
          this.markServiceAsUnavailable();
          return of([]);
        }),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (users) => {
          this.pendingUsers = users;
          console.log('Utilisateurs en attente chargés:', users);
          this.serviceAvailable = true;
        },
        error: (error) => {
          this.errorMessage = this.getErrorMessage(error, 'chargement des utilisateurs en attente');
          console.error('Erreur lors du chargement des utilisateurs en attente:', error);
          this.serviceAvailable = false;
        }
      });
  }
  
  loadActiveUsers(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    // Utiliser l'endpoint /users et filtrer les utilisateurs actifs côté client
    this.http.get<any[]>(`${this.getApiUrl()}/users`, { headers: this.getAuthHeaders() })
      .pipe(
        map(users => users.filter(user => user.active === true)),
        catchError((error: HttpErrorResponse) => {
          console.error('Erreur lors du chargement des utilisateurs actifs:', error);
          this.markServiceAsUnavailable();
          return of([]);
        }),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (users) => {
          this.activeUsers = users;
          console.log('Utilisateurs actifs chargés:', users);
          this.serviceAvailable = true;
        },
        error: (error) => {
          this.errorMessage = this.getErrorMessage(error, 'chargement des utilisateurs actifs');
          console.error('Erreur lors du chargement des utilisateurs actifs:', error);
          this.serviceAvailable = false;
        }
      });
  }
  
  approveUser(userId: string): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;
    
    // Convertir l'ID en nombre si nécessaire (le backend attend un Long)
    const numericId = Number(userId);
    console.log(`Approbation de l'utilisateur avec ID: ${userId} (converti en: ${numericId})`);
    
    // Spécifier explicitement le type de réponse attendu comme string pour éviter les erreurs de parsing
    this.http.put<string>(`${this.getApiUrl()}/users/${numericId}/approve`, {}, { 
      headers: this.getAuthHeaders(),
      responseType: 'text' as 'json' // Forcer le traitement de la réponse comme texte
    })
      .pipe(
        catchError(error => {
          console.error('Erreur lors de l\'approbation de l\'utilisateur:', error);
          this.markServiceAsUnavailable();
          return throwError(() => error);
        }),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (response) => {
          console.log('Réponse d\'approbation:', response);
          this.successMessage = 'Utilisateur approuvé avec succès';
          // Recharger les listes d'utilisateurs
          this.loadPendingUsers();
          this.loadActiveUsers();
        },
        error: (error) => {
          this.errorMessage = `Erreur lors de l'approbation de l'utilisateur: ${error.message}`;
          console.error('Erreur lors de l\'approbation de l\'utilisateur:', error);
        }
      });
  }
  
  deactivateUser(userId: string): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;
    
    // Convertir l'ID en nombre si nécessaire (le backend attend un Long)
    const numericId = Number(userId);
    console.log(`Désactivation de l'utilisateur avec ID: ${userId} (converti en: ${numericId})`);
    
    // Spécifier explicitement le type de réponse attendu comme string pour éviter les erreurs de parsing
    this.http.put<string>(`${this.getApiUrl()}/users/${numericId}/deactivate`, {}, { 
      headers: this.getAuthHeaders(),
      responseType: 'text' as 'json' // Forcer le traitement de la réponse comme texte
    })
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la désactivation de l\'utilisateur:', error);
          this.markServiceAsUnavailable();
          return throwError(() => error);
        }),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (response) => {
          console.log('Réponse de désactivation:', response);
          this.successMessage = 'Utilisateur désactivé avec succès';
          // Recharger les listes d'utilisateurs
          this.loadPendingUsers();
          this.loadActiveUsers();
        },
        error: (error) => {
          this.errorMessage = `Erreur lors de la désactivation de l'utilisateur: ${error.message}`;
          console.error('Erreur lors de la désactivation de l\'utilisateur:', error);
        }
      });
  }
  
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }
  
  /**
   * Génère un message d'erreur convivial basé sur le type d'erreur HTTP
   */
  private getErrorMessage(error: HttpErrorResponse, action: string): string {
    if (error.status === 0) {
      return `Le service d'authentification n'est pas accessible. Veuillez vérifier que le service est démarré sur le port 8081.`;
    } else if (error.status === 404) {
      return `L'endpoint pour ${action} n'existe pas sur le service d'authentification.`;
    } else if (error.status === 403) {
      return `Vous n'avez pas les droits nécessaires pour ${action}.`;
    } else if (error.status === 401) {
      return `Votre session a expiré. Veuillez vous reconnecter.`;
    } else {
      return `Erreur lors de ${action}: ${error.message || error.statusText}`;
    }
  }
  
  // Cette méthode a été déplacée plus haut dans le code
  
  getRoleLabel(role: string): string {
    // Supprimer le préfixe ROLE_ si présent
    const normalizedRole = role.replace('ROLE_', '');
    
    // Mapper les rôles aux libellés français
    switch (normalizedRole.toUpperCase()) {
      case 'ADMIN': return 'Administrateur';
      case 'VENDEUR': return 'Vendeur';
      case 'FOURNISSEUR': return 'Fournisseur';
      case 'ACHAT': return 'Acheteur';
      case 'MAGASINIER': return 'Magasinier';
      case 'CLIENT': return 'Client';
      default: return normalizedRole;
    }
  }
}
