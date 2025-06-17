import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductService } from '../../../stock/services/product.service';

export interface Category {
  id?: string;
  name: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
  productCount?: number;
}

@Component({
  selector: 'app-category-management',
  templateUrl: './category-management.component.html',
  styleUrls: ['./category-management.component.scss']
})
export class CategoryManagementComponent implements OnInit {
  // Liste des catégories
  categories: Category[] = [];
  filteredCategories: Category[] = [];
  selectedCategory: Category | null = null;
  
  // Formulaire de catégorie
  categoryForm: FormGroup;
  isEditing = false;
  formErrorMessage: string | null = null;
  
  // Filtres et recherche
  searchTerm = '';
  
  // États
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  
  constructor(
    private productService: ProductService,
    private fb: FormBuilder
  ) {
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['']
    });
  }
  
  ngOnInit(): void {
    this.loadCategories();
  }
  
  loadCategories(): void {
    this.isLoading = true;
    
    // Simulation de chargement des catégories
    // Dans un environnement réel, cela serait remplacé par un appel API
    setTimeout(() => {
      this.categories = [
        { id: '1', name: 'Informatique', description: 'Produits informatiques', productCount: 15 },
        { id: '2', name: 'Électronique', description: 'Produits électroniques', productCount: 8 },
        { id: '3', name: 'Bureautique', description: 'Fournitures de bureau', productCount: 5 },
        { id: '4', name: 'Mobilier', description: 'Mobilier de bureau', productCount: 3 }
      ];
      this.filteredCategories = [...this.categories];
      this.isLoading = false;
    }, 500);
  }
  
  searchCategories(): void {
    if (!this.searchTerm) {
      this.filteredCategories = [...this.categories];
      return;
    }
    
    const searchTermLower = this.searchTerm.toLowerCase();
    
    this.filteredCategories = this.categories.filter(category => 
      category.name.toLowerCase().includes(searchTermLower) ||
      (category.description && category.description.toLowerCase().includes(searchTermLower))
    );
  }
  
  selectCategory(category: Category): void {
    this.selectedCategory = { ...category };
    this.categoryForm.patchValue({
      name: category.name,
      description: category.description || ''
    });
    this.isEditing = true;
    this.formErrorMessage = null;
  }
  
  newCategory(): void {
    this.selectedCategory = null;
    this.categoryForm.reset({
      name: '',
      description: ''
    });
    this.isEditing = true;
    this.formErrorMessage = null;
  }
  
  cancelEdit(): void {
    this.isEditing = false;
    this.selectedCategory = null;
  }
  
  saveCategory(): void {
    if (this.categoryForm.invalid) {
      this.formErrorMessage = 'Veuillez remplir correctement tous les champs obligatoires.';
      return;
    }
    
    const formData = this.categoryForm.value;
    
    this.isLoading = true;
    
    // Simulation de sauvegarde
    // Dans un environnement réel, cela serait remplacé par un appel API
    setTimeout(() => {
      if (this.selectedCategory && this.selectedCategory.id) {
        // Mise à jour d'une catégorie existante
        const index = this.categories.findIndex(c => c.id === this.selectedCategory!.id);
        if (index !== -1) {
          const updatedCategory: Category = {
            ...this.selectedCategory,
            name: formData.name,
            description: formData.description,
            updatedAt: new Date()
          };
          
          this.categories[index] = updatedCategory;
          this.successMessage = `Catégorie "${updatedCategory.name}" mise à jour avec succès.`;
        }
      } else {
        // Création d'une nouvelle catégorie
        const newCategory: Category = {
          id: `cat_${Date.now()}`,
          name: formData.name,
          description: formData.description,
          createdAt: new Date(),
          updatedAt: new Date(),
          productCount: 0
        };
        
        this.categories.push(newCategory);
        this.successMessage = `Catégorie "${newCategory.name}" créée avec succès.`;
      }
      
      this.filteredCategories = [...this.categories];
      this.isEditing = false;
      this.selectedCategory = null;
      this.isLoading = false;
    }, 800);
  }
  
  deleteCategory(category: Category): void {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la catégorie "${category.name}" ?`)) {
      return;
    }
    
    this.isLoading = true;
    
    // Simulation de suppression
    // Dans un environnement réel, cela serait remplacé par un appel API
    setTimeout(() => {
      const index = this.categories.findIndex(c => c.id === category.id);
      if (index !== -1) {
        this.categories.splice(index, 1);
        this.filteredCategories = [...this.categories];
        this.successMessage = `Catégorie "${category.name}" supprimée avec succès.`;
        
        if (this.selectedCategory?.id === category.id) {
          this.selectedCategory = null;
          this.isEditing = false;
        }
      }
      this.isLoading = false;
    }, 800);
  }
}
