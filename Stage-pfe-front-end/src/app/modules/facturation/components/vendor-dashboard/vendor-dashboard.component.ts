import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Facture, FactureService } from '../../services/facture.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ProductService } from '../../../stock/services/product.service';
import { Product } from '../../../stock/services/product.service';

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

interface TopProduct {
  productName: string;
  quantity: number;
  amount: number;
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
  products: Product[] = [];
  isLoading: boolean = true;
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
  topProducts: TopProduct[] = [];
  
  constructor(
    private factureService: FactureService,
    private productService: ProductService,
    public authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadData();
    this.loadProducts();
  }
  
  loadData(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    console.log('Chargement des données depuis le backend Spring Boot...');
    
    // Utiliser le service de factures qui se connecte au backend Spring Boot
    this.factureService.getFactures().subscribe({
      next: (factures) => {
        console.log('Factures chargées avec succès:', factures.length, 'factures');
        
        if (factures.length > 0) {
          console.log('Première facture:', factures[0]);
        }
        
        this.factures = factures;
        this.calculateStatistics();
        this.prepareMonthlySalesData();
        this.getRecentFactures();
        this.calculateTopProducts();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des données:', error);
        this.errorMessage = 'Impossible de charger les données. Veuillez vérifier votre connexion.';
        this.isLoading = false;
      }
    });
  }
  
  loadProducts(): void {
    console.log('Chargement des produits depuis le backend Spring Boot...');
    
    this.productService.getProducts().subscribe({
      next: (products) => {
        console.log('Produits chargés avec succès:', products.length, 'produits');
        this.products = products;
        this.calculateSalesByCategory();
      },
      error: (error) => {
        console.error('Erreur lors du chargement des produits:', error);
        // Générer des produits factices si nécessaire
        this.products = [];
        this.calculateSalesByCategory();
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
    // Réinitialiser les données
    this.monthlySalesData.labels = [];
    this.monthlySalesData.datasets[0].data = [];
    
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
    
    // Convertir l'objet en tableau pour l'affichage
    this.monthlySalesData.datasets[0].data = Object.values(salesByMonth);
  }
  
  calculateSalesByCategory(): void {
    if (!this.products || this.products.length === 0 || !this.factures || this.factures.length === 0) {
      console.log('Pas assez de données pour calculer les ventes par catégorie');
      return;
    }
    
    console.log('Calcul des ventes par catégorie avec données réelles...');
    
    // Créer un objet pour stocker les ventes par catégorie
    const salesByCategory: { [key: string]: number } = {};
    let totalCategorySales = 0;
    
    // Créer un dictionnaire des produits pour une recherche rapide
    const productsDict: { [key: string]: string } = {};
    this.products.forEach(product => {
      productsDict[product.id] = product.category || 'Autre';
    });
    
    // Calculer les ventes pour chaque catégorie en utilisant les données réelles
    this.factures
      .filter(f => f.status === 'PAID')
      .forEach(facture => {
        if (facture.items && facture.items.length > 0) {
          facture.items.forEach(item => {
            // Obtenir la catégorie réelle du produit à partir du dictionnaire
            let category = productsDict[item.productId] || 'Autre';
            
            // Si la catégorie est vide ou null, utiliser 'Autre'
            if (!category || category === 'null' || category === 'undefined') {
              category = 'Autre';
            }
            
            // Initialiser la catégorie si elle n'existe pas encore
            if (!salesByCategory[category]) {
              salesByCategory[category] = 0;
            }
            
            // Calculer le montant total pour cette catégorie
            const itemTotal = item.quantity * item.unitPrice;
            salesByCategory[category] += itemTotal;
            totalCategorySales += itemTotal;
          });
        }
      });
    
    // Convertir l'objet en tableau pour l'affichage
    this.salesByCategory = Object.entries(salesByCategory)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalCategorySales > 0 ? (amount / totalCategorySales) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
    
    console.log('Catégories de ventes calculées:', this.salesByCategory);
  }
  
  getRecentFactures(): void {
    // Obtenir les 5 factures les plus récentes
    this.recentFactures = [...this.factures]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
    
    console.log('Factures récentes:', this.recentFactures.length);
  }
  
  calculateTopProducts(): void {
    if (!this.factures || this.factures.length === 0) {
      console.log('Pas assez de données pour calculer les produits les plus vendus');
      return;
    }
    
    // Créer un objet pour stocker les quantités et montants par produit
    const productStats: { [key: string]: { quantity: number; amount: number } } = {};
    
    // Calculer les quantités et montants pour chaque produit
    this.factures
      .filter(f => f.status === 'PAID')
      .forEach(facture => {
        if (facture.items && facture.items.length > 0) {
          facture.items.forEach(item => {
            if (!productStats[item.productName]) {
              productStats[item.productName] = { quantity: 0, amount: 0 };
            }
            
            productStats[item.productName].quantity += item.quantity;
            productStats[item.productName].amount += item.quantity * item.unitPrice;
          });
        }
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
    
    console.log('Produits les plus vendus:', this.topProducts.length);
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
