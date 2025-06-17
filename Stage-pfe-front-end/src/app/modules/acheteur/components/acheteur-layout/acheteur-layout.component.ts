import { Component, OnInit, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-acheteur-layout',
  templateUrl: './acheteur-layout.component.html',
  styleUrls: ['./acheteur-layout.component.scss']
})
export class AcheteurLayoutComponent implements OnInit {
  username: string | null = null;
  sidebarVisible: boolean = true;
  isMobileView: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    // Vérifier si l'utilisateur est connecté et a le rôle ACHETEUR
    if (!this.authService.isLoggedIn() || !this.authService.hasRole('ACHETEUR')) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.username = this.authService.getUsername();
    
    // Vérifier la taille de l'écran au chargement
    this.checkScreenSize();
  }
  
  /**
   * Écoute les changements de taille de la fenêtre
   */
  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }
  
  /**
   * Vérifie la taille de l'écran et ajuste l'affichage de la barre latérale
   */
  checkScreenSize() {
    this.isMobileView = window.innerWidth < 992;
    if (this.isMobileView) {
      this.sidebarVisible = false;
    } else {
      this.sidebarVisible = true;
    }
  }
  
  /**
   * Bascule l'affichage de la barre latérale
   */
  toggleSidebar() {
    this.sidebarVisible = !this.sidebarVisible;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
