import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ProductCategory } from '../../../services/product.service';

@Component({
  selector: 'app-category-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './category-form-dialog.component.html',
  styleUrl: './category-form-dialog.component.scss'
})
export class CategoryFormDialogComponent {
  categoryForm: FormGroup;
  title: string;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<CategoryFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string, category: ProductCategory }
  ) {
    this.title = data.title;
    
    this.categoryForm = this.fb.group({
      id: [data.category.id || null],
      name: [data.category.name || '', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]]
    });
  }

  /**
   * Ferme le dialogue sans sauvegarder
   */
  onCancel(): void {
    this.dialogRef.close();
  }

  /**
   * Soumet le formulaire et ferme le dialogue avec les données
   */
  onSubmit(): void {
    if (this.categoryForm.valid) {
      this.dialogRef.close(this.categoryForm.value);
    }
  }

  /**
   * Vérifie si le champ a une erreur spécifique
   */
  hasError(controlName: string, errorName: string): boolean {
    const control = this.categoryForm.get(controlName);
    return control !== null && control.hasError(errorName) && control.touched;
  }
}
