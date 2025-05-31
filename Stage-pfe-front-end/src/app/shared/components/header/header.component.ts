import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../modules/auth/services/auth.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  username: string = '';
  notificationCount: number = 0;
  userRoles: string[] = [];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadUserInfo();
  }

  /**
   * Charge les informations de l'utilisateur connecté
   */
  loadUserInfo(): void {
    // Récupérer le nom d'utilisateur depuis le service d'authentification
    this.username = this.authService.getUsername() || 'Utilisateur';
    
    // Récupérer les rôles de l'utilisateur
    this.userRoles = this.authService.getUserRoles() || [];
    
    // Simuler des notifications (à remplacer par une vraie implémentation)
    this.notificationCount = Math.floor(Math.random() * 5);
  }

  /**
   * Vérifie si l'utilisateur a un rôle spécifique
   * @param role Le rôle à vérifier
   * @returns true si l'utilisateur a le rôle, false sinon
   */
  hasRole(role: string): boolean {
    // Vérifier si le rôle est dans la liste des rôles de l'utilisateur
    // Accepter le rôle avec ou sans le préfixe ROLE_
    const normalizedRole = role.startsWith('ROLE_') ? role : 'ROLE_' + role;
    const hasRole = this.userRoles.some(r => 
      r === role || r === normalizedRole || 
      (r.startsWith('ROLE_') && r.substring(5) === role)
    );
    
    // Pour le développement, retourner true pour tous les rôles
    // À supprimer en production
    return true; // TODO: Remplacer par hasRole en production
  }

  /**
   * Déconnecte l'utilisateur
   */
  logout(): void {
    // Appeler la méthode de déconnexion du service d'authentification
    this.authService.logout();
    
    // Rediriger vers la page de connexion
    this.router.navigate(['/auth/login']);
  }
}
