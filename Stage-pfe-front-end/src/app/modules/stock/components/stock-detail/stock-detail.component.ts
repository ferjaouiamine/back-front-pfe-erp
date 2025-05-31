import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService, Product } from '../../services/product.service';
import { StockService } from '../../services/stock.service';

interface StockMovement {
  id?: number;
  date: Date;
  productId: number;
  productName: string;
  type: 'ENTRY' | 'EXIT';
  quantity: number;
  reason: string;
  reference?: string;
}

@Component({
  selector: 'app-stock-detail',
  templateUrl: './stock-detail.component.html',
  styleUrls: ['./stock-detail.component.scss']
})
export class StockDetailComponent implements OnInit {
  product: Product | null = null;
  productId: string | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  recentMovements: StockMovement[] = [];
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private stockService: StockService
  ) { }
  
  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.productId = params.get('id');
      if (this.productId) {
        this.loadProduct(this.productId);
        this.loadProductMovements(this.productId);
      } else {
        this.errorMessage = 'ID de produit non spécifié';
      }
    });
  }
  
  loadProduct(id: string): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    this.productService.getProductById(id).subscribe({
      next: (data) => {
        this.product = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement du produit:', error);
        this.errorMessage = 'Impossible de charger les détails du produit. Veuillez réessayer.';
        this.isLoading = false;
      }
    });
  }
  
  loadProductMovements(productId: string): void {
    // Dans un cas réel, vous appelleriez votre API pour récupérer les mouvements de stock
    // Ici, nous simulons des données
    this.recentMovements = [
      {
        date: new Date(Date.now() - 86400000 * 2), // 2 jours avant
        productId: Number(productId),
        productName: 'Chargement...',
        type: 'ENTRY',
        quantity: 10,
        reason: 'Réception fournisseur',
        reference: 'BON-12345'
      },
      {
        date: new Date(Date.now() - 86400000), // 1 jour avant
        productId: Number(productId),
        productName: 'Chargement...',
        type: 'EXIT',
        quantity: 3,
        reason: 'Vente',
        reference: 'FAC-5678'
      }
    ];
    
    // Mettre à jour le nom du produit une fois qu'il est chargé
    if (this.product) {
      this.recentMovements.forEach(movement => {
        movement.productName = this.product?.name || '';
      });
    }
  }
  
  editProduct(): void {
    if (this.productId) {
      this.router.navigate(['/stock/edit', this.productId]);
    }
  }
  
  deleteProduct(): void {
    if (!this.product || !this.productId) return;
    
    if (confirm(`Êtes-vous sûr de vouloir supprimer le produit ${this.product.name} ?`)) {
      this.productService.deleteProduct(Number(this.productId)).subscribe({
        next: () => {
          alert('Produit supprimé avec succès');
          this.router.navigate(['/stock/list']);
        },
        error: (error) => {
          console.error('Erreur lors de la suppression du produit:', error);
          this.errorMessage = `Erreur lors de la suppression: ${error.message || 'Veuillez réessayer'}`;
        }
      });
    }
  }
  
  goToStockMovement(): void {
    this.router.navigate(['/stock/movements']);
  }
  
  goBack(): void {
    this.router.navigate(['/stock/list']);
  }
  
  getStockStatusClass(): string {
    if (!this.product) return '';
    
    if (this.product.quantity === 0) {
      return 'text-danger';
    } else if (this.product.quantity <= (this.product.alertThreshold || 10)) {
      return 'text-warning';
    } else {
      return 'text-success';
    }
  }
  
  getStockStatusText(): string {
    if (!this.product) return '';
    
    if (this.product.quantity === 0) {
      return 'Épuisé';
    } else if (this.product.quantity <= (this.product.alertThreshold || 10)) {
      return 'Stock faible';
    } else {
      return 'Stock normal';
    }
  }
  
  getMovementTypeClass(type: 'ENTRY' | 'EXIT'): string {
    return type === 'ENTRY' ? 'text-success' : 'text-danger';
  }
  
  getMovementTypeIcon(type: 'ENTRY' | 'EXIT'): string {
    return type === 'ENTRY' ? 'fa-arrow-down' : 'fa-arrow-up';
  }
  
  getMovementTypeText(type: 'ENTRY' | 'EXIT'): string {
    return type === 'ENTRY' ? 'Entrée' : 'Sortie';
  }
  
  formatDate(date: Date): string {
    if (!date) return '';
    
    const d = new Date(date);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }
}
