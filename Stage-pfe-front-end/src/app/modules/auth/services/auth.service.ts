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
  roles?: string[]; // Modifié pour correspondre au format attendu par le backend
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
  private simulationMode = false; // Mode simulation pour développement sans backend

  constructor(private http: HttpClient, private router: Router) {
    this.loadUserFromToken();
  }

  /**
   * Authentifie un utilisateur et stocke son token JWT
   */
  login(credentials: LoginRequest): Observable<AuthResponse> {
    if (this.simulationMode) {
      return this.simulateLogin(credentials);
    }
    
    console.log('AuthService: Sending login request to', `${this.apiUrl}/login`);
    console.log('AuthService: Login credentials:', credentials);
    
    // Effacer complètement les données d'authentification précédentes
    this.logout();
    
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap((response: AuthResponse) => {
          console.log('AuthService: Login response:', response);
          this.setToken(response.accessToken);
          this.loadUserFromToken();
          
          // Log détaillé des rôles après connexion
          console.log('AuthService: Utilisateur connecté:', this.currentUser);
          console.log('AuthService: Rôles de l\'utilisateur après connexion:', this.getUserRoles());
        }),
        catchError(error => {
          console.error('AuthService: Login error:', error);
          return throwError(() => new Error(this.formatErrorMessage(error)));
        })
      );
  }

  /**
   * Inscrit un nouvel utilisateur
   */
  register(userData: RegisterRequest): Observable<AuthResponse> {
    if (this.simulationMode) {
      return this.simulateRegister(userData);
    }
    
    const registerUrl = `${this.apiUrl}/signup`;
    
    console.log(`AuthService: Sending registration request to ${registerUrl}`);
    console.log('AuthService: Registration data:', userData);
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
    
    // Le backend renvoie un message de succès au lieu d'un token pour l'inscription
    // Nous devons donc adapter la réponse pour qu'elle corresponde au format attendu
    return this.http.post(registerUrl, userData, { 
      headers,
      observe: 'response',
      responseType: 'text' // Le backend renvoie du texte, pas du JSON
    }).pipe(
      map(response => {
        // Créer une réponse simulée pour correspondre au format attendu
        // Nous ne stockons pas de token car l'utilisateur devra se connecter après l'inscription
        const authResponse: AuthResponse = {
          accessToken: '',
          tokenType: 'Bearer',
          user: {
            id: '',
            username: userData.username,
            email: userData.email,
            address: userData.address,
            roles: userData.roles || ['CLIENT'],
            active: userData.roles && userData.roles.includes('VENDEUR') ? false : true // Les vendeurs doivent être activés par un admin
          }
        };
        return authResponse;
      }),
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
        } else if (error.name === 'HttpErrorResponse' && error.message.includes('Http failure during parsing')) {
          // Erreur spécifique de parsing de la réponse HTTP
          errorMsg = 'Le serveur a répondu dans un format inattendu. Vérifiez que le backend est correctement configuré pour renvoyer du JSON.';
          console.error('Réponse brute du serveur:', error.error?.text || 'Non disponible');
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
   * Stocke le token JWT
   */
  setToken(token: string): void {
    localStorage.setItem('authToken', token);
  }

  /**
   * Déconnecte l'utilisateur
   */
  logout(): void {
    console.log('AuthService: Déconnexion de l\'utilisateur');
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('authToken'); // Nettoyer aussi sessionStorage au cas où
    this.currentUser = null;
    
    // Forcer le navigateur à vider le cache des requêtes
    if (window.caches) {
      console.log('AuthService: Nettoyage du cache des requêtes');
      try {
        caches.keys().then(keyList => {
          return Promise.all(keyList.map(key => {
            return caches.delete(key);
          }));
        });
      } catch (e) {
        console.error('AuthService: Erreur lors du nettoyage du cache', e);
      }
    }
    
    // Redirection vers la page de connexion
    this.router.navigate(['/auth/login']);
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
   * @param normalized Si true, normalise les rôles (supprime le préfixe ROLE_ et convertit en majuscules)
   */
  getUserRoles(normalized: boolean = false): string[] {
    const roles = this.currentUser?.roles || [];
    
    if (normalized) {
      return roles.map(role => this.normalizeRoleForComparison(role));
    }
    
    return roles;
  }
  
  /**
   * Normalise un rôle pour l'affichage (supprime le préfixe ROLE_ si présent)
   */
  private normalizeRoleForDisplay(role: string): string {
    return typeof role === 'string' && role.startsWith('ROLE_') ? role.substring(5) : role;
  }
  
  /**
   * Normalise un rôle pour la comparaison (supprime le préfixe ROLE_ si présent et convertit en majuscules)
   */
  private normalizeRoleForComparison(role: string): string {
    return typeof role === 'string' ? role.replace('ROLE_', '').toUpperCase() : '';
  }
  
  /**
   * Vérifie si l'utilisateur a un rôle spécifique
   */
  hasRole(role: string): boolean {
    // Normaliser le rôle recherché (supprimer le préfixe ROLE_ si présent)
    const normalizedRole = this.normalizeRoleForComparison(role);
    
    // Obtenir les rôles normalisés de l'utilisateur
    const normalizedUserRoles = this.getUserRoles(true);
    
    console.log('AuthService: Vérification du rôle:', {
      roleRecherche: role,
      roleNormalise: normalizedRole,
      rolesUtilisateur: this.getUserRoles(),
      rolesUtilisateurNormalises: normalizedUserRoles,
      resultat: normalizedUserRoles.includes(normalizedRole)
    });
    
    return normalizedUserRoles.includes(normalizedRole);
  }
  
  /**
   * Formate un message d'erreur à partir d'une erreur HTTP
   */
  formatErrorMessage(error: any): string {
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
    
    return errorMsg;
  }
  
  /**
   * Décode un token JWT
   */
  private decodeToken(token: string): any {
    try {
      console.log('AuthService: Décodage du token JWT:', token);
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const decodedToken = JSON.parse(jsonPayload);
      console.log('AuthService: Token décodé:', decodedToken);
      console.log('AuthService: Rôles dans le token:', decodedToken.roles);
      console.log('AuthService: Type des rôles dans le token:', typeof decodedToken.roles);
      console.log('AuthService: Est-ce que les rôles sont un tableau?', Array.isArray(decodedToken.roles));
      
      if (Array.isArray(decodedToken.roles)) {
        console.log('AuthService: Contenu du tableau des rôles:', decodedToken.roles);
        console.log('AuthService: Le rôle ADMIN est-il présent?', decodedToken.roles.includes('ADMIN'));
        console.log('AuthService: Le rôle ROLE_ADMIN est-il présent?', decodedToken.roles.includes('ROLE_ADMIN'));
      }
      return decodedToken;
    } catch (error) {
      console.error('Erreur lors du décodage du token:', error);
      return null;
    }
  }
  
  /**
   * Charge les informations utilisateur à partir du token JWT
   */
  public loadUserFromToken(): void {
    const token = this.getToken();
    if (!token) {
      this.currentUser = null;
      console.log('AuthService: Aucun token trouvé');
      return;
    }
    
    try {
      console.log('AuthService: Chargement des informations utilisateur à partir du token');
      const decodedToken = this.decodeToken(token);
      
      if (decodedToken) {
        this.currentUser = {
          id: decodedToken.sub || decodedToken.id,
          username: decodedToken.username || decodedToken.preferred_username,
          email: decodedToken.email,
          address: decodedToken.address,
          roles: Array.isArray(decodedToken.roles) 
            ? decodedToken.roles.map((role: string) => this.normalizeRoleForDisplay(role)) 
            : (typeof decodedToken.roles === 'string' ? [this.normalizeRoleForDisplay(decodedToken.roles)] : []),
          active: decodedToken.active !== undefined ? decodedToken.active : true
        };
        console.log('AuthService: Utilisateur chargé avec succès:', this.currentUser);
        console.log('AuthService: Rôles de l\'utilisateur:', this.currentUser.roles);
      } else {
        console.log('AuthService: Token décodé est null ou invalide');
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

  /**
   * Simule une connexion utilisateur (mode développement sans backend)
   */
  private simulateLogin(credentials: LoginRequest): Observable<AuthResponse> {
    console.log('AuthService: Simulation du login', credentials);
    
    // Liste d'utilisateurs simulés pour le développement
    const users = [
      { username: 'admin', email: 'admin@example.com', password: 'password', roles: ['ADMIN'], active: true },
      { username: 'vendeur', email: 'vendeur@example.com', password: 'password', roles: ['VENDEUR'], active: true },
      { username: 'client', email: 'client@example.com', password: 'password', roles: ['CLIENT'], active: true },
      { username: 'inactive', email: 'inactive@example.com', password: 'password', roles: ['VENDEUR'], active: false }
    ];
    
    // Recherche de l'utilisateur par nom d'utilisateur ou email
    const user = users.find(u => 
      u.username === credentials.usernameOrEmail || 
      u.email === credentials.usernameOrEmail
    );
    
    // Vérification des identifiants
    if (!user) {
      return throwError(() => new Error('Identifiants incorrects. Utilisateur non trouvé.'));
    }
    
    if (user.password !== credentials.password) {
      return throwError(() => new Error('Identifiants incorrects. Mot de passe invalide.'));
    }
    
    if (!user.active) {
      return throwError(() => new Error('Votre compte n\'a pas encore été activé par un administrateur.'));
    }
    
    // Création d'un token JWT simulé
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: '123e4567-e89b-12d3-a456-' + Math.floor(Math.random() * 1000000),
      username: user.username,
      email: user.email,
      roles: user.roles,
      active: user.active,
      iat: now,
      exp: now + 3600 // Expiration dans 1 heure
    };
    
    // Encodage du token (simulation simplifiée)
    const base64Payload = btoa(JSON.stringify(payload));
    const fakeToken = `header.${base64Payload}.signature`;
    
    // Création de la réponse
    const response: AuthResponse = {
      accessToken: fakeToken,
      tokenType: 'Bearer',
      user: {
        id: payload.sub,
        username: user.username,
        email: user.email,
        roles: user.roles,
        active: user.active
      }
    };
    
    // Simulation d'un délai réseau
    return of(response).pipe(
      delay(800),
      tap(res => {
        localStorage.setItem('authToken', res.accessToken);
        this.loadUserFromToken();
      })
    );
  }

  /**
   * Simule l'inscription d'un utilisateur (mode développement sans backend)
   */
  private simulateRegister(userData: RegisterRequest): Observable<AuthResponse> {
    console.log('AuthService: Simulation de l\'inscription', userData);
    
    // Vérification de l'unicité du nom d'utilisateur et de l'email
    const existingUsers = [
      { username: 'admin', email: 'admin@example.com' },
      { username: 'vendeur', email: 'vendeur@example.com' },
      { username: 'client', email: 'client@example.com' }
    ];
    
    if (existingUsers.some(u => u.username === userData.username)) {
      return throwError(() => new Error('Ce nom d\'utilisateur est déjà utilisé.'));
    }
    
    if (existingUsers.some(u => u.email === userData.email)) {
      return throwError(() => new Error('Cette adresse email est déjà utilisée.'));
    }
    
    // Détermination du statut actif en fonction du rôle
    const isActive = !(userData.roles && userData.roles.includes('VENDEUR')); // Les vendeurs doivent être activés par un admin
    
    // Création d'un token JWT simulé
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: '123e4567-e89b-12d3-a456-' + Math.floor(Math.random() * 1000000),
      username: userData.username,
      email: userData.email,
      address: userData.address,
      roles: userData.roles || ['CLIENT'],
      active: isActive,
      iat: now,
      exp: now + 3600 // Expiration dans 1 heure
    };
    
    // Encodage du token (simulation simplifiée)
    const base64Payload = btoa(JSON.stringify(payload));
    const fakeToken = `header.${base64Payload}.signature`;
    
    // Création de la réponse
    const response: AuthResponse = {
      accessToken: fakeToken,
      tokenType: 'Bearer',
      user: {
        id: payload.sub,
        username: userData.username,
        email: userData.email,
        address: userData.address,
        roles: userData.roles || ['CLIENT'],
        active: isActive
      }
    };
    
    // Si c'est un vendeur, on ne stocke pas le token (car il doit être activé)
    if (userData.roles && userData.roles.includes('VENDEUR') && !isActive) {
      return of(response).pipe(
        delay(800),
        map(res => ({
          ...res,
          accessToken: '' // Pas de token pour les vendeurs non activés
        }))
      );
    }
    
    // Simulation d'un délai réseau
    return of(response).pipe(
      delay(800),
      tap(res => {
        localStorage.setItem('authToken', res.accessToken);
        this.loadUserFromToken();
      })
    );
  }
}
