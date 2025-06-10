import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-open-register-dialog',
  templateUrl: './open-register-dialog.component.html',
  styleUrls: ['./open-register-dialog.component.scss']
})
export class OpenRegisterDialogComponent {
  registerForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<OpenRegisterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { cashierId: string }
  ) {
    this.registerForm = this.fb.group({
      startingAmount: [0, [Validators.required, Validators.min(0)]],
      notes: ['']
    });
  }

  onSubmit(): void {
    if (this.registerForm.valid) {
      this.dialogRef.close({
        startingAmount: this.registerForm.value.startingAmount,
        notes: this.registerForm.value.notes,
        cashierId: this.data.cashierId
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
