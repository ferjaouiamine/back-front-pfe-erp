import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { ProductService } from '../../services/product.service';
import { StockService } from '../../services/stock.service';
import { Chart, registerables } from 'chart.js';

// Enregistrer tous les composants de Chart.js
Chart.register(...registerables);
import { forkJoin } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-stock-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class StockDashboardComponent implements OnInit, AfterViewInit {
  // Statistiques du tableau de bord
  totalProducts: number = 0;
  lowStockProducts: number = 0;
  recentMovements: any[] = [];
  topProducts: any[] = [];
  
  // État de chargement
  loading: boolean = true;
  error: string | null = null;

  // Graphiques
  stockChartData: any;
  movementChartData: any;
  stockChart: Chart | null = null;
  movementChart: Chart | null = null;
  
  @ViewChild('stockChartCanvas') stockChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('movementChartCanvas') movementChartCanvas!: ElementRef<HTMLCanvasElement>;

  constructor(
    private stockService: StockService,
    private productService: ProductService
  ) { }

  ngOnInit(): void {
    this.loadDashboardData();
  }
  
  ngAfterViewInit(): void {
    // Les graphiques seront créés après le chargement des données
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = null;

    // Utiliser forkJoin pour charger toutes les données en parallèle
    forkJoin({
      products: this.productService.getProducts().pipe(catchError(err => of([]))),
      movements: this.stockService.getRecentMovements().pipe(catchError(err => of([]))),
      stats: this.stockService.getStockStats().pipe(catchError(err => of(null)))
    }).subscribe({
      next: (results) => {
        // Traiter les résultats
        this.processProductData(results.products);
        this.processMovementData(results.movements);
        this.processStatsData(results.stats);
        
        // Préparer les données des graphiques
        this.prepareChartData(results.products, results.movements);
        
        // Créer ou mettre à jour les graphiques
        this.createOrUpdateCharts();
        
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des données du tableau de bord:', err);
        this.error = 'Impossible de charger les données du tableau de bord. Veuillez réessayer plus tard.';
        this.loading = false;
      }
    });
  }

  processProductData(products: any[]): void {
    this.totalProducts = products.length;
    
    // Identifier les produits à faible stock (moins de 10 unités)
    this.lowStockProducts = products.filter(p => p.quantity < 10).length;
    
    // Top 5 des produits les plus vendus (basé sur les ventes simulées)
    this.topProducts = products
      .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
      .slice(0, 5);
  }

  processMovementData(movements: any[]): void {
    // Récupérer les 10 derniers mouvements
    this.recentMovements = movements.slice(0, 10);
  }

  processStatsData(stats: any): void {
    // Traiter les statistiques globales si nécessaire
    if (stats) {
      // Ajouter des statistiques supplémentaires si disponibles
    }
  }

  prepareChartData(products: any[], movements: any[]): void {
    // Préparer les données pour le graphique de stock
    this.stockChartData = {
      labels: products.slice(0, 10).map(p => p.name),
      datasets: [{
        label: 'Niveau de stock',
        data: products.slice(0, 10).map(p => p.quantity),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    };

    // Préparer les données pour le graphique de mouvements
    // Regrouper les mouvements par type (entrée/sortie)
    const entriesCount = movements.filter(m => m.type === 'ENTRY').length;
    const exitsCount = movements.filter(m => m.type === 'EXIT').length;

    this.movementChartData = {
      labels: ['Entrées', 'Sorties'],
      datasets: [{
        data: [entriesCount, exitsCount],
        backgroundColor: ['rgba(75, 192, 192, 0.5)', 'rgba(255, 99, 132, 0.5)'],
        borderColor: ['rgba(75, 192, 192, 1)', 'rgba(255, 99, 132, 1)'],
        borderWidth: 1
      }]
    };
  }
  
  createOrUpdateCharts(): void {
    // Vérifier si les éléments canvas sont disponibles
    if (!this.stockChartCanvas || !this.movementChartCanvas) {
      setTimeout(() => this.createOrUpdateCharts(), 100);
      return;
    }
    
    // Créer ou mettre à jour le graphique des niveaux de stock
    if (this.stockChart) {
      this.stockChart.data = this.stockChartData;
      this.stockChart.update();
    } else if (this.stockChartData) {
      this.stockChart = new Chart(this.stockChartCanvas.nativeElement, {
        type: 'bar',
        data: this.stockChartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top'
            },
            title: {
              display: true,
              text: 'Niveaux de stock par produit'
            }
          },
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }
    
    // Créer ou mettre à jour le graphique des mouvements de stock
    if (this.movementChart) {
      this.movementChart.data = this.movementChartData;
      this.movementChart.update();
    } else if (this.movementChartData) {
      this.movementChart = new Chart(this.movementChartCanvas.nativeElement, {
        type: 'pie',
        data: this.movementChartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top'
            },
            title: {
              display: true,
              text: 'Répartition des mouvements de stock'
            }
          }
        }
      });
    }
  }

  // Méthode pour rafraîchir les données
  refreshData(): void {
    this.loadDashboardData();
  }

  // Méthode pour formater la date
  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Méthode pour obtenir la classe CSS en fonction du niveau de stock
  getStockLevelClass(quantity: number): string {
    if (quantity <= 5) return 'danger';
    if (quantity <= 20) return 'warning';
    return 'success';
  }
}
