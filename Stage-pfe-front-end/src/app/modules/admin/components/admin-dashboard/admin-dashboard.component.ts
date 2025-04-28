import { Component, OnInit } from '@angular/core';
import { AdminDashboardService, StatCard, RecentActivity } from '../../services/admin-dashboard.service';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  // Statistiques globales
  statCards: StatCard[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  recentActivities: RecentActivity[] = [];
  
  // Données pour les graphiques
  usersByRoleData: any;
  monthlySalesData: any;
  
  constructor(private dashboardService: AdminDashboardService) { }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  // Charger les données du tableau de bord depuis le service
  loadDashboardData(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    this.dashboardService.getDashboardData().subscribe({
      next: (data) => {
        console.log('Données du dashboard reçues:', data);
        this.statCards = data.statCards;
        this.recentActivities = data.recentActivities;
        this.usersByRoleData = data.usersByRoleData;
        this.monthlySalesData = data.monthlySalesData;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = "Une erreur s'est produite lors du chargement des données.";
        this.isLoading = false;
        console.error('Erreur lors du chargement des données du dashboard:', error);
      }
    });
  }

  // Formater les valeurs monétaires
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
  }

  // Obtenir la classe CSS pour le type d'activité
  getActivityTypeClass(type: string): string {
    switch (type) {
      case 'user': return 'activity-user';
      case 'facture': return 'activity-facture';
      case 'product': return 'activity-product';
      default: return '';
    }
  }

  // Obtenir l'icône pour le type d'activité
  getActivityTypeIcon(type: string): string {
    switch (type) {
      case 'user': return 'fas fa-user';
      case 'facture': return 'fas fa-file-invoice';
      case 'product': return 'fas fa-box';
      default: return 'fas fa-info-circle';
    }
  }
}
