import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ProductService, Product } from '../../services/product.service';

@Component({
  selector: 'app-stock-create',
  templateUrl: './stock-create.component.html',
  styleUrls: ['./stock-create.component.scss']
})
export class StockCreateComponent implements OnInit {
  productForm: FormGroup;
  isEditMode = false;
  productId: string | null = null;
  categories: any[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  
  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.productForm = this.fb.group({
      name: ['', [Validators.required]],
      reference: [''],
      description: [''],
      price: [0, [Validators.required, Validators.min(0)]],
      quantity: [0, [Validators.required, Validators.min(0)]],
      alertThreshold: [5, [Validators.required, Validators.min(0)]],
      categoryId: ['', Validators.required],
      active: [true]
    });
  }
  
  ngOnInit(): void {
    // Charger les catégories
    this.loadCategories();
    
    // Vérifier si nous sommes en mode édition
    this.route.paramMap.subscribe(params => {
      this.productId = params.get('id');
      if (this.productId) {
        this.isEditMode = true;
        this.loadProductDetails(this.productId);
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
        this.errorMessage = 'Impossible de charger les catégories. Veuillez réessayer.';
      }
    });
  }
  
  loadProductDetails(id: string): void {
    this.isLoading = true;
    this.productService.getProductById(id).subscribe({
      next: (product) => {
        this.productForm.patchValue({
          name: product.name,
          reference: product.reference || '',
          description: product.description || '',
          price: product.price,
          quantity: product.quantity,
          alertThreshold: product.alertThreshold || 5,
          categoryId: product.category?.id || '',
          active: product.active !== undefined ? product.active : true
        });
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement du produit:', error);
        this.errorMessage = 'Impossible de charger les détails du produit. Veuillez réessayer.';
        this.isLoading = false;
      }
    });
  }
  
  onSubmit(): void {
    if (this.productForm.invalid) {
      // Marquer tous les champs comme touchés pour afficher les erreurs
      Object.keys(this.productForm.controls).forEach(key => {
        this.productForm.get(key)?.markAsTouched();
      });
      return;
    }
    
    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;
    
    const productData: Product = {
      ...this.productForm.value,
      category: {
        id: this.productForm.value.categoryId
      }
    };
    
    // Supprimer la propriété categoryId car elle n'existe pas dans l'interface Product
    delete (productData as any).categoryId;
    
    if (this.isEditMode && this.productId) {
      // Mise à jour d'un produit existant
      productData.id = Number(this.productId);
      this.productService.updateProduct(productData).subscribe({
        next: () => {
          this.successMessage = 'Produit mis à jour avec succès';
          this.isLoading = false;
          setTimeout(() => {
            this.router.navigate(['/stock/list']);
          }, 1500);
        },
        error: (error) => {
          console.error('Erreur lors de la mise à jour du produit:', error);
          this.errorMessage = 'Impossible de mettre à jour le produit. Veuillez réessayer.';
          this.isLoading = false;
        }
      });
    } else {
      // Création d'un nouveau produit
      this.productService.createProduct(productData).subscribe({
        next: () => {
          this.successMessage = 'Produit créé avec succès';
          this.isLoading = false;
          setTimeout(() => {
            this.router.navigate(['/stock/list']);
          }, 1500);
        },
        error: (error) => {
          console.error('Erreur lors de la création du produit:', error);
          this.errorMessage = 'Impossible de créer le produit. Veuillez réessayer.';
          this.isLoading = false;
        }
      });
    }
  }
  
  // Méthode pour annuler et revenir à la liste
  onCancel(): void {
    this.router.navigate(['/stock/list']);
  }
}
