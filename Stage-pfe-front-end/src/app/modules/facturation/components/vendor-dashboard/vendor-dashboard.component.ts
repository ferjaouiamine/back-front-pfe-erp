import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Facture, FactureService } from '../../services/facture.service';
import { AuthService } from '../../../auth/services/auth.service';
import { Product, ProductService } from '../../../stock/services/product.service';
import { TestFacturation } from '../../test-facturation';

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
}

@Component({
  selector: 'app-vendor-dashboard',
  templateUrl: './vendor-dashboard.component.html',
  styleUrls: ['./vendor-dashboard.component.scss']
})
export class VendorDashboardComponent implements OnInit, OnDestroy {
  factures: Facture[] = [];
  products: Product[] = [];
  realProducts: Product[] = [];
  mockProducts: Product[] = [];
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
  showMockDataToggle: boolean = true;
  pendingFactures: number = 0;
  totalSales: number = 0;
  averageSale: number = 0;
  paidInvoicesCount: number = 0;
  pendingInvoicesCount: number = 0;
  isLoading: boolean = true;
  errorMessage: string | null = null;
  useMockData: boolean = true;
  showApiConfig: boolean = true;
  private routerSubscription!: Subscription;

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
    try {
      const showApiConfig = localStorage.getItem('show_api_config');
      if (showApiConfig !== null) {
        this.showApiConfig = showApiConfig === 'true';
      }
    } catch (e) {
      console.warn('Erreur lors du chargement de la config API:', e);
    }
    
    // Charger les données au démarrage
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
  }

  loadData(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.factureService.getAllFactures(this.useMockData).subscribe({
      next: (factures) => {
        factures.forEach(f => {
          f.date = new Date(f.date);
          f.dueDate = new Date(f.dueDate);
        });
        this.factures = factures;
        this.calculateStatistics();
        this.prepareMonthlySalesData();
        this.getRecentFactures();
        this.loadProducts();
        this.isLoading = false;
      },
      error: () => {
        this.factures = this.factureService.generateMockFactures();
        this.calculateStatistics();
        this.prepareMonthlySalesData();
        this.getRecentFactures();
        this.loadProducts();
        this.isLoading = false;
      }
    });
  }

  loadProducts(): void {
    this.productService.getAllProductsRealAndMock().subscribe({
      next: (result) => {
        this.realProducts = result.real;
        this.mockProducts = result.mock;
        this.products = this.useMockData ? this.mockProducts : this.realProducts;
        this.calculateStatistics();
        this.calculateSalesByCategory();
        this.calculateTopProducts();
      },
      error: () => {
        this.mockProducts = this.generateMockProducts();
        this.products = this.mockProducts;
        this.calculateStatistics();
        this.calculateSalesByCategory();
        this.calculateTopProducts();
      }
    });
  }

  generateMockProducts(): Product[] {
    const categories = ['Électronique', 'Vêtements', 'Alimentation'];
    return Array.from({ length: 10 }, (_, i) => ({
      id: i,
      name: `Produit ${i}`,
      description: `Description ${i}`,
      price: 100 + i,
      quantity: i + 1,
      category: { name: categories[i % categories.length] },
      active: true,
      alertThreshold: 5,
      reference: `REF-${i}`
    }));
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
    this.factures.forEach(f => {
      f.products?.forEach(p => {
        const cat = p.category?.name || 'Autre';
        categorySales[cat] = (categorySales[cat] || 0) + p.price * p.quantity;
      });
    });
    this.salesByCategory = Object.entries(categorySales).map(([category, amount]) => ({ category, amount }));
  }

  calculateTopProducts(): void {
    const productStats: { [key: string]: { quantity: number; amount: number } } = {};
    this.factures.forEach(f => {
      f.items?.forEach(i => {
        if (!productStats[i.productName]) productStats[i.productName] = { quantity: 0, amount: 0 };
        productStats[i.productName].quantity += i.quantity;
        productStats[i.productName].amount += i.quantity * i.unitPrice;
      });
    });
    this.topProducts = Object.entries(productStats).map(([productName, stats]) => ({ productName, ...stats })).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  }

  prepareMonthlySalesData(): void {
    const now = new Date();
    const monthlySales: number[] = Array(12).fill(0);
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }));
    }
    this.factures.forEach(f => {
      if (f.date) {
        const index = 11 - (now.getMonth() - new Date(f.date).getMonth());
        if (index >= 0 && index < 12) monthlySales[index] += f.total;
      }
    });
    this.monthlySalesData.labels = months;
    this.monthlySalesData.datasets[0].data = monthlySales;
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

  toggleMockData(): void {
    this.useMockData = !this.useMockData;
    this.products = this.useMockData ? this.mockProducts : this.realProducts;
    this.calculateStatistics();
    this.calculateSalesByCategory();
    this.calculateTopProducts();
  }

  changeApiUrl(urlType: 'springBoot' | 'mockServer' | 'production' | 'custom'): void {
    if (urlType === 'custom') {
      const customUrl = prompt('Entrez l\'URL personnalisée de l\'API:', this.factureService['apiUrl']);
      if (customUrl) this.factureService.setApiUrl(urlType, customUrl);
    } else {
      this.factureService.setApiUrl(urlType);
    }
    this.loadData();
  }

  toggleApiConfig(show?: boolean): void {
    this.showApiConfig = show !== undefined ? show : !this.showApiConfig;
    localStorage.setItem('show_api_config', this.showApiConfig.toString());
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'PAID': return 'Payée';
      case 'PENDING': return 'En attente';
      case 'CANCELLED': return 'Annulée';
      default: return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'PAID': return 'status-paid';
      case 'PENDING': return 'status-pending';
      case 'CANCELLED': return 'status-cancelled';
      default: return '';
    }
  }

  getMaxValue(array: number[]): number {
    return array?.length ? Math.max(...array) : 0;
  }

  runTests(): void {
    const testFacturation = new TestFacturation(this.factureService, this.productService);
    testFacturation.runAllTests();
    alert('Tests lancés, voir console.');
  }
  
  ngOnDestroy(): void {
    // Se désabonner pour éviter les fuites de mémoire
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }
}