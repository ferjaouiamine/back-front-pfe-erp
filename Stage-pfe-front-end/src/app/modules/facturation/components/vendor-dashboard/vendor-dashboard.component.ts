import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Facture, FactureService } from '../../services/facture.service';
import { AuthService } from '../../../auth/services/auth.service';
import { Product, ProductService } from '../../../stock/services/product.service';

interface CategorySales {
  category: string;
  amount: number;
  percentage?: number;
}

interface TopProduct {
  productId?: string;
  productName: string;
  quantity: number;
  revenue?: number;
  amount?: number;
}

interface ProductCategory {
  id?: number;
  name?: string;
}

interface MonthlySalesData {
  month: string;
  amount: number;
  percentage: number;
}

@Component({
  selector: 'app-vendor-dashboard',
  templateUrl: './vendor-dashboard.component.html',
  styleUrls: ['./vendor-dashboard.component.scss']
})
export class VendorDashboardComponent implements OnInit, OnDestroy {
  factures: Facture[] = [];
  products: Product[] = [];
  recentFactures: Facture[] = [];
  topProducts: TopProduct[] = [];
  salesByCategory: CategorySales[] = [];
  monthlySalesDataArray: MonthlySalesData[] = [];

  totalFactures: number = 0;
  totalProducts: number = 0;
  averageOrderValue: number = 0;
  totalInvoices: number = 0;
  totalProductsSold: number = 0;
  averageInvoiceAmount: number = 0;
  showSidebar: boolean = true;
  showSettings: boolean = false;
  pendingFactures: number = 0;
  totalSales: number = 0;
  averageSale: number = 0;
  paidInvoicesCount: number = 0;
  pendingInvoicesCount: number = 0;
  isLoading: boolean = true;
  errorMessage: string | null = null;
  private routerSubscription: Subscription | null = null;
  private factureCreatedSubscription: Subscription | null = null;
  private factureUpdatedSubscription: Subscription | null = null;

  monthlySalesData: any = {
    labels: [],
    datasets: [
      {
        label: 'Ventes mensuelles',
        data: [],
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
        fill: true
      }
    ]
  };

