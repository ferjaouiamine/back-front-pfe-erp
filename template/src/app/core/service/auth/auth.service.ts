import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap } from 'rxjs';
import { Router } from '@angular/router';

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface JwtAuthenticationResponse {
  accessToken: string;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
  roles?: string[];
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  roles: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<UserProfile | null>;
  public currentUser: Observable<UserProfile | null>;

  // URL de l'API backend
  private apiUrl = 'http://localhost:8080/api/auth';

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Récupérer l'utilisateur du localStorage au démarrage
    const storedUser = localStorage.getItem('currentUser');
    this.currentUserSubject = new BehaviorSubject<UserProfile | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): UserProfile | null {
    return this.currentUserSubject.value;
  }

  // Méthode de connexion (simulée pour développement frontend)
  login(loginRequest: LoginRequest): Observable<JwtAuthenticationResponse> {
    // Mode simulation - commentez ce bloc et décommentez le bloc original quand le backend sera prêt
    console.log('Mode simulation: connexion utilisateur', loginRequest);
    
    // Simuler un token JWT
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTIzLCJzdWIiOiJ0ZXN0dXNlciIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGVzIjpbXX0.8Wr4OxLVp0AJXs_L88Ns1OB_LL0Q_RgBbM4UIPz1ob0';
    
    // Si la connexion contient le mot "admin", on ajoute le rôle ADMIN
    const isAdmin = loginRequest.usernameOrEmail.toLowerCase().includes('admin');
    const mockUser: UserProfile = {
      id: 123,
      username: loginRequest.usernameOrEmail,
      email: loginRequest.usernameOrEmail.includes('@') ? loginRequest.usernameOrEmail : loginRequest.usernameOrEmail + '@example.com',
      roles: isAdmin ? ['ROLE_USER', 'ROLE_ADMIN'] : ['ROLE_USER']
    };
    
    // Stocker les informations simulées
    localStorage.setItem('token', mockToken);
    localStorage.setItem('currentUser', JSON.stringify(mockUser));
    
    // Mettre à jour le BehaviorSubject
    this.currentUserSubject.next(mockUser);
    
    return of({ accessToken: mockToken });
    
    // Code original - à décommenter quand le backend sera fonctionnel
    /*
    return this.http.post<JwtAuthenticationResponse>(`${this.apiUrl}/login`, loginRequest)
      .pipe(tap(response => {
        if (response.accessToken) {
          // Stocker le token JWT
          localStorage.setItem('token', response.accessToken);
          
          // Décoder le token pour extraire les informations utilisateur
          const userInfo = this.parseJwt(response.accessToken);
          
          // Créer l'objet utilisateur
          const user: UserProfile = {
            id: userInfo.id,
            username: userInfo.sub,
            email: userInfo.email,
            roles: userInfo.roles
          };
          
          // Stocker l'utilisateur dans le localStorage
          localStorage.setItem('currentUser', JSON.stringify(user));
          
          // Mettre à jour le BehaviorSubject
          this.currentUserSubject.next(user);
        }
      }));
    */
  }

  // Méthode d'inscription (simulée pour développement frontend)
  register(signupRequest: SignupRequest): Observable<any> {
    // Mode simulation - commentez ce bloc et décommentez la ligne original quand le backend sera prêt
    console.log('Mode simulation: inscription utilisateur', signupRequest);
    
    // Simuler une réponse réussie
    return of({ 
      success: true, 
      message: 'Utilisateur enregistré avec succès! (Mode simulation)' 
    });
    
    // Code original - à décommenter quand le backend sera fonctionnel
    // return this.http.post<any>(`${this.apiUrl}/signup`, signupRequest);
  }

  // Méthode de déconnexion
  logout(): void {
    // Supprimer les données utilisateur du localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    
    // Mettre à jour le BehaviorSubject
    this.currentUserSubject.next(null);
    
    // Rediriger vers la page de connexion
    this.router.navigate(['/auth/signin']);
  }

  // Vérifier si l'utilisateur est connecté
  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  // Vérifier si l'utilisateur a un rôle spécifique
  hasRole(role: string): boolean {
    const user = this.currentUserValue;
    if (!user || !user.roles) return false;
    return user.roles.includes(`ROLE_${role}`) || user.roles.includes(role);
  }

  // Vérifier si l'utilisateur est un administrateur
  isAdmin(): boolean {
    return this.hasRole('ADMIN');
  }

  // Obtenir le token JWT
  getToken(): string | null {
    return localStorage.getItem('token');
  }

  // Décoder le token JWT
  private parseJwt(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }
}
