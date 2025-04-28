import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { tap, map, catchError, delay } from 'rxjs/operators';
import { Router } from '@angular/router';

export interface User {
  id: string;
  username: string;
  email: string;
  address?: string;
  roles: string[];
  active?: boolean;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  address?: string;
  role?: string;
}

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  user?: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8081/api/auth';
  private currentUser: User | null = null;

  constructor(private http: HttpClient, private router: Router) {
    this.loadUserFromToken();
  }

  /**
   * Authentifie un utilisateur et stocke son token JWT
   */
  login(credentials: LoginRequest): Observable<AuthResponse> {
    const loginUrl = `${this.apiUrl}/signin`;
    
    console.log(`AuthService: Sending login request to ${loginUrl}`);
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
    
    return this.http.post<AuthResponse>(loginUrl, credentials, { headers }).pipe(
      tap(response => {
        console.log('AuthService: Login response:', response);
        
        if (response && response.accessToken) {
          localStorage.setItem('authToken', response.accessToken);
          this.loadUserFromToken();
        }
      }),
      catchError(error => {
        console.error('AuthService: Login error:', error);
        
        let errorMsg = 'Erreur lors de la connexion';
        
        if (error.error && typeof error.error === 'string') {
          errorMsg = error.error;
        } else if (error.error && error.error.message) {
          errorMsg = error.error.message;
        } else if (error.message) {
          errorMsg = error.message;
        }
        
        if (error.status === 401) {
          errorMsg = 'Identifiants incorrects. Veuillez vérifier votre nom d\'utilisateur/email et votre mot de passe.';
        } else if (error.status === 403) {
          errorMsg = 'Votre compte n\'a pas encore été activé par un administrateur.';
        } else if (error.status === 0) {
          errorMsg = 'Impossible de se connecter au serveur. Vérifiez que le backend est en cours d\'exécution.';
        }
        
        return throwError(() => new Error(errorMsg));
      })
    );
  }

  /**
   * Inscrit un nouvel utilisateur
   */
  register(userData: RegisterRequest): Observable<AuthResponse> {
    const registerUrl = `${this.apiUrl}/signup`;
    
    console.log(`AuthService: Sending registration request to ${registerUrl}`);
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
    
    return this.http.post<AuthResponse>(registerUrl, userData, { headers }).pipe(
      tap(response => {
        console.log('AuthService: Registration response:', response);
        
        if (response && response.accessToken) {
          localStorage.setItem('authToken', response.accessToken);
          this.loadUserFromToken();
        }
      }),
      catchError(error => {
        console.error('AuthService: Registration error:', error);
        
        let errorMsg = 'Erreur lors de l\'inscription';
        
        if (error.error && typeof error.error === 'string') {
          errorMsg = error.error;
        } else if (error.error && error.error.message) {
          errorMsg = error.error.message;
        } else if (error.message) {
          errorMsg = error.message;
        }
        
        if (error.status === 400) {
          errorMsg = 'Les informations fournies sont invalides. Vérifiez que le nom d\'utilisateur et l\'email ne sont pas déjà utilisés.';
        } else if (error.status === 0) {
          errorMsg = 'Impossible de se connecter au serveur. Vérifiez que le backend est en cours d\'exécution.';
        }
        
        return throwError(() => new Error(errorMsg));
      })
    );
  }

  /**
   * Récupère la liste des utilisateurs (admin seulement)
   */
  getUsers(): Observable<User[]> {
    const url = `${this.apiUrl}/users`;
    
    return this.http.get<User[]>(url, { 
      headers: this.getAuthHeaders() 
    }).pipe(
      catchError(error => {
        console.error('Error fetching users:', error);
        return throwError(() => new Error('Impossible de récupérer la liste des utilisateurs'));
      })
    );
  }

  /**
   * Active ou désactive un utilisateur (admin seulement)
   */
  updateUserStatus(userId: string, active: boolean): Observable<any> {
    const url = `${this.apiUrl}/users/${userId}/status`;
    
    return this.http.put(url, { active }, { 
      headers: this.getAuthHeaders() 
    }).pipe(
      catchError(error => {
        console.error('Error updating user status:', error);
        return throwError(() => new Error('Impossible de mettre à jour le statut de l\'utilisateur'));
      })
    );
  }

  /**
   * Met à jour les rôles d'un utilisateur (admin seulement)
   */
  updateUserRoles(userId: string, roles: string[]): Observable<any> {
    const url = `${this.apiUrl}/users/${userId}/roles`;
    
    return this.http.put(url, { roles }, { 
      headers: this.getAuthHeaders() 
    }).pipe(
      catchError(error => {
        console.error('Error updating user roles:', error);
        return throwError(() => new Error('Impossible de mettre à jour les rôles de l\'utilisateur'));
      })
    );
  }

  /**
   * Supprime un utilisateur (admin seulement)
   */
  deleteUser(userId: string): Observable<any> {
    const url = `${this.apiUrl}/users/${userId}`;
    
    return this.http.delete(url, { 
      headers: this.getAuthHeaders() 
    }).pipe(
      catchError(error => {
        console.error('Error deleting user:', error);
        return throwError(() => new Error('Impossible de supprimer l\'utilisateur'));
      })
    );
  }

  /**
   * Récupère le token JWT stocké
   */
  getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  /**
   * Déconnecte l'utilisateur
   */
  logout(): void {
    localStorage.removeItem('authToken');
    this.currentUser = null;
    this.router.navigate(['/auth/login']);
    console.log('AuthService: Utilisateur déconnecté');
  }

  /**
   * Vérifie si l'utilisateur est connecté
   */
  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    try {
      const decodedToken = this.decodeToken(token);
      const expirationDate = new Date(decodedToken.exp * 1000);
      return expirationDate > new Date();
    } catch (error) {
      console.error('Erreur lors de la vérification du token:', error);
      return false;
    }
  }
  
  /**
   * Récupère l'utilisateur courant
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }
  
  /**
   * Récupère les rôles de l'utilisateur courant
   */
  getUserRoles(): string[] {
    return this.currentUser?.roles || [];
  }
  
  /**
   * Vérifie si l'utilisateur a un rôle spécifique
   */
  hasRole(role: string): boolean {
    return this.getUserRoles().includes(role);
  }
  
  /**
   * Décode un token JWT
   */
  private decodeToken(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Erreur lors du décodage du token:', error);
      return null;
    }
  }
  
  /**
   * Charge les informations utilisateur à partir du token JWT
   */
  private loadUserFromToken(): void {
    const token = this.getToken();
    if (!token) {
      this.currentUser = null;
      return;
    }
    
    try {
      const decodedToken = this.decodeToken(token);
      
      if (decodedToken) {
        this.currentUser = {
          id: decodedToken.sub || decodedToken.id,
          username: decodedToken.username || decodedToken.preferred_username,
          email: decodedToken.email,
          address: decodedToken.address,
          roles: decodedToken.roles || [],
          active: decodedToken.active !== undefined ? decodedToken.active : true
        };
      }
    } catch (error) {
      console.error('Erreur lors du décodage du token:', error);
      this.currentUser = null;
    }
  }

  /**
   * Récupère les en-têtes HTTP avec le token d'authentification
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }
}
