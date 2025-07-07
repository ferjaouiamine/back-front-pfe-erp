import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-email-dialog',
  templateUrl: './email-dialog.component.html',
  styleUrls: ['./email-dialog.component.scss']
})
export class EmailDialogComponent {
  emailForm: FormGroup;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<EmailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      orderNumber: string;
      supplierName: string;
      supplierEmail?: string;
      subject?: string;
      message?: string;
    }
  ) {
    this.emailForm = this.fb.group({
      email: [data.supplierEmail || '', [Validators.required, Validators.email]],
      subject: [data.subject || `Bon de commande ${data.orderNumber}`, Validators.required],
      message: [data.message || `Veuillez trouver ci-joint le bon de commande ${data.orderNumber}.`, Validators.required]
    });
  }

  onSubmit(): void {
    if (this.emailForm.valid) {
      this.dialogRef.close(this.emailForm.value);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
