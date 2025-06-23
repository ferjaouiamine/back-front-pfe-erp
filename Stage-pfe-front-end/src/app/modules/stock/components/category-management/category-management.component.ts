import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProductService, ProductCategory, Product } from '../../services/product.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { CategoryFormDialogComponent } from './category-form-dialog/category-form-dialog.component';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-category-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './category-management.component.html',
  styleUrl: './category-management.component.scss'
})
export class CategoryManagementComponent implements OnInit {
  // Données des catégories
  categories: ProductCategory[] = [];
  filteredCategories: ProductCategory[] = [];
  searchTerm: string = '';
  
  // État du chargement et des erreurs
  loading: boolean = false;
  error: string | null = null;
  
  // Configuration de la table
  displayedColumns: string[] = ['id', 'name', 'productCount', 'actions'];
  
  constructor(
    private productService: ProductService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) { }
  
  ngOnInit(): void {
    this.loadCategoriesWithProductCount();
  }
  
  /**
   * Charge toutes les catégories depuis le service et calcule le nombre de produits pour chaque catégorie
   */
  loadCategoriesWithProductCount(): void {
    this.loading = true;
    this.error = null;
    
    // Récupérer toutes les catégories
    this.productService.getCategories().pipe(
      switchMap((categories: ProductCategory[]) => {
        // Stocker temporairement les catégories
        const tempCategories = categories;
        
        // Récupérer le nombre de produits par catégorie
        return this.productService.getCategoryProductCounts().pipe(
          map((counts: {[categoryId: string]: number}) => ({ categories: tempCategories, counts })),
          catchError((err: Error) => {
            console.error(`Erreur lors du chargement du nombre de produits par catégorie: ${err.message}`);
            // En cas d'erreur, retourner les catégories sans les comptages
            return of({ categories: tempCategories, counts: {} as {[categoryId: string]: number} });
          })
        );
      })
    ).subscribe({
      next: (result: { categories: ProductCategory[], counts: {[categoryId: string]: number} }) => {
        // Associer les comptages aux catégories
        this.categories = result.categories.map((category: ProductCategory) => ({
          ...category,
          productCount: result.counts[category.id.toString()] || 0
        }));
        
        console.log('Catégories avec nombre de produits:', this.categories);
        this.applyFilter(); // Appliquer le filtre initial
        this.loading = false;
      },
      error: (err: Error) => {
        this.error = `Erreur lors du chargement des catégories: ${err.message}`;
        this.loading = false;
      }
    });
  }
  
  /**
   * Charge toutes les catégories depuis le service (méthode simple sans comptage des produits)
   */
  loadCategories(): void {
    this.loading = true;
    this.error = null;
    
    this.productService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.applyFilter(); // Appliquer le filtre initial
        this.loading = false;
      },
      error: (err) => {
        this.error = `Erreur lors du chargement des catégories: ${err.message}`;
        this.loading = false;
      }
    });
  }
  
  /**
   * Applique le filtre de recherche sur les catégories
   */
  applyFilter(): void {
    if (!this.searchTerm || this.searchTerm.trim() === '') {
      this.filteredCategories = [...this.categories];
      return;
    }
    
    const searchTermLower = this.searchTerm.toLowerCase().trim();
    this.filteredCategories = this.categories.filter(category => 
      category.name.toLowerCase().includes(searchTermLower) ||
      category.id.toString().includes(searchTermLower)
    );
  }
  
  /**
   * Gère le changement dans le champ de recherche
   */
  onSearchChange(): void {
    this.applyFilter();
  }
  
  /**
   * Ouvre le dialogue pour ajouter une nouvelle catégorie
   */
  openAddCategoryDialog(): void {
    const dialogRef = this.dialog.open(CategoryFormDialogComponent, {
      width: '400px',
      data: { title: 'Ajouter une catégorie', category: { name: '' } }
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.addCategory(result);
      }
    });
  }
  
  /**
   * Ajoute une nouvelle catégorie
   */
  addCategory(category: ProductCategory): void {
    this.loading = true;
    
    this.productService.createCategory(category).subscribe({
      next: (newCategory: ProductCategory) => {
        this.categories.push(newCategory);
        this.applyFilter();
        this.loading = false;
        this.snackBar.open('Catégorie ajoutée avec succès', 'Fermer', { duration: 3000 });
      },
      error: (err: Error) => {
        this.error = `Erreur lors de l'ajout de la catégorie: ${err.message}`;
        this.loading = false;
        this.snackBar.open('Erreur lors de l\'ajout de la catégorie', 'Fermer', { duration: 3000 });
      }
    });
  }
  
  /**
   * Ouvre le dialogue pour éditer une catégorie existante
   */
  openEditCategoryDialog(category: ProductCategory): void {
    const dialogRef = this.dialog.open(CategoryFormDialogComponent, {
      width: '400px',
      data: { title: 'Modifier la catégorie', category: {...category} }
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.updateCategory(result);
      }
    });
  }
  
  /**
   * Met à jour une catégorie existante
   */
  updateCategory(category: ProductCategory): void {
    this.loading = true;
    
    this.productService.updateCategory(category).subscribe({
      next: (updatedCategory: ProductCategory) => {
        const index = this.categories.findIndex(c => c.id === updatedCategory.id);
        if (index !== -1) {
          this.categories[index] = updatedCategory;
        }
        this.applyFilter();
        this.loading = false;
        this.snackBar.open('Catégorie mise à jour avec succès', 'Fermer', { duration: 3000 });
      },
      error: (err: Error) => {
        this.error = `Erreur lors de la mise à jour de la catégorie: ${err.message}`;
        this.loading = false;
        this.snackBar.open('Erreur lors de la mise à jour de la catégorie', 'Fermer', { duration: 3000 });
      }
    });
  }
  
  /**
   * Ouvre le dialogue de confirmation pour supprimer une catégorie
   */
  openDeleteCategoryDialog(category: ProductCategory): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Confirmer la suppression',
        message: `Êtes-vous sûr de vouloir supprimer la catégorie "${category.name}" ? Cette action est irréversible.`,
        confirmText: 'Supprimer',
        cancelText: 'Annuler'
      }
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.deleteCategory(category.id);
      }
    });
  }
  
  /**
   * Supprime une catégorie
   */
  deleteCategory(categoryId: number | string): void {
    this.loading = true;
    
    this.productService.deleteCategory(categoryId).subscribe({
      next: () => {
        this.categories = this.categories.filter(c => c.id !== categoryId);
        this.applyFilter();
        this.loading = false;
        this.snackBar.open('Catégorie supprimée avec succès', 'Fermer', { duration: 3000 });
      },
      error: (err: Error) => {
        this.error = `Erreur lors de la suppression de la catégorie: ${err.message}`;
        this.loading = false;
        this.snackBar.open('Erreur lors de la suppression de la catégorie', 'Fermer', { duration: 3000 });
      }
    });
  }
  
  /**
   * Rafraîchit la liste des catégories
   */
  refreshCategories(): void {
    this.loadCategoriesWithProductCount();
  }
}
