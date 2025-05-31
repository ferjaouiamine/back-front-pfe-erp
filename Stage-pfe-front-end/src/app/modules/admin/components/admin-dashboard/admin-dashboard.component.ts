import { Component, OnInit, AfterViewInit } from '@angular/core';
import { AdminDashboardService, StatCard, RecentActivity } from '../../services/admin-dashboard.service';
import { Chart, registerables } from 'chart.js';

// Enregistrer tous les composants Chart.js
Chart.register(...registerables);

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, AfterViewInit {
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
        
        // Initialiser les graphiques une fois les données chargées
        setTimeout(() => {
          this.initCharts();
        }, 100); // Court délai pour s'assurer que les éléments DOM sont prêts
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
  
  // Implémentation de l'interface AfterViewInit
  ngAfterViewInit(): void {
    // Initialiser les graphiques une fois que les données sont chargées
    if (!this.isLoading && this.monthlySalesData && this.usersByRoleData) {
      this.initCharts();
    }
  }
  
  // Initialiser les graphiques
  private initCharts(): void {
    this.createMonthlySalesChart();
    this.createUsersByRoleChart();
  }
  
  // Créer le graphique des ventes mensuelles
  private createMonthlySalesChart(): void {
    const ctx = document.getElementById('monthlySalesChart') as HTMLCanvasElement;
    if (!ctx) return;
    
    // Exemple de données pour le graphique des ventes mensuelles
    const monthlySalesData = this.monthlySalesData || {
      labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
      datasets: [{
        label: 'Ventes mensuelles (EUR)',
        data: [12000, 19000, 15000, 17000, 22000, 24000, 18000, 20000, 25000, 28000, 30000, 32000],
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
        tension: 0.4
      }]
    };
    
    new Chart(ctx, {
      type: 'line',
      data: monthlySalesData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => {
                return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumSignificantDigits: 3 }).format(Number(value));
              }
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(context.parsed.y);
              }
            }
          }
        }
      }
    });
  }
  
  // Créer le graphique des utilisateurs par rôle
  private createUsersByRoleChart(): void {
    const ctx = document.getElementById('usersByRoleChart') as HTMLCanvasElement;
    if (!ctx) return;
    
    // Exemple de données pour le graphique des utilisateurs par rôle
    const usersByRoleData = this.usersByRoleData || {
      labels: ['Admin', 'Vendeur', 'Gestionnaire', 'Comptable'],
      datasets: [{
        label: 'Nombre d\'utilisateurs par rôle',
        data: [4, 15, 8, 6],
        backgroundColor: [
          'rgba(255, 99, 132, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(75, 192, 192, 0.7)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)'
        ],
        borderWidth: 1
      }]
    };
    
    new Chart(ctx, {
      type: 'doughnut',
      data: usersByRoleData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((acc: number, data: number) => acc + data, 0);
                const percentage = Math.round((value / total) * 100);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
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
