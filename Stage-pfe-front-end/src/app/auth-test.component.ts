import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService, User } from './modules/auth/services/auth.service';

@Component({
  selector: 'app-auth-test',
  template: `
    <div class="container mt-5">
      <h2>Test d'authentification et de rôles</h2>
      
      <div class="card mb-4">
        <div class="card-header bg-primary text-white">
          <h3>1. Inscription utilisateur</h3>
        </div>
        <div class="card-body">
          <div class="form-group mb-3">
            <label for="username">Nom d'utilisateur</label>
            <input type="text" id="username" class="form-control" [(ngModel)]="registerData.username">
          </div>
          <div class="form-group mb-3">
            <label for="email">Email</label>
            <input type="email" id="email" class="form-control" [(ngModel)]="registerData.email">
          </div>
          <div class="form-group mb-3">
            <label for="password">Mot de passe</label>
            <input type="password" id="password" class="form-control" [(ngModel)]="registerData.password">
          </div>
          <div class="form-group mb-3">
            <label for="address">Adresse</label>
            <input type="text" id="address" class="form-control" [(ngModel)]="registerData.address">
          </div>
          <div class="form-group mb-3">
            <label>Rôle</label>
            <div class="form-check">
              <input class="form-check-input" type="radio" name="role" id="roleAdmin" value="ADMIN" [(ngModel)]="selectedRole">
              <label class="form-check-label" for="roleAdmin">ADMIN</label>
            </div>
            <div class="form-check">
              <input class="form-check-input" type="radio" name="role" id="roleVendeur" value="VENDEUR" [(ngModel)]="selectedRole">
              <label class="form-check-label" for="roleVendeur">VENDEUR</label>
            </div>
            <div class="form-check">
              <input class="form-check-input" type="radio" name="role" id="roleClient" value="CLIENT" [(ngModel)]="selectedRole">
              <label class="form-check-label" for="roleClient">CLIENT</label>
            </div>
          </div>
          <button class="btn btn-primary" (click)="register()">S'inscrire</button>
          <div *ngIf="registerResponse" class="mt-3">
            <h4>Réponse d'inscription:</h4>
            <pre class="bg-light p-3">{{ registerResponse | json }}</pre>
          </div>
          <div *ngIf="registerError" class="alert alert-danger mt-3">
            {{ registerError }}
          </div>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-header bg-success text-white">
          <h3>2. Connexion utilisateur</h3>
        </div>
        <div class="card-body">
          <div class="form-group mb-3">
            <label for="loginUsername">Nom d'utilisateur ou Email</label>
            <input type="text" id="loginUsername" class="form-control" [(ngModel)]="loginData.usernameOrEmail">
          </div>
          <div class="form-group mb-3">
            <label for="loginPassword">Mot de passe</label>
            <input type="password" id="loginPassword" class="form-control" [(ngModel)]="loginData.password">
          </div>
          <button class="btn btn-success" (click)="login()">Se connecter</button>
          <div *ngIf="loginResponse" class="mt-3">
            <h4>Réponse de connexion:</h4>
            <pre class="bg-light p-3">{{ loginResponse | json }}</pre>
          </div>
          <div *ngIf="loginError" class="alert alert-danger mt-3">
            {{ loginError }}
          </div>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-header bg-info text-white">
          <h3>3. Informations utilisateur actuel</h3>
        </div>
        <div class="card-body">
          <button class="btn btn-info mb-3" (click)="checkCurrentUser()">Vérifier l'utilisateur actuel</button>
          <div *ngIf="currentUser">
            <h4>Utilisateur actuel:</h4>
            <pre class="bg-light p-3">{{ currentUser | json }}</pre>
            <h4>Rôles de l'utilisateur:</h4>
            <pre class="bg-light p-3">{{ userRoles | json }}</pre>
            <h4>Rôles normalisés:</h4>
            <pre class="bg-light p-3">{{ normalizedRoles | json }}</pre>
            <h4>Vérification des rôles:</h4>
            <div class="list-group">
              <div class="list-group-item">
                <strong>ADMIN:</strong> {{ hasAdminRole }}
              </div>
              <div class="list-group-item">
                <strong>VENDEUR:</strong> {{ hasVendeurRole }}
              </div>
              <div class="list-group-item">
                <strong>CLIENT:</strong> {{ hasClientRole }}
              </div>
            </div>
          </div>
          <div *ngIf="!currentUser" class="alert alert-warning">
            Aucun utilisateur connecté
          </div>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-header bg-warning text-dark">
          <h3>4. Décodage du token JWT</h3>
        </div>
        <div class="card-body">
          <div class="form-group mb-3">
            <label for="jwt">Token JWT</label>
            <textarea id="jwt" class="form-control" rows="5" [(ngModel)]="jwtToken"></textarea>
          </div>
          <button class="btn btn-warning" (click)="decodeToken()">Décoder le token</button>
          <div *ngIf="decodedToken" class="mt-3">
            <h4>Token décodé:</h4>
            <pre class="bg-light p-3">{{ decodedToken | json }}</pre>
          </div>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-header bg-danger text-white">
          <h3>5. Vérification directe de la base de données</h3>
        </div>
        <div class="card-body">
          <button class="btn btn-danger mb-3" (click)="checkDatabase()">Vérifier la base de données</button>
          <div *ngIf="dbResponse" class="mt-3">
            <h4>Réponse de la base de données:</h4>
            <pre class="bg-light p-3">{{ dbResponse | json }}</pre>
          </div>
          <div *ngIf="dbError" class="alert alert-danger mt-3">
            {{ dbError }}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .card {
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    pre {
      max-height: 300px;
      overflow-y: auto;
    }
  `]
})
export class AuthTestComponent implements OnInit {
  // Données d'inscription
  registerData = {
    username: '',
    email: '',
    password: '',
    address: ''
  };
  selectedRole = 'ADMIN';
  registerResponse: any;
  registerError: string | null = null;

