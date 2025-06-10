import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-close-register-dialog',
  templateUrl: './close-register-dialog.component.html',
  styleUrls: ['./close-register-dialog.component.scss']
})
export class CloseRegisterDialogComponent {
  closeForm: FormGroup;
  expectedAmount: number;
  difference: number = 0;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<CloseRegisterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { sessionId: string, expectedAmount: number }
  ) {
    this.expectedAmount = this.data.expectedAmount || 0;
    this.closeForm = this.fb.group({
      countedAmount: [this.expectedAmount, [Validators.required, Validators.min(0)]],
      notes: ['']
    });

    // Calculer la différence à chaque changement du montant compté
    this.closeForm.get('countedAmount')?.valueChanges.subscribe(value => {
      this.difference = parseFloat(value) - this.expectedAmount;
    });
  }

  onSubmit(): void {
    if (this.closeForm.valid) {
      this.dialogRef.close({
        countedAmount: parseFloat(this.closeForm.value.countedAmount),
        notes: this.closeForm.value.notes,
        difference: this.difference,
        sessionId: this.data.sessionId
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
