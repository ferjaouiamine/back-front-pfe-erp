import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService, Product, ProductCategory } from '../../services/product.service';
import { StockService } from '../../services/stock.service';

@Component({
  selector: 'app-stock-list',
  templateUrl: './stock-list.component.html',
  styleUrls: ['./stock-list.component.scss']
})
export class StockListComponent implements OnInit {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  categories: ProductCategory[] = [];
  filterForm: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  Math = Math; // Rendre Math disponible dans le template
  
  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  
  // Tri
  sortField = 'name';
  sortDirection = 'asc';
  
  constructor(
    private productService: ProductService,
    private stockService: StockService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.filterForm = this.fb.group({
      searchTerm: [''],
      categoryId: [''],
      stockStatus: ['all'], // 'all', 'low', 'out'
      active: [true]
    });
  }
  
  ngOnInit(): void {
    this.loadProducts();
    this.loadCategories();
    
    // Réagir aux changements de filtres
    this.filterForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }
  
  loadProducts(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    this.productService.getProducts().subscribe({
      next: (data) => {
        this.products = data;
        this.applyFilters(); // Applique les filtres initiaux
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des produits:', error);
        this.errorMessage = 'Impossible de charger les produits. Veuillez réessayer.';
        this.isLoading = false;
      }
    });
  }
  
  loadCategories(): void {
    this.productService.getCategories().subscribe({
      next: (data) => {
        this.categories = data;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des catégories:', error);
      }
    });
  }
  
  applyFilters(): void {
    const { searchTerm, categoryId, stockStatus, active } = this.filterForm.value;
    
    // Filtrer les produits en fonction des critères
    this.filteredProducts = this.products.filter(product => {
      // Filtre par terme de recherche
      const matchesSearch = !searchTerm || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.reference && product.reference.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Filtre par catégorie
      const matchesCategory = !categoryId || product.categoryId === categoryId;
      
      // Filtre par statut de stock
      let matchesStockStatus = true;
      if (stockStatus === 'low') {
        matchesStockStatus = product.quantity <= (product.alertThreshold || 10);
      } else if (stockStatus === 'out') {
        matchesStockStatus = product.quantity === 0;
      }
      
      // Filtre par statut actif
      const matchesActive = active === null || active === undefined || product.active === active;
      
      return matchesSearch && matchesCategory && matchesStockStatus && matchesActive;
    });
    
    // Appliquer le tri
    this.sortProducts();
    
    // Mettre à jour la pagination
    this.totalItems = this.filteredProducts.length;
  }
  
  sortProducts(): void {
    this.filteredProducts.sort((a, b) => {
      let valueA: any;
      let valueB: any;
      
      // Déterminer les valeurs à comparer en fonction du champ de tri
      switch (this.sortField) {
        case 'name':
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
          break;
        case 'category':
          valueA = a.category?.name?.toLowerCase() || '';
          valueB = b.category?.name?.toLowerCase() || '';
          break;
        case 'quantity':
          valueA = a.quantity;
          valueB = b.quantity;
          break;
        case 'price':
          valueA = a.price;
          valueB = b.price;
          break;
        default:
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
      }
      
      // Appliquer le tri en fonction de la direction
      if (this.sortDirection === 'asc') {
        return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      } else {
        return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
      }
    });
  }
  
  onSort(field: string): void {
    // Si on clique sur le même champ, inverser la direction
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    
    this.sortProducts();
  }
  
  getSortIcon(field: string): string {
    if (this.sortField !== field) {
      return 'fa-sort';
    }
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }
  
  onPageChange(page: number): void {
    this.currentPage = page;
  }
  
  getPaginatedProducts(): Product[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredProducts.slice(startIndex, startIndex + this.pageSize);
  }
  
  resetFilters(): void {
    this.filterForm.reset({
      searchTerm: '',
      categoryId: '',
      stockStatus: 'all',
      active: true
    });
  }
  
  editProduct(productId: number | string | undefined): void {
    if (productId !== undefined) {
      this.router.navigate(['/stock/edit', productId]);
    }
  }
  
  viewProduct(productId: number | string | undefined): void {
    if (productId !== undefined) {
      this.router.navigate(['/stock/detail', productId]);
    }
  }
  
  createProduct(): void {
    this.router.navigate(['/stock/create']);
  }
  
  deleteProduct(productId: number | string | undefined): void {
    if (productId !== undefined && confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      const numericId = typeof productId === 'string' ? Number(productId) : productId;
      this.productService.deleteProduct(numericId).subscribe({
        next: () => {
          this.successMessage = 'Produit supprimé avec succès';
          // Recharger les produits après suppression
          this.loadProducts();
          
          // Effacer le message après 3 secondes
          setTimeout(() => {
            this.successMessage = null;
          }, 3000);
        },
        error: (error) => {
          console.error('Erreur lors de la suppression du produit:', error);
          this.errorMessage = `Erreur lors de la suppression: ${error.message || 'Veuillez réessayer'}`;
        }
      });
    }
  }
  
  getStockStatusClass(product: Product): string {
    if (product.quantity === 0) {
      return 'bg-danger';
    } else if (product.quantity <= (product.alertThreshold || 10)) {
      return 'bg-warning';
    } else {
      return 'bg-success';
    }
  }
  
  getStockStatusText(product: Product): string {
    if (product.quantity === 0) {
      return 'Épuisé';
    } else if (product.quantity <= (product.alertThreshold || 10)) {
      return 'Faible';
    } else {
      return 'Normal';
    }
  }
}
