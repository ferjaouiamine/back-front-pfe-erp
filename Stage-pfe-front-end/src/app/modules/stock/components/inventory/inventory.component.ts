import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ProductService, Product } from '../../services/product.service';
import { StockService } from '../../services/stock.service';

interface InventoryItem {
  product: Product;
  currentQuantity: number;
  countedQuantity: number;
  difference: number;
  notes: string;
}

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss']
})
export class InventoryComponent implements OnInit {
  inventoryForm: FormGroup;
  products: Product[] = [];
  filteredProducts: Product[] = [];
  selectedProducts: Product[] = [];
  inventoryItems: InventoryItem[] = [];
  isLoading = false;
  isSubmitting = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  searchTerm = '';
  categoryFilter = ''; // ID de catégorie sous forme de string
  categories: any[] = [];

  // État de l'inventaire
  inventoryStarted = false;
  inventoryCompleted = false;
  inventoryDate = new Date();
  inventoryReference = '';

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private stockService: StockService
  ) {
    this.inventoryForm = this.fb.group({
      reference: ['INV-' + this.generateReferenceNumber(), Validators.required],
      date: [this.formatDate(new Date()), Validators.required],
      notes: [''],
      items: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.loadProducts();
    this.loadCategories();
  }

  get itemsFormArray(): FormArray {
    return this.inventoryForm.get('items') as FormArray;
  }

  loadProducts(): void {
    this.isLoading = true;
    this.productService.getProducts().subscribe({
      next: (data) => {
        this.products = data.filter(p => p.active);
        this.filteredProducts = [...this.products];
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

  filterProducts(): void {
    this.filteredProducts = this.products.filter(product => {
      // Filtrer par terme de recherche
      const matchesSearch = !this.searchTerm ||
        product.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (product.reference && product.reference.toLowerCase().includes(this.searchTerm.toLowerCase()));

      // Filtrer par catégorie
      const matchesCategory = !this.categoryFilter || product.category?.id?.toString() === this.categoryFilter;

      // Exclure les produits déjà sélectionnés
      const notSelected = !this.selectedProducts.some(p => p.id === product.id);

      return matchesSearch && matchesCategory && notSelected;
    });
  }

  onSearch(): void {
    this.filterProducts();
  }

  onCategoryChange(): void {
    this.filterProducts();
  }

  addProductToInventory(product: Product): void {
    this.selectedProducts.push(product);

    const inventoryItem: InventoryItem = {
      product: product,
      currentQuantity: product.quantity,
      countedQuantity: product.quantity, // Par défaut, on initialise avec la quantité actuelle
      difference: 0,
      notes: ''
    };

    this.inventoryItems.push(inventoryItem);

    // Ajouter au FormArray
    this.itemsFormArray.push(
      this.fb.group({
        productId: [product.id, Validators.required],
        productName: [product.name],
        currentQuantity: [product.quantity],
        countedQuantity: [product.quantity, [Validators.required, Validators.min(0)]],
        difference: [0],
        notes: ['']
      })
    );

    // Mettre à jour la liste filtrée pour exclure ce produit
    this.filterProducts();
  }

  removeProductFromInventory(index: number): void {
    const removedProduct = this.selectedProducts[index];

    // Supprimer des tableaux
    this.selectedProducts.splice(index, 1);
    this.inventoryItems.splice(index, 1);

    // Supprimer du FormArray
    this.itemsFormArray.removeAt(index);

    // Mettre à jour la liste filtrée pour inclure à nouveau ce produit
    this.filterProducts();
  }

  updateDifference(index: number): void {
    const itemGroup = this.itemsFormArray.at(index) as FormGroup;
    const currentQuantity = itemGroup.get('currentQuantity')?.value || 0;
    const countedQuantity = itemGroup.get('countedQuantity')?.value || 0;
    const difference = countedQuantity - currentQuantity;

    itemGroup.get('difference')?.setValue(difference);
    this.inventoryItems[index].difference = difference;
  }

  startInventory(): void {
    this.inventoryStarted = true;
    this.inventoryReference = this.inventoryForm.get('reference')?.value;
    this.inventoryDate = new Date(this.inventoryForm.get('date')?.value);
  }

  cancelInventory(): void {
    if (confirm('Êtes-vous sûr de vouloir annuler cet inventaire ? Toutes les données saisies seront perdues.')) {
      this.resetInventory();
    }
  }

  resetInventory(): void {
    this.inventoryStarted = false;
    this.inventoryCompleted = false;
    this.selectedProducts = [];
    this.inventoryItems = [];
    this.itemsFormArray.clear();
    this.inventoryForm.reset({
      reference: 'INV-' + this.generateReferenceNumber(),
      date: this.formatDate(new Date()),
      notes: ''
    });
    this.filterProducts();
  }

  submitInventory(): void {
    if (this.inventoryForm.invalid) {
      // Marquer tous les champs comme touchés pour afficher les erreurs
      Object.keys(this.inventoryForm.controls).forEach(key => {
        const control = this.inventoryForm.get(key);
        control?.markAsTouched();

        if (key === 'items' && control instanceof FormArray) {
          control.controls.forEach(itemGroup => {
            Object.keys((itemGroup as FormGroup).controls).forEach(itemKey => {
              (itemGroup as FormGroup).get(itemKey)?.markAsTouched();
            });
          });
        }
      });
      return;
    }

    if (this.itemsFormArray.length === 0) {
      this.errorMessage = 'Veuillez ajouter au moins un produit à l\'inventaire.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = null;
    this.successMessage = null;

    // Préparer les données pour l'envoi
    const inventoryData = {
      reference: this.inventoryForm.get('reference')?.value,
      date: this.inventoryForm.get('date')?.value,
      notes: this.inventoryForm.get('notes')?.value,
      items: this.itemsFormArray.value
    };

    // Traiter chaque ajustement de stock
    const adjustments = this.itemsFormArray.value.map((item: any) => {
      return {
        productId: item.productId,
        difference: item.difference,
        reason: `Ajustement d'inventaire: ${inventoryData.reference}`,
        notes: item.notes
      };
    });

    // Simuler l'envoi à l'API (à remplacer par l'appel réel)
    setTimeout(() => {
      console.log('Données d\'inventaire envoyées:', inventoryData);
      this.isSubmitting = false;
      this.inventoryCompleted = true;
      this.successMessage = 'Inventaire enregistré avec succès.';

      // Dans un cas réel, vous appelleriez votre API ici
      // this.stockService.submitInventory(inventoryData).subscribe(...)
    }, 1500);
  }

  // Utilitaires
  generateReferenceNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    return `${year}${month}${day}-${random}`;
  }

  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  getDifferenceClass(difference: number): string {
    if (difference < 0) return 'text-danger';
    if (difference > 0) return 'text-success';
    return '';
  }
  
  isProductSelected(productId: number): boolean {
    return this.selectedProducts.some(p => p.id === productId);
  }
}
