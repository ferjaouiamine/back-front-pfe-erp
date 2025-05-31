import { Component, OnInit } from '@angular/core';
import { AuthDebugService } from '../../services/auth-debug.service';
import { AuthService, LoginRequest } from '../../services/auth.service';

@Component({
  selector: 'app-auth-debug',
  templateUrl: './auth-debug.component.html',
  styleUrls: ['./auth-debug.component.scss']
})
export class AuthDebugComponent implements OnInit {
  userRoles: any[] = [];
  authTest: any = null;
  adminTest: any = null;
  adminAuthorityTest: any = null;
  
  // Propriétés pour le test de connexion directe
  loginCredentials: LoginRequest = {
    usernameOrEmail: '',
    password: ''
  };
  loginResult: {
    success: boolean;
    message: string;
    token?: string;
    decodedToken?: any;
  } | null = null;
  
  isLoading = false;
  errorMessage: string | null = null;
  
  constructor(
    private authDebugService: AuthDebugService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.loadUserRoles();
  }
  
  loadUserRoles(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    this.authDebugService.getUserRoles().subscribe({
      next: (data) => {
        this.userRoles = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors de la récupération des rôles:', error);
        this.errorMessage = `Erreur lors de la récupération des rôles: ${error.message}`;
        this.isLoading = false;
      }
    });
  }
  
  testAuth(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    this.authDebugService.testAuth().subscribe({
      next: (data) => {
        this.authTest = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du test d\'authentification:', error);
        this.errorMessage = `Erreur lors du test d'authentification: ${error.message}`;
        this.isLoading = false;
      }
    });
  }
  
  testAdminAccess(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    this.authDebugService.testAdminAccess().subscribe({
      next: (data) => {
        this.adminTest = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du test d\'accès admin:', error);
        this.errorMessage = `Erreur lors du test d'accès admin: ${error.message}`;
        this.isLoading = false;
        this.adminTest = { error: error.status, message: error.error?.message || error.statusText };
      }
    });
  }
  
  testAdminAuthorityAccess(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    this.authDebugService.testAdminAuthorityAccess().subscribe({
      next: (data) => {
        this.adminAuthorityTest = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du test d\'accès avec autorité admin:', error);
        this.errorMessage = `Erreur lors du test d'accès avec autorité admin: ${error.message}`;
        this.isLoading = false;
        this.adminAuthorityTest = { error: error.status, message: error.error?.message || error.statusText };
      }
    });
  }
  
  getCurrentUserInfo(): any {
    return {
      username: this.authService.getCurrentUser()?.username,
      roles: this.authService.getUserRoles(),
      normalizedRoles: this.authService.getUserRoles(true),
      token: this.authService.getToken()
    };
  }
  
  /**
   * Teste la connexion directe avec les identifiants fournis
   */
  testLogin(): void {
    if (!this.loginCredentials.usernameOrEmail || !this.loginCredentials.password) {
      this.errorMessage = 'Veuillez remplir tous les champs';
      return;
    }
    
    this.isLoading = true;
    this.errorMessage = null;
    
    this.authService.login(this.loginCredentials).subscribe({
      next: (response) => {
        this.isLoading = false;
        
        // Décoder le token pour affichage
        let decodedToken = null;
        try {
          if (response.accessToken) {
            // Décoder le token JWT (partie payload)
            const tokenParts = response.accessToken.split('.');
            if (tokenParts.length === 3) {
              const payload = tokenParts[1];
              const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
              const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
              }).join(''));
              decodedToken = JSON.parse(jsonPayload);
            }
          }
        } catch (e) {
          console.error('Erreur lors du décodage du token:', e);
        }
        
        this.loginResult = {
          success: true,
          message: 'Connexion réussie!',
          token: response.accessToken,
          decodedToken: decodedToken
        };
        
        // Recharger les informations utilisateur
        this.authService.loadUserFromToken();
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Erreur de connexion:', error);
        
        this.loginResult = {
          success: false,
          message: error.message || 'Erreur de connexion'
        };
        
        if (error.status === 0) {
          this.loginResult.message = 'Impossible de se connecter au serveur d\'authentification. Vérifiez que le service est démarré et accessible.';
        } else if (error.status === 401) {
          this.loginResult.message = 'Identifiants incorrects. Vérifiez votre nom d\'utilisateur/email et votre mot de passe.';
        } else if (error.status === 403) {
          this.loginResult.message = 'Accès refusé. Votre compte pourrait ne pas être activé.';
        }
      }
    });
  }
  
  /**
   * Copie le texte dans le presse-papiers
   */
  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      // Afficher une notification de succès (optionnel)
      alert('Token copié dans le presse-papiers!');
    }, (err) => {
      console.error('Erreur lors de la copie dans le presse-papiers:', err);
    });
  }
}
