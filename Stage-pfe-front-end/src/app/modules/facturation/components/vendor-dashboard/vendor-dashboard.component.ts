import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Facture, FactureService } from '../../services/facture.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ProductService } from '../../../stock/services/product.service';

interface SalesData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
  }[];
}

interface SalesByCategory {
  category: string;
  amount: number;
  percentage: number;
}

@Component({
  selector: 'app-vendor-dashboard',
  templateUrl: './vendor-dashboard.component.html',
  styleUrls: ['./vendor-dashboard.component.scss']
})
export class VendorDashboardComponent implements OnInit {
  // Exposer Math pour l'utiliser dans le template
  public Math = Math;
  factures: Facture[] = [];
  isLoading: boolean = false;
  errorMessage: string | null = null;
  
  // Statistiques
  totalSales: number = 0;
  totalFactures: number = 0;
  paidFactures: number = 0;
  pendingFactures: number = 0;
  averageSale: number = 0;
  
  // Données pour les graphiques
  monthlySalesData: SalesData = {
    labels: [],
    datasets: [
      {
        label: 'Ventes mensuelles',
        data: [],
        backgroundColor: 'rgba(63, 81, 181, 0.2)',
        borderColor: 'rgba(63, 81, 181, 1)',
        borderWidth: 1
      }
    ]
  };
  
  salesByCategory: SalesByCategory[] = [];
  
  // Factures récentes
  recentFactures: Facture[] = [];
  
  // Produits les plus vendus
  topProducts: { productName: string; quantity: number; amount: number }[] = [];
  
  constructor(
    private factureService: FactureService,
    private productService: ProductService,
    public authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadData();
  }
  
  loadData(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    this.factureService.getVendorFactures().subscribe({
      next: (factures) => {
        this.factures = factures;
        this.calculateStatistics();
        this.prepareMonthlySalesData();
        this.calculateSalesByCategory();
        this.getRecentFactures();
        this.calculateTopProducts();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des données:', error);
        this.errorMessage = 'Erreur lors du chargement des données. Veuillez réessayer.';
        this.isLoading = false;
      }
    });
  }
  
  calculateStatistics(): void {
    this.totalFactures = this.factures.length;
    this.paidFactures = this.factures.filter(f => f.status === 'PAID').length;
    this.pendingFactures = this.factures.filter(f => f.status === 'PENDING').length;
    
    // Calculer le total des ventes (factures payées uniquement)
    const paidFactures = this.factures.filter(f => f.status === 'PAID');
    this.totalSales = paidFactures.reduce((sum, facture) => sum + facture.total, 0);
    
    // Calculer la moyenne des ventes
    this.averageSale = paidFactures.length > 0 ? this.totalSales / paidFactures.length : 0;
  }
  
  prepareMonthlySalesData(): void {
    // Créer un objet pour stocker les ventes par mois
    const salesByMonth: { [key: string]: number } = {};
    
    // Initialiser les 6 derniers mois
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = `${month.getFullYear()}-${month.getMonth() + 1}`;
      const monthLabel = month.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
      
      salesByMonth[monthKey] = 0;
      this.monthlySalesData.labels.push(monthLabel);
    }
    
    // Calculer les ventes pour chaque mois
    this.factures
      .filter(f => f.status === 'PAID')
      .forEach(facture => {
        const date = new Date(facture.date);
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        
        if (salesByMonth[monthKey] !== undefined) {
          salesByMonth[monthKey] += facture.total;
        }
      });
    
    // Convertir l'objet en tableau pour le graphique
    this.monthlySalesData.datasets[0].data = Object.values(salesByMonth);
  }
  
  calculateSalesByCategory(): void {
    // Créer un objet pour stocker les ventes par catégorie
    const salesByCategory: { [key: string]: number } = {};
    let totalCategorySales = 0;
    
    // Calculer les ventes pour chaque catégorie
    this.factures
      .filter(f => f.status === 'PAID')
      .forEach(facture => {
        facture.items.forEach(item => {
          // Utiliser le service de produit pour obtenir la catégorie
          // Pour simplifier, nous utilisons une approche basée sur le nom du produit
          const productName = item.productName.toLowerCase();
          let category = 'Autre';
          
          if (productName.includes('ordinateur') || productName.includes('laptop')) {
            category = 'Ordinateurs';
          } else if (productName.includes('téléphone') || productName.includes('smartphone')) {
            category = 'Téléphones';
          } else if (productName.includes('accessoire')) {
            category = 'Accessoires';
          } else if (productName.includes('tablette')) {
            category = 'Tablettes';
          }
          
          if (!salesByCategory[category]) {
            salesByCategory[category] = 0;
          }
          
          salesByCategory[category] += item.quantity * item.unitPrice;
          totalCategorySales += item.quantity * item.unitPrice;
        });
      });
    
    // Convertir l'objet en tableau pour l'affichage
    this.salesByCategory = Object.entries(salesByCategory)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalCategorySales > 0 ? (amount / totalCategorySales) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }
  
  getRecentFactures(): void {
    // Obtenir les 5 factures les plus récentes
    this.recentFactures = [...this.factures]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }
  
  calculateTopProducts(): void {
    // Créer un objet pour stocker les quantités et montants par produit
    const productStats: { [key: string]: { quantity: number; amount: number } } = {};
    
    // Calculer les quantités et montants pour chaque produit
    this.factures
      .filter(f => f.status === 'PAID')
      .forEach(facture => {
        facture.items.forEach(item => {
          if (!productStats[item.productName]) {
            productStats[item.productName] = { quantity: 0, amount: 0 };
          }
          
          productStats[item.productName].quantity += item.quantity;
          productStats[item.productName].amount += item.quantity * item.unitPrice;
        });
      });
    
    // Convertir l'objet en tableau pour l'affichage
    this.topProducts = Object.entries(productStats)
      .map(([productName, stats]) => ({
        productName,
        quantity: stats.quantity,
        amount: stats.amount
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }
  
  viewAllFactures(): void {
    this.router.navigate(['/facturation']);
  }
  
  createNewFacture(): void {
    this.router.navigate(['/caisse/dashboard']);
  }
  
  viewFacture(id: string): void {
    this.router.navigate(['/facturation', id]);
  }
  
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
  
  getStatusLabel(status: string): string {
    switch (status) {
      case 'PAID':
        return 'Payée';
      case 'PENDING':
        return 'En attente';
      case 'CANCELLED':
        return 'Annulée';
      default:
        return status;
    }
  }
  
  getStatusClass(status: string): string {
    switch (status) {
      case 'PAID':
        return 'status-paid';
      case 'PENDING':
        return 'status-pending';
      case 'CANCELLED':
        return 'status-cancelled';
      default:
        return '';
    }
  }
  
  // Helper pour obtenir la valeur maximale d'un tableau (remplace Math.max(...array))
  getMaxValue(array: number[]): number {
    if (!array || array.length === 0) return 0;
    return Math.max.apply(null, array);
  }
}