  categoryData: any = {
    labels: [],
    datasets: [
      {
        data: [],
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40'
        ]
      }
    ]
  };

  chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  pieChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false
  };

  constructor(
    private factureService: FactureService,
    private productService: ProductService,
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Initialisation des données du dashboard
    this.loadData();
    
    // S'abonner aux événements de navigation pour recharger les données
    // quand l'utilisateur revient au dashboard
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(event => {
      // Si l'utilisateur navigue vers le dashboard, recharger les données
      if (event instanceof NavigationEnd && event.url === '/facturation/dashboard') {
        console.log('Retour au dashboard, rechargement des données...');
        this.loadData();
      }
    });
    
    // S'abonner aux événements de création de facture pour mettre à jour les statistiques
    this.factureCreatedSubscription = this.factureService.factureCreated$.subscribe(newFacture => {
      console.log('Nouvelle facture créée, mise à jour des statistiques...', newFacture);
      // Recharger toutes les données pour mettre à jour les statistiques
      this.loadData();
    });
  
    // S'abonner aux événements de mise à jour de facture pour mettre à jour les statistiques
    this.factureUpdatedSubscription = this.factureService.factureUpdated$.subscribe(updatedFacture => {
      console.log('Facture mise à jour, mise à jour des statistiques...', updatedFacture);
      // Recharger toutes les données pour mettre à jour les statistiques
      this.loadData();
    });
  }

  loadData(): void {
    this.isLoading = true;
    this.errorMessage = null;
    console.log('Chargement des données du dashboard...');

    // Charger les factures
    this.factureService.getFactures().subscribe({
      next: (factures) => {
        console.log('Factures récupérées avec succès:', factures);
        this.factures = factures;
        this.calculateStatistics();
        this.prepareMonthlySalesData();
        this.getRecentFactures();
        this.loadProducts();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des factures:', error);
        this.errorMessage = 'Erreur lors du chargement des factures. Veuillez réessayer plus tard.';
        this.isLoading = false;
        this.calculateStatistics();
        this.prepareMonthlySalesData();
        this.getRecentFactures();
        this.loadProducts();
        this.isLoading = false;
      }
    });
  }

  loadProducts(): void {
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.calculateStatistics();
        this.calculateSalesByCategory();
        this.calculateTopProducts();
      },
      error: (error) => {
        console.error('Erreur lors du chargement des produits:', error);
        this.errorMessage = 'Impossible de charger les produits. Veuillez réessayer plus tard.';
      }
    });
  }

  calculateStatistics(): void {
    this.totalSales = this.factures.reduce((acc, f) => acc + (f.total || 0), 0);
    this.averageSale = this.totalSales / this.factures.length;
    this.paidInvoicesCount = this.factures.filter(f => f.status === 'PAID').length;
    this.pendingInvoicesCount = this.factures.filter(f => f.status === 'PENDING').length;
    this.totalInvoices = this.factures.length;
    this.totalProductsSold = this.factures.reduce((total, f) => total + (f.items?.reduce((sum, i) => sum + i.quantity, 0) || 0), 0);
    this.averageInvoiceAmount = this.totalInvoices > 0 ? this.totalSales / this.totalInvoices : 0;
  }

  calculateSalesByCategory(): void {
    const categorySales: { [key: string]: number } = {};
    
    // Vérifier si nous avons des factures avec des articles
    const hasValidItems = this.factures.some(f => f.items && f.items.length > 0);
    
    if (hasValidItems) {
      // Calculer les ventes par catégorie à partir des données réelles
      this.factures.forEach(f => {
        f.items?.forEach(item => {
          // Utiliser item.category ou item.product.category ou 'Autre' comme catégorie
          const cat = item.category?.name || item.product?.category?.name || 'Autre';
          // Utiliser item.unitPrice ou item.price ou item.product.price ou 0 comme prix
          const price = item.unitPrice || item.price || item.product?.price || 0;
          categorySales[cat] = (categorySales[cat] || 0) + (price * (item.quantity || 0));
        });
      });
    } else {
      // Données de démonstration si aucune donnée réelle n'est disponible
      categorySales['Électronique'] = 2400;
      categorySales['Vêtements'] = 1800;
      categorySales['Alimentation'] = 1200;
      categorySales['Maison'] = 900;
      categorySales['Sports'] = 600;
    }
    
    // Calculer le total des ventes pour les pourcentages
    const totalAmount = Object.values(categorySales).reduce((sum, amount) => sum + amount, 0);
    
    // Créer le tableau final avec les pourcentages
    this.salesByCategory = Object.entries(categorySales)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount); // Trier par montant décroissant
  }

  calculateTopProducts(): void {
    const productStats: { [key: string]: { quantity: number; amount: number } } = {};
    
    // Vérifier si nous avons des factures avec des articles
    const hasValidItems = this.factures.some(f => f.items && f.items.length > 0);
    
    if (hasValidItems) {
      // Calculer les statistiques des produits à partir des données réelles
      this.factures.forEach(f => {
        f.items?.forEach(i => {
          const productName = i.productName || i.product?.name || 'Produit inconnu';
          const quantity = i.quantity || 0;
          const unitPrice = i.unitPrice || i.price || i.product?.price || 0;
          
          if (!productStats[productName]) {
            productStats[productName] = { quantity: 0, amount: 0 };
          }
          
          productStats[productName].quantity += quantity;
          productStats[productName].amount += quantity * unitPrice;
        });
      });
    } else {
      // Données de démonstration si aucune donnée réelle n'est disponible
      productStats['Smartphone XS Pro'] = { quantity: 42, amount: 21000 };
      productStats['Ordinateur portable UltraBook'] = { quantity: 28, amount: 28000 };
      productStats['Écouteurs sans fil'] = { quantity: 56, amount: 5600 };
      productStats['Montre connectée'] = { quantity: 35, amount: 8750 };
      productStats['Tablette 10"'] = { quantity: 22, amount: 6600 };
    }
    
    // Créer le tableau final et trier par quantité vendue
    this.topProducts = Object.entries(productStats)
      .map(([productName, stats]) => ({ 
        productName, 
        ...stats 
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5); // Limiter aux 5 premiers produits
  }

  prepareMonthlySalesData(): void {
    const now = new Date();
    const monthlySales: number[] = Array(12).fill(0);
    const months: string[] = [];
    
    // Générer les étiquettes des mois (12 derniers mois)
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }));
    }
    
    // Vérifier si nous avons des factures avec des dates valides
    const hasValidDates = this.factures.some(f => f.date && new Date(f.date).getTime() > 0);
    
    if (hasValidDates) {
      // Calculer les ventes mensuelles à partir des données réelles
      this.factures.forEach(f => {
        if (f.date) {
          const factureDate = new Date(f.date);
          // Calculer la différence en mois entre maintenant et la date de la facture
          const monthDiff = (now.getFullYear() - factureDate.getFullYear()) * 12 + (now.getMonth() - factureDate.getMonth());
          
          // Si la facture est dans les 12 derniers mois
          if (monthDiff >= 0 && monthDiff < 12) {
            const index = 11 - monthDiff; // Inverser l'index pour l'affichage chronologique
            monthlySales[index] += f.total || 0;
          }
        }
      });
    } else {
      // Données de démonstration si aucune donnée réelle n'est disponible
      // Mettre à zéro pour les mois précédents et ajouter des données pour le mois actuel
      monthlySales[11] = 2400; // Mois actuel
      monthlySales[10] = 1800; // Mois précédent
      monthlySales[9] = 2100;  // Il y a 2 mois
      monthlySales[8] = 1500;  // Il y a 3 mois
      monthlySales[7] = 1900;  // Il y a 4 mois
    }
    
    // Mettre à jour les données du graphique
    this.monthlySalesData.labels = months;
    this.monthlySalesData.datasets[0].data = monthlySales;
    
    // Mettre à jour les données pour l'affichage des barres dans le template
    const maxValue = this.getMaxValue(monthlySales);
    this.monthlySalesDataArray = months.map((month, index) => ({
      month,
      amount: monthlySales[index],
      percentage: maxValue > 0 ? (monthlySales[index] / maxValue) * 100 : 0
    }));
  }

  getRecentFactures(): void {
    this.recentFactures = [...this.factures].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }

  viewAllFactures(): void {
    this.router.navigate(['/facturation']);
  }

  createNewFacture(): void {
    this.router.navigate(['/facturation/create']);
  }

  viewFacture(id: string): void {
    this.router.navigate(['/facturation', id]);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  getStatusLabel(status: string): string {
    const statusMap: { [key: string]: string } = {
      'DRAFT': 'Brouillon',
      'PENDING': 'En attente',
      'PAID': 'Payée',
      'CANCELLED': 'Annulée'
    };
    return statusMap[status] || status;
  }

  getStatusClass(status: string): string {
    const classMap: { [key: string]: string } = {
      'DRAFT': 'badge-secondary',
      'PENDING': 'badge-warning',
      'PAID': 'badge-success',
      'CANCELLED': 'badge-danger'
    };
    return classMap[status] || 'badge-secondary';
  }

  /**
   * Calcule la valeur maximale d'un tableau de nombres
   * @param array Tableau de nombres
   * @returns La valeur maximale du tableau ou 0 si le tableau est vide
   */
  getMaxValue(array: number[]): number {
    if (!array || array.length === 0) return 0;
    return Math.max(...array);
  }
  
  /**
   * Calcule la hauteur en pixels pour une barre du graphique
   * @param amount Montant de la vente
   * @param percentage Pourcentage par rapport au maximum
   * @returns Hauteur en pixels
   */
  getBarHeight(amount: number, percentage: number): number {
    return amount === 0 ? 0 : Math.max(20, (percentage / 100) * 200);
  }

  ngOnDestroy(): void {
    // Se désabonner pour éviter les fuites de mémoire
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (this.factureCreatedSubscription) {
      this.factureCreatedSubscription.unsubscribe();
    }
    if (this.factureUpdatedSubscription) {
      this.factureUpdatedSubscription.unsubscribe();
    }
  }
}