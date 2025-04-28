import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayoutComponent implements OnInit {
  // Propriétés pour le layout
  sidebarCollapsed: boolean = false;
  pageTitle: string = 'Tableau de bord';
  searchQuery: string = '';
  showUserMenu: boolean = false;

  constructor(
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Mettre à jour le titre de la page en fonction de la route active
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updatePageTitle();
    });
  }

  // Mettre à jour le titre de la page en fonction de la route active
  updatePageTitle(): void {
    const url = this.router.url;
    if (url.includes('/admin/dashboard')) {
      this.pageTitle = 'Tableau de bord';
    } else if (url.includes('/admin/users')) {
      this.pageTitle = 'Gestion des utilisateurs';
    } else if (url.includes('/admin/factures')) {
      this.pageTitle = 'Gestion des factures';
    } else if (url.includes('/admin/products')) {
      this.pageTitle = 'Gestion des produits';
    } else {
      this.pageTitle = 'Administration';
    }
  }

  // Basculer l'état de la barre latérale
  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  // Basculer le menu utilisateur
  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  // Effectuer une recherche
  search(): void {
    console.log('Recherche:', this.searchQuery);
    // Implémenter la logique de recherche en fonction du contexte actuel
    if (this.router.url.includes('/admin/users')) {
      this.router.navigate(['/admin/users'], { queryParams: { search: this.searchQuery } });
    } else if (this.router.url.includes('/admin/factures')) {
      this.router.navigate(['/admin/factures'], { queryParams: { search: this.searchQuery } });
    } else if (this.router.url.includes('/admin/products')) {
      this.router.navigate(['/admin/products'], { queryParams: { search: this.searchQuery } });
    }
  }

  // Déconnexion
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
