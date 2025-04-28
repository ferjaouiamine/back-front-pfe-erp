import { Component, OnInit } from '@angular/core';
import { Product } from '../../../../modules/stock/services/product.service';
import { ProductService } from '../../../../modules/stock/services/product.service';
import { Facture, FactureItem } from '../../../../modules/facturation/services/facture.service';
import { FactureService } from '../../../../modules/facturation/services/facture.service';
import { AuthService } from '../../../../modules/auth/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-vendor-dashboard',
  templateUrl: './vendor-dashboard.component.html',
  styleUrls: ['./vendor-dashboard.component.scss']
})
export class VendorDashboardComponent implements OnInit {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  searchTerm: string = '';
  selectedCategory: string = '';
  categories: string[] = [];
  
  // Panier d'achat
  cartItems: FactureItem[] = [];
  
  // Informations client
  clientName: string = '';
  clientEmail: string = '';
  clientPhone: string = '';
  
  // Informations facture
  taxRate: number = 20; // TVA 20%
  subtotal: number = 0;
  taxAmount: number = 0;
  total: number = 0;
  discount: number = 0;
  
  // États
  isLoading: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  
  constructor(
    private productService: ProductService,
    private factureService: FactureService,
    public authService: AuthService,
    private router: Router
  ) { }

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
        categoriesSet.add(product.category);
      }
    });
    this.categories = Array.from(categoriesSet);
  }
  
  searchProducts(): void {
    if (!this.searchTerm && !this.selectedCategory) {
      this.filteredProducts = [...this.products];
      return;
    }
    
    this.filteredProducts = this.products.filter(product => {
      const matchesSearch = !this.searchTerm || 
        product.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(this.searchTerm.toLowerCase());
        
      const matchesCategory = !this.selectedCategory || 
        product.category === this.selectedCategory;
        
      return matchesSearch && matchesCategory;
    });
  }
  
  filterByCategory(category: string): void {
    this.selectedCategory = category;
    this.searchProducts();
  }
  
  resetFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = '';
    this.filteredProducts = [...this.products];
  }
  
  addToCart(product: Product): void {
    // Vérifier si le produit est déjà dans le panier
    const existingItem = this.cartItems.find(item => item.productId === product.id);
    
    if (existingItem) {
      // Incrémenter la quantité
      existingItem.quantity += 1;
      // La propriété totalPrice a été supprimée de l'interface FactureItem
    } else {
      // Ajouter un nouvel élément au panier
      const newItem: FactureItem = {
        id: `item_${Date.now()}`,
        factureId: '',
        productId: product.id,
        productName: product.name,
        description: product.description,
        quantity: 1,
        unitPrice: product.price
      };
      this.cartItems.push(newItem);
    }
    
    // Mettre à jour les totaux
    this.updateTotals();
  }
  
  removeFromCart(index: number): void {
    this.cartItems.splice(index, 1);
    this.updateTotals();
  }
  
  updateItemQuantity(index: number, quantity: number): void {
    if (quantity <= 0) {
      this.removeFromCart(index);
      return;
    }
    
    const item = this.cartItems[index];
    item.quantity = quantity;
    // La propriété totalPrice a été supprimée de l'interface FactureItem
    
    this.updateTotals();
  }
  
  updateTotals(): void {
    // Calculer le sous-total
    this.subtotal = this.factureService.calculateSubtotal(this.cartItems);
    
    // Calculer la TVA
    this.taxAmount = this.factureService.calculateTaxAmount(this.subtotal, this.taxRate);
    
    // Calculer le total
    this.total = this.factureService.calculateTotal(this.subtotal, this.taxAmount, this.discount);
  }
  
  applyDiscount(discountAmount: number): void {
    this.discount = discountAmount;
    this.updateTotals();
  }
  
  createFacture(): void {
    if (this.cartItems.length === 0) {
      this.errorMessage = 'Le panier est vide. Veuillez ajouter des produits.';
      return;
    }
    
    if (!this.clientName) {
      this.errorMessage = 'Veuillez saisir le nom du client.';
      return;
    }
    
    this.isLoading = true;
    this.errorMessage = null;
    
    // Créer l'objet facture
    const currentUser = this.authService.getCurrentUser();
    const vendorId = currentUser?.id || 'vendor_123';
    const vendorName = currentUser?.username || 'Vendeur Test';
    const vendorEmail = 'vendeur@example.com';
    
    // Créer l'objet facture avec les propriétés requises par la nouvelle interface
    const facture: Facture = {
      id: `fact_${Date.now()}`,
      number: `F-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      date: new Date(),
      dueDate: new Date(new Date().setDate(new Date().getDate() + 15)), // Échéance à 15 jours
      clientName: this.clientName,
      clientEmail: this.clientEmail,
      items: this.cartItems,
      discount: this.discount,
      total: this.total,
      status: 'PENDING',
      vendorId: vendorId,
      vendorName: vendorName,
      vendorEmail: vendorEmail,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Envoyer la facture au serveur
    this.factureService.createFacture(facture).subscribe({
      next: (response) => {
        this.successMessage = `Facture ${response.number} créée avec succès.`;
        this.isLoading = false;
        
        // Réinitialiser le formulaire
        this.resetForm();
        
        // Rediriger vers la page de détail de la facture après 2 secondes
        setTimeout(() => {
          this.router.navigate(['/facturation', response.id]);
        }, 2000);
      },
      error: (error) => {
        console.error('Erreur lors de la création de la facture:', error);
        this.errorMessage = 'Erreur lors de la création de la facture. Veuillez réessayer.';
        this.isLoading = false;
      }
    });
  }
  
  resetForm(): void {
    this.cartItems = [];
    this.clientName = '';
    this.clientEmail = '';

    this.discount = 0;
    this.updateTotals();
  }
  
  viewSales(): void {
    this.router.navigate(['/facturation']);
  }
}
