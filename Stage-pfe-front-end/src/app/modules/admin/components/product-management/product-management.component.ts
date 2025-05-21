import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Product, ProductService } from '../../../stock/services/product.service';
import { AuthService } from '../../../auth/services/auth.service';

export interface StockMovement {
  id: string;
  productId: string;
  type: 'ENTREE' | 'SORTIE' | 'AJUSTEMENT';
  quantity: number;
  reason: string;
  date: Date;
  userId: string;
  userName: string;
}

@Component({
  selector: 'app-product-management',
  templateUrl: './product-management.component.html',
  styleUrls: ['./product-management.component.scss']
})
export class ProductManagementComponent implements OnInit {
  // Liste des produits
  products: Product[] = [];
  filteredProducts: Product[] = [];
  selectedProduct: Product | null = null;
  
  // Formulaire de produit
  productForm: FormGroup;
  isEditing = false;
  formErrorMessage: string | null = null;
  
  // Filtres et recherche
  searchTerm = '';
  selectedCategory = '';
  categories: string[] = [];
  
  // Alertes de stock
  lowStockThreshold = 10;
  lowStockProducts: Product[] = [];
  
  // Mouvements de stock
  stockMovements: StockMovement[] = [];
  selectedProductMovements: StockMovement[] = [];
  showMovementsModal = false;
  
