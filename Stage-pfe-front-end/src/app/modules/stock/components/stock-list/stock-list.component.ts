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
    
    // Forcer le rechargement complet depuis le serveur en ajoutant un timestamp pour éviter le cache
    // et indiquer qu'il s'agit de la liste officielle des produits
    this.productService.getProducts(false, true, true).subscribe({
      next: (data) => {
        console.log('Produits chargés:', data.length);
        
        // S'assurer que les catégories sont correctement associées aux produits
        this.loadCategories().then(() => {
          console.log('Catégories disponibles:', this.categories);
          
          // Enrichir manuellement les produits avec les catégories
          this.products = data.map(product => {
            console.log('Traitement du produit:', product.name, 'categoryId:', product.categoryId, 'category:', product.category);
            
            // Essayer d'abord d'utiliser la catégorie existante si elle a un nom
            if (product.category && product.category.name && product.category.name !== 'Non catégorisé') {
              console.log('Produit avec catégorie existante valide:', product.name, product.category);
              return product;
            }
            
            // Sinon, essayer de trouver la catégorie par ID
            const categoryId = product.categoryId || (product.category ? product.category.id : null);
            console.log('ID de catégorie à rechercher:', categoryId);
            
            if (categoryId) {
              const category = this.categories.find(c => c.id === categoryId);
              console.log('Catégorie trouvée:', category);
              
              if (category) {
                product.category = {
                  id: category.id,
                  name: category.name
                };
                console.log('Catégorie associée au produit:', product.name, product.category);
              }
            }
            return product;
          });
          
          console.log('Produits enrichis avec catégories dans le composant:', this.products);
          this.applyFilters(); // Applique les filtres initiaux
          this.isLoading = false;
        });
      },
      error: (error) => {
        console.error('Erreur lors du chargement des produits:', error);
        this.errorMessage = 'Impossible de charger les produits. Veuillez réessayer.';
        this.isLoading = false;
      }
    });
  }
  
  loadCategories(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.productService.getCategories().subscribe({
        next: (data) => {
          console.log('Catégories chargées:', data.length);
          this.categories = data;
          resolve();
        },
        error: (error) => {
          console.error('Erreur lors du chargement des catégories:', error);
          this.categories = [];
          resolve(); // Résoudre quand même pour ne pas bloquer le flux
        }
      });
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
      
      // Filtre par catégorie (prend en compte à la fois categoryId et category.id)
      const productCategoryId = product.categoryId || (product.category ? product.category.id : null);
      const matchesCategory = !categoryId || productCategoryId === categoryId;
      
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
      this.isLoading = true;
      const numericId = typeof productId === 'string' ? Number(productId) : productId;
      
      this.productService.deleteProduct(numericId).subscribe({
        next: (response) => {
          console.log('Réponse de suppression:', response);
          this.successMessage = 'Produit supprimé avec succès';
          
          // Supprimer le produit de la liste locale immédiatement
          this.products = this.products.filter(p => p.id !== numericId);
          this.filteredProducts = this.filteredProducts.filter(p => p.id !== numericId);
          
          // Puis recharger complètement la liste depuis le serveur
          setTimeout(() => {
            this.loadProducts();
          }, 500);
          
          // Effacer le message après 3 secondes
          setTimeout(() => {
            this.successMessage = null;
          }, 3000);
        },
        error: (error) => {
          console.error('Erreur lors de la suppression du produit:', error);
          this.errorMessage = `Erreur lors de la suppression: ${error.message || 'Veuillez réessayer'}`;
          this.isLoading = false;
        },
        complete: () => {
          this.isLoading = false;
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
  
  /**
   * Vérifie si des filtres sont actifs
   */
  hasActiveFilters(): boolean {
    const { searchTerm, categoryId, stockStatus, active } = this.filterForm.value;
    return !!searchTerm || !!categoryId || stockStatus !== 'all' || active === true;
  }
  
  /**
   * Récupère le nom d'une catégorie à partir de son ID
   */
  getCategoryName(categoryId: string | number | null | undefined): string {
    if (!categoryId) return 'Non catégorisé';
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.name : 'Non catégorisé';
  }
  
  /**
   * Récupère le libellé du statut de stock
   */
  getStockStatusLabel(status: string): string {
    switch (status) {
      case 'low': return 'Stock faible';
      case 'out': return 'Épuisé';
      default: return 'Tous';
    }
  }
}