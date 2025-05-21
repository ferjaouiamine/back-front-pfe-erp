import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Facture, FactureItem, FactureService } from '../../services/facture.service';
import { Product, ProductService } from '../../../stock/services/product.service';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-facture-create',
  templateUrl: './facture-create.component.html',
  styleUrls: ['./facture-create.component.scss']
})
export class FactureCreateComponent implements OnInit {
  facture: Facture;
  factureForm: FormGroup;
  selectedItems: FactureItem[] = [];
  realProducts: Product[] = [];
  mockProducts: Product[] = [];
  displayedProducts: Product[] = [];
  useMockData: boolean = false;
  isLoading: boolean = false;
  isSubmitting: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(
    private factureService: FactureService,
    private productService: ProductService,
    private authService: AuthService,
    private formBuilder: FormBuilder,
    private router: Router
  ) {
    this.facture = this.factureService.createEmptyFacture();
    this.factureForm = this.formBuilder.group({
      clientName: ['', Validators.required],
      clientEmail: ['', [Validators.required, Validators.email]],
      clientAddress: [''],
      clientPhone: [''],
      notes: [''],
      productId: [''],
      quantity: [1, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.productService.getAllProductsRealAndMock().subscribe({
      next: (result) => {
        this.realProducts = result.real;
        this.mockProducts = result.mock;
        this.displayedProducts = this.useMockData ? this.mockProducts : this.realProducts;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = 'Erreur chargement produits.';
        this.mockProducts = this.productService['generateMockProductsFromMySQLStructure']();
        this.displayedProducts = this.mockProducts;
        this.useMockData = true;
        this.isLoading = false;
      }
    });
  }

  toggleProductSource(): void {
    this.useMockData = !this.useMockData;
    this.displayedProducts = this.useMockData ? this.mockProducts : this.realProducts;
  }

  addProductToFacture(): void {
    const productId = this.factureForm.get('productId')?.value;
    const quantity = this.factureForm.get('quantity')?.value;

    if (!productId || !quantity || quantity < 1) {
      this.errorMessage = 'Produit et quantité requis.';
      return;
    }

    const product = this.displayedProducts.find(p => p.id == productId);
    if (!product) {
      this.errorMessage = 'Produit introuvable.';
      return;
    }

    const factureItem: FactureItem = {
      id: `temp-${Date.now()}-${Math.random()}`,
      factureId: this.facture.id,
      productId: product.id?.toString() || '',
      productName: product.name,
      description: product.description || '',
      quantity: quantity,
      unitPrice: product.price,
      total: quantity * product.price,
      category: product.category
    };

    this.selectedItems.push(factureItem);
    this.updateFactureTotal();
    this.factureForm.patchValue({ productId: '', quantity: 1 });
    this.errorMessage = null;
  }

  removeProductFromFacture(index: number): void {
    if (index >= 0 && index < this.selectedItems.length) {
      this.selectedItems.splice(index, 1);
      this.updateFactureTotal();
    }
  }

  updateFactureTotal(): void {
    const subtotal = this.selectedItems.reduce((sum, item) => sum + item.total, 0);
    const taxRate = 20;
    const taxAmount = subtotal * (taxRate / 100);

    this.facture.subtotal = subtotal;
    this.facture.tax = taxAmount;
    this.facture.total = subtotal + taxAmount;
    this.facture.items = [...this.selectedItems];
  }

  submitFacture(): void {
    if (this.selectedItems.length === 0) {
      this.errorMessage = 'Ajoutez au moins un produit.';
      return;
    }
    if (this.factureForm.invalid) {
      this.errorMessage = 'Champs client requis.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = null;

    this.facture.clientName = this.factureForm.get('clientName')?.value;
    this.facture.clientEmail = this.factureForm.get('clientEmail')?.value;
    this.facture.clientAddress = this.factureForm.get('clientAddress')?.value;
    this.facture.clientPhone = this.factureForm.get('clientPhone')?.value;
    this.facture.notes = this.factureForm.get('notes')?.value;
    this.facture.date = new Date();
    this.facture.dueDate = new Date(new Date().setDate(new Date().getDate() + 30));
    this.facture.status = 'PENDING';
    this.facture.items = [...this.selectedItems];

    this.factureService.createFacture(this.facture).subscribe({
      next: (createdFacture) => {
        this.isSubmitting = false;
        this.successMessage = 'Facture créée avec succès!';
        setTimeout(() => {
          this.router.navigate(['/facturation', createdFacture.id]);
        }, 1500);
      },
      error: (error) => {
        this.errorMessage = 'Erreur création facture.';
        this.isSubmitting = false;
      }
    });
  }

  cancelFacture(): void {
    this.router.navigate(['/facturation']);
  }

  calculateProductTotal(price: number, quantity: number): number {
    return price * quantity;
  }
}
