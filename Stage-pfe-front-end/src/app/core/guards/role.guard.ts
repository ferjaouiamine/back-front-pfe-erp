import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../../modules/auth/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    // Vérifier d'abord si l'utilisateur est connecté
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/auth/login'], { 
        queryParams: { returnUrl: state.url }
      });
      return false;
    }
    
    // Récupérer les rôles requis pour accéder à la route
    const requiredRoles = route.data['roles'] as Array<string>;
    
    // Si aucun rôle n'est requis, autoriser l'accès
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    
    // Vérifier si l'utilisateur a au moins un des rôles requis
    const userRoles = this.authService.getUserRoles();
    
    // Logs pour déboguer
    console.log('RoleGuard: Rôles requis:', requiredRoles);
    console.log('RoleGuard: Rôles de l\'utilisateur:', userRoles);
    console.log('RoleGuard: Utilisateur courant:', this.authService.getCurrentUser());
    
    // Vérifier si l'utilisateur a un rôle requis, en tenant compte du préfixe ROLE_
    console.log('RoleGuard: Détails de la vérification des rôles:');
    
    // Fonction pour vérifier si un utilisateur a un rôle spécifique (avec ou sans préfixe ROLE_)
    const userHasRole = (userRoles: string[], roleToCheck: string): boolean => {
      // Vérifier le rôle exact (ex: ADMIN, VENDEUR)
      if (userRoles.includes(roleToCheck)) {
        return true;
      }
      
      // Vérifier le rôle avec préfixe ROLE_ (ex: ROLE_ADMIN, ROLE_VENDEUR)
      if (userRoles.includes(`ROLE_${roleToCheck}`)) {
        return true;
      }
      
      // Vérifier si un rôle utilisateur sans préfixe correspond au rôle requis
      const normalizedRoleToCheck = roleToCheck.replace('ROLE_', '').toUpperCase();
      return userRoles.some(userRole => {
        const normalizedUserRole = userRole.replace('ROLE_', '').toUpperCase();
        return normalizedUserRole === normalizedRoleToCheck;
      });
    };
    
    // Vérifier si l'utilisateur a au moins un des rôles requis
    const hasRequiredRole = requiredRoles.some(requiredRole => {
      console.log('RoleGuard: Vérification du rôle requis:', requiredRole);
      const hasRole = userHasRole(userRoles, requiredRole);
      console.log(`RoleGuard: L'utilisateur a-t-il le rôle ${requiredRole}?`, hasRole);
      return hasRole;
    });
    
    console.log('RoleGuard: L\'utilisateur a-t-il un rôle requis?', hasRequiredRole);
    
    if (hasRequiredRole) {
      console.log('RoleGuard: Accès autorisé');
      return true;
    } else {
      // Rediriger vers une page d'accès refusé ou la page d'accueil
      console.log('RoleGuard: Accès refusé, redirection vers /access-denied');
      this.router.navigate(['/access-denied']);
      return false;
    }
  }
}
