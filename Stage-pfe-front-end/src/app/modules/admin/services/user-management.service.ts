import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService, User } from '../../../modules/auth/services/auth.service';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  // URL complète pour les endpoints admin
  private apiUrl = 'http://localhost:8081/api/admin';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }
  
  /**
   * Test simple d'accès à un endpoint admin
   */
  testAdminAccess(): Observable<any> {
    const token = this.authService.getToken();
    console.log('Test admin - Token JWT récupéré:', token);
    
    // Décoder le token JWT pour vérifier les rôles
    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        const decodedToken = JSON.parse(jsonPayload);
        console.log('Test admin - Token décodé:', decodedToken);
        console.log('Test admin - Rôles dans le token:', decodedToken.roles);
      } catch (e) {
        console.error('Test admin - Erreur lors du décodage du token:', e);
      }
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
    console.log('Test admin - Headers envoyés:', headers);
    console.log('Test admin - URL appelée:', `${this.apiUrl}/test`);
    
    return this.http.get(`${this.apiUrl}/test`, { 
      headers,
      observe: 'response',
      responseType: 'json'
    }).pipe(
      map(response => {
        console.log('Test admin - Réponse reçue:', response);
        return response.body;
      }),
      catchError(error => {
        console.error('Test admin - Erreur lors du test:', error);
        if (error.status === 0) {
          return throwError(() => new Error('Impossible de se connecter au serveur. Vérifiez votre connexion réseau.'));
        } else if (error.status === 401) {
          return throwError(() => new Error('Vous n\'avez pas l\'autorisation d\'accéder à cette ressource. Veuillez vous reconnecter.'));
        } else if (error.status === 403) {
          return throwError(() => new Error('Vous n\'avez pas les droits nécessaires pour accéder à cette ressource.'));
        } else {
          return throwError(() => new Error(`Erreur ${error.status}: ${error.error?.message || 'Impossible de tester l\'accès admin.'}`));
        }
      })
    );
  }

  /**
   * Récupère tous les utilisateurs
   */
  getUsers(): Observable<User[]> {
    const token = this.authService.getToken();
    console.log('Token JWT récupéré:', token);
    
    // Décoder le token JWT pour vérifier les rôles
    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        const decodedToken = JSON.parse(jsonPayload);
        console.log('Token décodé:', decodedToken);
        console.log('Rôles dans le token:', decodedToken.roles);
        console.log('L\'utilisateur a-t-il le rôle ADMIN?', 
          Array.isArray(decodedToken.roles) && 
          (decodedToken.roles.includes('ADMIN') || decodedToken.roles.includes('ROLE_ADMIN')));
      } catch (e) {
        console.error('Erreur lors du décodage du token:', e);
      }
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
    console.log('Headers envoyés:', headers);
    console.log('URL appelée:', `${this.apiUrl}/users`);
    
    return this.http.get<User[]>(`${this.apiUrl}/users`, { 
      headers,
      observe: 'response',
      responseType: 'json'
    }).pipe(
      map(response => {
        console.log('Réponse reçue:', response);
        return response.body as User[];
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        if (error.status === 0) {
          return throwError(() => new Error('Impossible de se connecter au serveur. Vérifiez votre connexion réseau.'));
        } else if (error.status === 401) {
          return throwError(() => new Error('Vous n\'avez pas l\'autorisation d\'accéder à cette ressource. Veuillez vous reconnecter.'));
        } else if (error.status === 403) {
          return throwError(() => new Error('Vous n\'avez pas les droits nécessaires pour accéder à cette ressource.'));
        } else {
          return throwError(() => new Error(`Erreur ${error.status}: ${error.error?.message || 'Impossible de récupérer les utilisateurs. Veuillez réessayer plus tard.'}`));
        }
      })
    );
  }

  /**
   * Récupère un utilisateur par son ID
   */
  getUserById(id: number): Observable<User> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });

    return this.http.get<User>(`${this.apiUrl}/users/${id}`, { 
      headers,
      observe: 'response',
      responseType: 'json'
    }).pipe(
      map(response => {
        console.log(`Réponse reçue pour l'utilisateur ${id}:`, response);
        return response.body as User;
      }),
      catchError(error => {
        console.error(`Erreur lors de la récupération de l'utilisateur ${id}:`, error);
        if (error.status === 0) {
          return throwError(() => new Error('Impossible de se connecter au serveur. Vérifiez votre connexion réseau.'));
        } else if (error.status === 401) {
          return throwError(() => new Error('Vous n\'avez pas l\'autorisation d\'accéder à cette ressource. Veuillez vous reconnecter.'));
        } else if (error.status === 403) {
          return throwError(() => new Error('Vous n\'avez pas les droits nécessaires pour accéder à cette ressource.'));
        } else {
          return throwError(() => new Error(`Erreur ${error.status}: ${error.error?.message || `Impossible de récupérer l'utilisateur ${id}. Veuillez réessayer plus tard.`}`));
        }
      })
    );
  }

  /**
   * Crée un nouvel utilisateur
   */
  createUser(user: any): Observable<any> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });

    console.log('Création d\'utilisateur - données envoyées:', user);
    console.log('Création d\'utilisateur - URL appelée:', `${this.apiUrl}/users`);
    console.log('Création d\'utilisateur - Headers envoyés:', headers);

    return this.http.post(`${this.apiUrl}/users`, user, { 
      headers,
      observe: 'body',  // Changement de 'response' à 'body' pour simplifier la gestion
      responseType: 'text'  // Changement de 'json' à 'text' car le backend renvoie une chaîne de texte
    }).pipe(
      map(response => {
        console.log('Création d\'utilisateur - Réponse reçue:', response);
        return { success: true, message: response };
      }),
      catchError(error => {
        console.error('Erreur lors de la création de l\'utilisateur:', error);
        if (error.status === 0) {
          return throwError(() => new Error('Impossible de se connecter au serveur. Vérifiez votre connexion réseau.'));
        } else if (error.status === 401) {
          return throwError(() => new Error('Vous n\'avez pas l\'autorisation d\'accéder à cette ressource. Veuillez vous reconnecter.'));
        } else if (error.status === 403) {
          return throwError(() => new Error('Vous n\'avez pas les droits nécessaires pour accéder à cette ressource.'));
        } else {
          return throwError(() => new Error(`Erreur ${error.status}: ${error.error?.message || error.message || 'Impossible de créer l\'utilisateur. Veuillez réessayer plus tard.'}`));
        }
      })
    );
  }

  /**
   * Met à jour un utilisateur existant
   */
  updateUser(id: number, user: any): Observable<any> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });

    console.log(`Mise à jour de l'utilisateur ${id} - données envoyées:`, user);
    console.log(`Mise à jour de l'utilisateur ${id} - URL appelée:`, `${this.apiUrl}/users/${id}`);
    console.log(`Mise à jour de l'utilisateur ${id} - Headers envoyés:`, headers);

    return this.http.put(`${this.apiUrl}/users/${id}`, user, { 
      headers,
      observe: 'body',  // Changement de 'response' à 'body' pour simplifier la gestion
      responseType: 'text'  // Changement de 'json' à 'text' car le backend renvoie une chaîne de texte
    }).pipe(
      map(response => {
        console.log(`Mise à jour de l'utilisateur ${id} - Réponse reçue:`, response);
        return { success: true, message: response };
      }),
      catchError(error => {
        console.error(`Erreur lors de la mise à jour de l'utilisateur ${id}:`, error);
        if (error.status === 0) {
          return throwError(() => new Error('Impossible de se connecter au serveur. Vérifiez votre connexion réseau.'));
        } else if (error.status === 401) {
          return throwError(() => new Error('Vous n\'avez pas l\'autorisation d\'accéder à cette ressource. Veuillez vous reconnecter.'));
        } else if (error.status === 403) {
          return throwError(() => new Error('Vous n\'avez pas les droits nécessaires pour accéder à cette ressource.'));
        } else {
          return throwError(() => new Error(`Erreur ${error.status}: ${error.error?.message || error.message || `Impossible de mettre à jour l'utilisateur ${id}. Veuillez réessayer plus tard.`}`));
        }
      })
    );
  }

  /**
   * Supprime un utilisateur
   */
  deleteUser(id: number): Observable<any> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });

    console.log(`Suppression de l'utilisateur ${id} - URL appelée:`, `${this.apiUrl}/users/${id}`);
    console.log(`Suppression de l'utilisateur ${id} - Headers envoyés:`, headers);

    return this.http.delete(`${this.apiUrl}/users/${id}`, { 
      headers,
      observe: 'body',  // Changement de 'response' à 'body' pour simplifier la gestion
      responseType: 'text'  // Changement de 'json' à 'text' car le backend renvoie une chaîne de texte
    }).pipe(
      map(response => {
        console.log(`Suppression de l'utilisateur ${id} - Réponse reçue:`, response);
        return { success: true, message: response };
      }),
      catchError(error => {
        console.error(`Erreur lors de la suppression de l'utilisateur ${id}:`, error);
        if (error.status === 0) {
          return throwError(() => new Error('Impossible de se connecter au serveur. Vérifiez votre connexion réseau.'));
        } else if (error.status === 401) {
          return throwError(() => new Error('Vous n\'avez pas l\'autorisation d\'accéder à cette ressource. Veuillez vous reconnecter.'));
        } else if (error.status === 403) {
          return throwError(() => new Error('Vous n\'avez pas les droits nécessaires pour accéder à cette ressource.'));
        } else {
          return throwError(() => new Error(`Erreur ${error.status}: ${error.error?.message || error.message || `Impossible de supprimer l'utilisateur ${id}. Veuillez réessayer plus tard.`}`));
        }
      })
    );
  }

  /**
   * Normalise un rôle pour l'affichage (supprime le préfixe ROLE_ si présent)
   */
  normalizeRole(role: string): string {
    return role.startsWith('ROLE_') ? role.substring(5) : role;
  }

  /**
   * Prépare un rôle pour l'API (ajoute le préfixe ROLE_ si absent)
   */
  prepareRoleForApi(role: string): string {
    return role.startsWith('ROLE_') ? role : `ROLE_${role}`;
  }
}
