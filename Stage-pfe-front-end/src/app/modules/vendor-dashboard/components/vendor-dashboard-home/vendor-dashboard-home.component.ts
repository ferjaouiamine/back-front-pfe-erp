import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../modules/auth/services/auth.service';

@Component({
  selector: 'app-vendor-dashboard-home',
  templateUrl: './vendor-dashboard-home.component.html',
  styleUrls: ['./vendor-dashboard-home.component.scss'],
  standalone: false
})
export class VendorDashboardHomeComponent implements OnInit {
  userName: string = '';
  lastLogin: string = '';
  todaySales: number = 0;
  pendingInvoices: number = 0;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Récupérer les informations de l'utilisateur connecté
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.userName = currentUser.username || 'Vendeur';
      this.lastLogin = new Date().toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    // Ces valeurs seraient normalement récupérées depuis un service
    this.todaySales = Math.floor(Math.random() * 20);
    this.pendingInvoices = Math.floor(Math.random() * 10);
  }

  navigateToPOS(): void {
    this.router.navigate(['/caisse/pos']);
  }

  navigateToInvoicing(): void {
    this.router.navigate(['/facturation']);
  }

  navigateToSalesHistory(): void {
    this.router.navigate(['/facturation/list']);
  }
}
