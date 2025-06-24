import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { Product as CatalogProduct, ProductService } from '../../services/product.service';
import { OrderItemForm } from '../../models/order-item-creation.model';

@Component({
  selector: 'app-order-item-creation',
  templateUrl: './order-item-creation.component.html',
  styleUrls: ['./order-item-creation.component.scss']
})
export class OrderItemCreationComponent implements OnInit {
  @Input() supplierId: string | null = null;
  @Output() itemAdded = new EventEmitter<OrderItemForm>();
  @Output() cancel = new EventEmitter<void>();

  itemForm: FormGroup;
  products: CatalogProduct[] = [];
  filteredProducts: CatalogProduct[] = [];
  isLoading = false;
  searchTerm = '';
  showProductList = false;
  selectedProduct: CatalogProduct | null = null;

  constructor(
    private fb: FormBuilder,
    private productService: ProductService
  ) {
    this.itemForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadProducts();
    
    // Écouter les changements dans le champ de recherche
    this.itemForm.get('searchTerm')?.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(term => this.filterProducts(term))
      )
      .subscribe(products => {
        this.filteredProducts = products;
        this.showProductList = products.length > 0 && this.searchTerm.length > 0;
      });
      
    // Calculer le total automatiquement quand la quantité ou le prix change
    this.itemForm.get('quantity')?.valueChanges.subscribe(() => this.calculateTotal());
    this.itemForm.get('unitPrice')?.valueChanges.subscribe(() => this.calculateTotal());
  }

  /**
   * Crée le formulaire pour l'ajout d'article
   */
  private createForm(): FormGroup {
    return this.fb.group({
      searchTerm: [''],
      productId: ['', Validators.required],
      productName: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      total: [0]
    });
  }

  /**
   * Charge la liste des produits
   */
  loadProducts(): void {
    this.isLoading = true;
    
    this.productService.getProducts(false) // false = ne pas utiliser les données fictives sauf si nécessaire
      .subscribe({
        next: (products) => {
          this.products = products;
          this.filteredProducts = [...products];
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Erreur lors du chargement des produits:', error);
          this.isLoading = false;
        }
      });
  }

  /**
   * Filtre les produits en fonction du terme de recherche
   */
  filterProducts(term: string): Observable<CatalogProduct[]> {
    this.searchTerm = term;
    
    if (!term || term.trim() === '') {
      return of([]);
    }
    
    const filtered = this.products.filter(product => 
      product.name.toLowerCase().includes(term.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(term.toLowerCase())) ||
      (product.category && product.category.name && product.category.name.toLowerCase().includes(term.toLowerCase()))
    );
    
    return of(filtered);
  }

  /**
   * Sélectionne un produit de la liste filtrée
   */
  selectProduct(product: CatalogProduct): void {
    this.selectedProduct = product;
    this.showProductList = false;
    
    this.itemForm.patchValue({
      searchTerm: product.name,
      productId: product.id ? product.id.toString() : '',
      productName: product.name,
      unitPrice: product.price || 0
    });
    
    this.calculateTotal();
  }

  /**
   * Calcule le total de l'article
   */
  calculateTotal(): void {
    const quantity = this.itemForm.get('quantity')?.value || 0;
    const unitPrice = this.itemForm.get('unitPrice')?.value || 0;
    const total = quantity * unitPrice;
    
    this.itemForm.patchValue({ total }, { emitEvent: false });
  }

  /**
   * Ajoute l'article à la commande
   */
  addItem(): void {
    if (this.itemForm.invalid) {
      // Marquer tous les champs comme touchés pour afficher les erreurs
      Object.keys(this.itemForm.controls).forEach(key => {
        const control = this.itemForm.get(key);
        control?.markAsTouched();
      });
      return;
    }
    
    const itemData: OrderItemForm = {
      productId: this.itemForm.get('productId')?.value,
      productName: this.itemForm.get('productName')?.value,
      quantity: this.itemForm.get('quantity')?.value,
      unitPrice: this.itemForm.get('unitPrice')?.value,
      total: this.itemForm.get('total')?.value
    };
    
    this.itemAdded.emit(itemData);
    this.resetForm();
  }

  /**
   * Réinitialise le formulaire
   */
  resetForm(): void {
    this.itemForm.reset({
      searchTerm: '',
      productId: '',
      productName: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
    });
    this.selectedProduct = null;
    this.showProductList = false;
  }

  /**
   * Annule l'ajout d'article
   */
  cancelAddItem(): void {
    this.cancel.emit();
    this.resetForm();
  }
}
