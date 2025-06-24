import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormControl, Validators } from '@angular/forms';
import { ProductStock } from '../../../services/stock-commande.service';

@Component({
  selector: 'app-quantite-dialog',
  templateUrl: './quantite-dialog.component.html',
  styleUrls: ['./quantite-dialog.component.scss']
})
export class QuantiteDialogComponent {
  quantiteControl: FormControl;

  constructor(
    public dialogRef: MatDialogRef<QuantiteDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { produit: ProductStock }
  ) {
    // Initialiser le FormControl après l'injection de data
    this.quantiteControl = new FormControl(1, [
      Validators.required,
      Validators.min(1),
      Validators.max(this.data.produit.stock || 9999)
    ]);
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.quantiteControl.valid) {
      this.dialogRef.close(this.quantiteControl.value);
    }
  }
}