  // États
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  
  constructor(
    private productService: ProductService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      quantity: [0, [Validators.required, Validators.min(0)]],
      category: ['', Validators.required],
      imageUrl: [''],
    });
  }
  
  ngOnInit(): void {
    this.loadProducts();
  }
  
  loadProducts(): void {
    this.isLoading = true;
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.filteredProducts = [...products];
        this.extractCategories();
        this.checkLowStockProducts();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des produits:', error);
        this.errorMessage = 'Erreur lors du chargement des produits. Veuillez réessayer.';
        this.isLoading = false;
      }
    });
  }
  
  extractCategories(): void {
    // Extraire les catégories uniques des produits
    const categoriesSet = new Set<string>();
    this.products.forEach(product => {
      if (product.category) {
        // Si category est un objet avec une propriété name
        if (typeof product.category === 'object' && product.category.name) {
          categoriesSet.add(product.category.name);
        }
        // Si category est directement une chaîne de caractères
        else if (typeof product.category === 'string') {
          categoriesSet.add(product.category);
        }
      }
    });
    this.categories = Array.from(categoriesSet);
  }
  
  checkLowStockProducts(): void {
    this.lowStockProducts = this.products.filter(product => product.quantity <= this.lowStockThreshold);
  }
  
  searchProducts(): void {
    if (!this.searchTerm && !this.selectedCategory) {
      this.filteredProducts = [...this.products];
      return;
    }
    
    const searchTermLower = this.searchTerm.toLowerCase();
    
    this.filteredProducts = this.products.filter(product => {
      // Vérification pour le terme de recherche
      const matchesSearch = !this.searchTerm || 
        product.name.toLowerCase().includes(searchTermLower) ||
        (product.description && product.description.toLowerCase().includes(searchTermLower));
      
      // Vérification pour la catégorie
      let matchesCategory = !this.selectedCategory;
      
      if (this.selectedCategory && product.category) {
        // Si category est un objet avec une propriété name
        if (typeof product.category === 'object' && product.category.name) {
          matchesCategory = product.category.name === this.selectedCategory;
        }
        // Si category est directement une chaîne de caractères
        else if (typeof product.category === 'string') {
          matchesCategory = product.category === this.selectedCategory;
        }
      }
      
      return matchesSearch && matchesCategory;
    });
  }
  
  resetFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = '';
    this.filteredProducts = [...this.products];
  }
  
  selectProduct(product: Product): void {
    this.selectedProduct = product;
    this.isEditing = true;
    this.formErrorMessage = null;
    
    this.productForm.setValue({
      name: product.name,
      description: product.description || '',
      price: product.price,
      quantity: product.quantity,
      category: product.category && product.category.name ? product.category.name : '',
      imageUrl: ''
    });
    
    // Charger les mouvements de stock pour ce produit
    this.loadProductStockMovements(product.id ? product.id.toString() : '');
  }
  
  loadProductStockMovements(productId: string): void {
    // Cette méthode serait implémentée pour appeler l'API
    // Pour l'instant, nous utilisons des données fictives
    this.selectedProductMovements = [
      {
        id: 'mov_1',
        productId: productId,
        type: 'ENTREE',
        quantity: 10,
        reason: 'Réception commande fournisseur',
        date: new Date(2025, 3, 15),
        userId: 'user_1',
        userName: 'Admin'
      },
      {
        id: 'mov_2',
        productId: productId,
        type: 'SORTIE',
        quantity: 2,
        reason: 'Vente',
        date: new Date(2025, 3, 20),
        userId: 'user_2',
        userName: 'Vendeur'
      },
      {
        id: 'mov_3',
        productId: productId,
        type: 'AJUSTEMENT',
        quantity: -1,
        reason: 'Inventaire',
        date: new Date(2025, 3, 25),
        userId: 'user_1',
        userName: 'Admin'
      }
    ];
  }
  
  newProduct(): void {
    this.selectedProduct = null;
    this.isEditing = true;
    this.formErrorMessage = null;
    this.errorMessage = null;
    this.successMessage = null;
    
    this.productForm.reset({
      name: '',
      description: '',
      price: 0,
      quantity: 0,
      category: '',
      imageUrl: ''
    });
  }
  
  cancelEdit(): void {
    this.isEditing = false;
    this.selectedProduct = null;
    this.formErrorMessage = null;
  }
  
  saveProduct(): void {
    if (this.productForm.invalid) {
      this.formErrorMessage = 'Veuillez corriger les erreurs dans le formulaire.';
      return;
    }
    
    this.isLoading = true;
    this.formErrorMessage = null;
    
    const productData = this.productForm.value;
    
    if (this.selectedProduct) {
      // Mise à jour d'un produit existant
      const updatedProduct = {
        ...this.selectedProduct,
        ...productData
      };
      
      // Cette méthode serait implémentée dans le service
      // Pour l'instant, nous simulons la mise à jour
      setTimeout(() => {
        const index = this.products.findIndex(p => p.id === this.selectedProduct!.id);
        if (index !== -1) {
          this.products[index] = updatedProduct;
          this.filteredProducts = [...this.products];
          this.successMessage = `Produit "${updatedProduct.name}" mis à jour avec succès.`;
          this.isEditing = false;
          this.selectedProduct = null;
          this.checkLowStockProducts();
        }
        this.isLoading = false;
      }, 800);
    } else {
      // Création d'un nouveau produit
      const newProduct: Product = {
        id: `prod_${Date.now()}`,
        ...productData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Cette méthode serait implémentée dans le service
      // Pour l'instant, nous simulons la création
      setTimeout(() => {
        this.products.push(newProduct);
        this.filteredProducts = [...this.products];
        this.successMessage = `Produit "${newProduct.name}" créé avec succès.`;
        this.isEditing = false;
        this.extractCategories();
        this.checkLowStockProducts();
        this.isLoading = false;
      }, 800);
    }
  }
  
  deleteProduct(product: Product): void {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le produit "${product.name}" ?`)) {
      return;
    }
    
    this.isLoading = true;
    
    // Cette méthode serait implémentée dans le service
    // Pour l'instant, nous simulons la suppression
    setTimeout(() => {
      const index = this.products.findIndex(p => p.id === product.id);
      if (index !== -1) {
        this.products.splice(index, 1);
        this.filteredProducts = [...this.products];
        this.successMessage = `Produit "${product.name}" supprimé avec succès.`;
        if (this.selectedProduct?.id === product.id) {
          this.selectedProduct = null;
          this.isEditing = false;
        }
        this.extractCategories();
        this.checkLowStockProducts();
      }
      this.isLoading = false;
    }, 800);
  }
  
  showStockMovements(product: Product): void {
    this.selectedProduct = product;
    this.loadProductStockMovements(product.id ? product.id.toString() : '');
    this.showMovementsModal = true;
  }
  
  closeMovementsModal(): void {
    this.showMovementsModal = false;
  }
  
  addStockMovement(typeStr: string, quantity: number, reason: string): void {
    // Convertir la chaîne en type approprié
    const type = typeStr as 'ENTREE' | 'SORTIE' | 'AJUSTEMENT';
    
    // Vérifier que le type est valide
    if (!['ENTREE', 'SORTIE', 'AJUSTEMENT'].includes(typeStr)) {
      this.errorMessage = 'Type de mouvement invalide';
      return;
    }
    if (!this.selectedProduct) return;
    
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.errorMessage = 'Utilisateur non connecté. Impossible d\'ajouter un mouvement de stock.';
      return;
    }
    
    const movement: StockMovement = {
      id: `mov_${Date.now()}`,
      productId: this.selectedProduct.id ? this.selectedProduct.id.toString() : '',
      type,
      quantity,
      reason,
      date: new Date(),
      userId: currentUser.id,
      userName: currentUser.username || currentUser.email || 'Utilisateur'
    };
    
    // Mettre à jour la quantité du produit
    let newQuantity = this.selectedProduct.quantity;
    if (type === 'ENTREE') {
      newQuantity += quantity;
    } else if (type === 'SORTIE') {
      newQuantity -= quantity;
    } else { // AJUSTEMENT
      newQuantity = quantity;
    }
    
    // Vérifier que la quantité ne devient pas négative
    if (newQuantity < 0) {
      this.errorMessage = 'La quantité ne peut pas être négative.';
      return;
    }
    
    // Cette méthode serait implémentée dans le service
    // Pour l'instant, nous simulons la mise à jour
    this.isLoading = true;
    setTimeout(() => {
      // Ajouter le mouvement
      this.selectedProductMovements.unshift(movement);
      
      // Mettre à jour le produit
      if (this.selectedProduct) {
        this.selectedProduct.quantity = newQuantity;
        this.selectedProduct.updatedAt = new Date();
        
        const index = this.products.findIndex(p => p.id === this.selectedProduct!.id);
        if (index !== -1) {
          this.products[index] = this.selectedProduct;
          this.filteredProducts = [...this.products];
          this.successMessage = `Mouvement de stock ajouté avec succès.`;
          this.checkLowStockProducts();
        }
      }
      
      this.isLoading = false;
    }, 800);
  }
  
  exportInventory(): void {
    // Cette méthode serait implémentée pour générer un export de l'inventaire
    this.successMessage = 'Export de l\'inventaire en cours...';
    setTimeout(() => {
      this.successMessage = 'Export de l\'inventaire terminé. Le fichier a été téléchargé.';
    }, 1500);
  }
  
  getStockStatusClass(quantity: number): string {
    if (quantity <= 0) {
      return 'out-of-stock';
    } else if (quantity <= this.lowStockThreshold) {
      return 'low-stock';
    } else {
      return 'in-stock';
    }
  }
}