  // Données de connexion
  loginData = {
    usernameOrEmail: '',
    password: ''
  };
  loginResponse: any;
  loginError: string | null = null;

  // Utilisateur actuel
  currentUser: User | null = null;
  userRoles: string[] = [];
  normalizedRoles: string[] = [];
  hasAdminRole = false;
  hasVendeurRole = false;
  hasClientRole = false;

  // Décodage du token
  jwtToken: string = '';
  decodedToken: any;

  // Vérification de la base de données
  dbResponse: any;
  dbError: string | null = null;

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Charger l'utilisateur actuel au démarrage
    this.checkCurrentUser();
    
    // Récupérer le token JWT s'il existe
    const token = localStorage.getItem('authToken');
    if (token) {
      this.jwtToken = token;
    }
  }

  register(): void {
    this.registerError = null;
    this.registerResponse = null;
    
    // Créer l'objet de requête avec le tableau de rôles
    const registerRequest = {
      username: this.registerData.username,
      email: this.registerData.email,
      password: this.registerData.password,
      address: this.registerData.address,
      roles: [this.selectedRole] // Envoyer un tableau avec le rôle sélectionné
    };
    
    console.log('Requête d\'inscription:', registerRequest);
    
    this.authService.register(registerRequest).subscribe({
      next: (response) => {
        this.registerResponse = response;
        console.log('Réponse d\'inscription:', response);
      },
      error: (error) => {
        this.registerError = this.authService.formatErrorMessage(error);
        console.error('Erreur d\'inscription:', error);
      }
    });
  }

  login(): void {
    this.loginError = null;
    this.loginResponse = null;
    
    this.authService.login(this.loginData).subscribe({
      next: (response) => {
        this.loginResponse = response;
        console.log('Réponse de connexion:', response);
        
        // Mettre à jour l'utilisateur actuel
        this.checkCurrentUser();
        
        // Mettre à jour le token JWT
        const token = this.authService.getToken();
        if (token) {
          this.jwtToken = token;
        }
      },
      error: (error) => {
        this.loginError = this.authService.formatErrorMessage(error);
        console.error('Erreur de connexion:', error);
      }
    });
  }

  checkCurrentUser(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.userRoles = this.authService.getUserRoles();
    this.normalizedRoles = this.authService.getUserRoles(true);
    
    this.hasAdminRole = this.authService.hasRole('ADMIN');
    this.hasVendeurRole = this.authService.hasRole('VENDEUR');
    this.hasClientRole = this.authService.hasRole('CLIENT');
    
    console.log('Utilisateur actuel:', this.currentUser);
    console.log('Rôles de l\'utilisateur:', this.userRoles);
    console.log('Rôles normalisés:', this.normalizedRoles);
  }

  decodeToken(): void {
    try {
      // Décodage manuel du token JWT
      const parts = this.jwtToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Format de token JWT invalide');
      }
      
      const payload = parts[1];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      this.decodedToken = JSON.parse(jsonPayload);
      console.log('Token décodé:', this.decodedToken);
    } catch (error) {
      console.error('Erreur lors du décodage du token:', error);
      this.decodedToken = { error: 'Erreur lors du décodage du token' };
    }
  }

  checkDatabase(): void {
    this.dbError = null;
    this.dbResponse = null;
    
    // Cette fonction nécessite un endpoint spécifique sur le backend
    // pour récupérer les informations de la base de données
    this.http.get('http://localhost:8081/api/auth/debug/user-roles').subscribe({
      next: (response) => {
        this.dbResponse = response;
        console.log('Réponse de la base de données:', response);
      },
      error: (error) => {
        this.dbError = 'Erreur lors de la vérification de la base de données: ' + error.message;
        console.error('Erreur de base de données:', error);
      }
    });
  }
}
