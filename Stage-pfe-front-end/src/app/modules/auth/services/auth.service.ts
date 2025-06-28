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
  status?: 'ACTIVE' | 'INACTIVE' | 'PENDING';
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
  // URL de l'API d'authentification - assurez-vous que ce port correspond à celui du microservice auth-service
  private apiUrl = 'http://localhost:8081/api/auth';
  // Mode de débogage pour afficher plus d'informations dans la console
  private debugMode = true;
  private currentUser: User | null = null;
  private simulationMode = false;
  // Mode simulation activé pour contourner les problèmes de backend

  constructor(
    private http: HttpClient, 
    private router: Router,
    // Injection du service de redirection est commentée pour l'instant car le service n'est pas encore créé
    // private roleRedirectService: RoleRedirectService
  ) {
    this.loadUserFromToken();
  }

  /**
   * Authentifie un utilisateur et stocke son token JWT
   */
  login(credentials: LoginRequest): Observable<AuthResponse> {
    console.log('AuthService: Tentative de connexion avec:', credentials.usernameOrEmail);
    
    if (this.simulationMode) {
      return this.simulateLogin(credentials);
    }
    
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap((response: AuthResponse) => {
          console.log('AuthService: Login response:', response);
          
          // Débogage complet de la réponse pour comprendre sa structure
          console.log('AuthService: Structure complète de la réponse:', JSON.stringify(response));
          
          // Vérification du statut d'activation - approche plus robuste
          let isInactive = false;
          let inactiveReason = '';
          
          // Cas 1: Vérification explicite de active === false
          if (response.user && response.user.active === false) {
            console.log('AuthService: Utilisateur inactif détecté (active=false)');
            isInactive = true;
            inactiveReason = 'Votre compte n\'a pas encore été activé par un administrateur.';
          }
          
          // Cas 2: Vérification du statut explicite
          if (!isInactive && response.user && response.user.status) {
            if (response.user.status === 'INACTIVE') {
              console.log('AuthService: Utilisateur avec statut INACTIVE');
              isInactive = true;
              inactiveReason = 'Votre compte a été désactivé par un administrateur.';
            } else if (response.user.status === 'PENDING') {
              console.log('AuthService: Utilisateur avec statut PENDING');
              isInactive = true;
              inactiveReason = 'Votre compte est en attente d\'approbation par un administrateur.';
            }
          }
          
          // Si l'utilisateur est inactif, rediriger et arrêter le processus
          if (isInactive) {
            console.log('AuthService: Redirection vers la page d\'attente d\'approbation');
            this.router.navigate(['/auth/inactive-account']);
            throw new Error(inactiveReason + ' Veuillez patienter ou contacter un administrateur.');
          }
          
          // Si tout est OK, continuer le processus de connexion
          console.log('AuthService: Utilisateur actif, continuation du processus de connexion');
          this.setToken(response.accessToken);
          
          // Vérification supplémentaire lors du chargement des données utilisateur
          try {
            this.loadUserFromToken();
            console.log('AuthService: Utilisateur connecté:', this.currentUser);
            console.log('AuthService: Rôles de l\'utilisateur après connexion:', this.getUserRoles());
          } catch (e) {
            console.error('AuthService: Erreur lors du chargement des données utilisateur:', e);
            this.logout();
            throw new Error('Erreur lors du chargement des données utilisateur. Veuillez réessayer.');
          }
        }),
        catchError(error => {
          console.error('AuthService: Login error:', error);
          
          // Gestion spécifique des erreurs 403 (compte inactif)
          if (error.status === 403) {
            console.log('AuthService: Erreur 403 détectée - compte inactif');
            this.router.navigate(['/auth/inactive-account']);
            return throwError(() => new Error('Votre compte n\'a pas encore été activé par un administrateur. Veuillez patienter.'));
          }
          
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
            roles: userData.roles || ['ACHETEUR'],
            active: false // Tous les utilisateurs doivent être activés par un admin
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
   * Récupère le nom d'utilisateur de l'utilisateur connecté
   * @returns Le nom d'utilisateur ou null si non connecté
   */
  getUsername(): string | null {
    return this.currentUser ? this.currentUser.username : null;
  }
  
  /**
   * Récupère l'email de l'utilisateur connecté
   * @returns L'email ou null si non connecté
   */
  getEmail(): string | null {
    return this.currentUser ? this.currentUser.email : null;
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
        // Débogage complet du token pour comprendre sa structure
        console.log('AuthService: Structure complète du token décodé:', JSON.stringify(decodedToken));
        console.log('Token décodé - propriété active:', decodedToken.active);
        console.log('Type de la propriété active:', typeof decodedToken.active);
        
        // Vérification du statut d'activation - approche plus robuste
        let isInactive = false;
        let inactiveReason = '';
        
        // Récupérer les propriétés de statut
        const userActive = decodedToken.active;
        const userStatus = decodedToken.status;
        
        console.log('AuthService: Vérification du statut utilisateur dans le token:');
        console.log('- Propriété active:', userActive);
        console.log('- Propriété status:', userStatus);
        
        // Cas 1: L'utilisateur est explicitement inactif (active=false)
        if (userActive === false) {
          console.log('AuthService: Utilisateur explicitement inactif (active=false)');
          isInactive = true;
          inactiveReason = 'Votre compte n\'a pas encore été activé par un administrateur';
        }
        
        // Cas 2: L'utilisateur a un statut INACTIVE ou PENDING
        if (!isInactive && userStatus) {
          if (userStatus === 'INACTIVE') {
            console.log('AuthService: Utilisateur avec statut INACTIVE');
            isInactive = true;
            inactiveReason = 'Votre compte a été désactivé par un administrateur';
          } else if (userStatus === 'PENDING') {
            console.log('AuthService: Utilisateur avec statut PENDING');
            isInactive = true;
            inactiveReason = 'Votre compte est en attente d\'approbation par un administrateur';
          }
        }
        
        // Cas 3: L'utilisateur n'est pas explicitement actif
        if (!isInactive && userActive !== true && (!userStatus || userStatus !== 'ACTIVE')) {
          console.log('AuthService: Utilisateur avec statut non clairement actif');
          console.log('- active:', userActive);
          console.log('- status:', userStatus);
          isInactive = true;
          inactiveReason = 'Votre compte n\'est pas actif';
        }
        
        // Si l'utilisateur est inactif, déconnecter et rediriger
        if (isInactive) {
          console.log('AuthService: Utilisateur inactif détecté -', inactiveReason);
          this.logout(); // Supprimer le token
          this.router.navigate(['/auth/inactive-account']);
          return;
        }
        
        // Si l'utilisateur est actif, continuer normalement
        console.log('AuthService: Utilisateur actif confirmé, chargement des données utilisateur');
        
        // Normaliser les rôles
        let roles = [];
        if (Array.isArray(decodedToken.roles)) {
          roles = decodedToken.roles.map((role: string) => this.normalizeRoleForDisplay(role));
        } else if (typeof decodedToken.roles === 'string') {
          roles = [this.normalizeRoleForDisplay(decodedToken.roles)];
        }
        
        // Vérifier si l'utilisateur a le rôle ACHETEUR ou CLIENT
        const hasAcheteurRole = roles.some((role: string) => 
          role === 'ACHETEUR' || role === 'ROLE_ACHETEUR' || 
          role === 'CLIENT' || role === 'ROLE_CLIENT');
        
        // Si l'utilisateur a un de ces rôles, s'assurer qu'il a les deux
        if (hasAcheteurRole) {
          if (!roles.includes('ACHETEUR')) roles.push('ACHETEUR');
          if (!roles.includes('CLIENT')) roles.push('CLIENT');
        }
        
        // Vérifier si l'utilisateur est un vendeur
        const hasVendeurRole = roles.some((role: string) => 
          role === 'VENDEUR' || role === 'ROLE_VENDEUR');
        
        if (hasVendeurRole) {
          console.log('Utilisateur avec rôle VENDEUR détecté');
        }
        
        // Tous les utilisateurs doivent être explicitement activés
        const isActive = decodedToken.active === true;
        console.log('État d\'activation calculé pour l\'utilisateur:', isActive);
        
        // Si l'utilisateur n'est pas explicitement actif, le déconnecter
        if (!isActive) {
          console.log('AuthService: Utilisateur non explicitement actif, déconnexion');
          this.logout();
          this.router.navigate(['/auth/inactive-account']);
          return;
        }
        
        this.currentUser = {
          id: decodedToken.sub || decodedToken.id,
          username: decodedToken.username || decodedToken.preferred_username,
          email: decodedToken.email,
          address: decodedToken.address,
          roles: roles,
          active: isActive
        };
        
        console.log('AuthService: Utilisateur chargé avec succès:', this.currentUser);
        console.log('AuthService: Rôles de l\'utilisateur:', this.currentUser.roles);
        console.log('AuthService: État d\'activation de l\'utilisateur:', this.currentUser.active);
      } else {
        console.log('AuthService: Token décodé est null ou invalide');
        this.logout(); // Token invalide, déconnecter l'utilisateur
      }
    } catch (error) {
      console.error('Erreur lors du décodage du token:', error);
      this.currentUser = null;
      this.logout(); // Erreur de décodage, déconnecter l'utilisateur
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
      { username: 'acheteur', email: 'acheteur@example.com', password: 'password', roles: ['ACHETEUR'], active: true },
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
   * Détermine l'URL de redirection par défaut en fonction du rôle de l'utilisateur
   */
  getDefaultRedirectUrl(): string {
    // Vérifier si l'utilisateur est connecté
    if (!this.isLoggedIn()) {
      return '/auth/login';
    }
    
    // Récupérer l'utilisateur actuel et ses rôles
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      return '/auth/login';
    }
    
    // Vérifier si l'utilisateur est actif - pour TOUS les utilisateurs
    if (currentUser.active === false) {
      console.log('Utilisateur inactif détecté dans getDefaultRedirectUrl, redirection vers page inactive');
      return '/auth/inactive-account';
    }
    
    // Si l'utilisateur n'a pas la propriété active explicitement définie à true, le considérer comme inactif
    if (currentUser.active !== true) {
      console.log('État d\'activation de l\'utilisateur non confirmé, redirection vers page inactive');
      return '/auth/inactive-account';
    }
    
    // Vérifier les rôles et rediriger en conséquence
    if (this.hasRole('ADMIN')) {
      return '/admin/dashboard';
    } else if (this.hasRole('VENDEUR')) {
      return '/vendor-dashboard';
    } else if (this.hasRole('FOURNISSEUR')) {
      return '/fournisseur/commandes';
    } else if (this.hasRole('ACHAT')) {
      return '/achat/commandes';
    } else if (this.hasRole('MAGASINIER')) {
      return '/stock/dashboard';
    } else if (this.hasRole('CLIENT')) {
      return '/acheteur/dashboard';
    } else {
      return '/caisse';
    }
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
      { username: 'acheteur', email: 'acheteur@example.com' }
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
      roles: userData.roles || ['ACHETEUR'],
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
        roles: userData.roles || ['ACHETEUR'],
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
