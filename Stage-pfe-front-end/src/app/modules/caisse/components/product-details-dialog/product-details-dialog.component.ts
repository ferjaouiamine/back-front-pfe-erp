import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormControl, Validators } from '@angular/forms';

@Component({
  selector: 'app-product-details-dialog',
  templateUrl: './product-details-dialog.component.html',
  styleUrls: ['./product-details-dialog.component.scss']
})
export class ProductDetailsDialogComponent {
  quantityControl = new FormControl(1, [Validators.required, Validators.min(1)]);
  
  constructor(
    public dialogRef: MatDialogRef<ProductDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { product: any }
  ) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onAddToCart(): void {
    if (this.quantityControl.valid) {
      this.dialogRef.close({ quantity: this.quantityControl.value });
    }
  }
}
