import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PaymentMethod } from '../../models/pos.models';

@Component({
  selector: 'app-payment-dialog',
  templateUrl: './payment-dialog.component.html',
  styleUrls: ['./payment-dialog.component.scss']
})
export class PaymentDialogComponent implements OnInit {
  paymentForm: FormGroup;
  paymentMethods = Object.values(PaymentMethod);
  
  // Montants calculés
  amountDue: number = 0;
  amountTendered: number = 0;
  change: number = 0;
  
  // Options
  printReceipt: boolean = true;

  constructor(
    private dialogRef: MatDialogRef<PaymentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private fb: FormBuilder
  ) {
    this.amountDue = data.total || 0;
    
    this.paymentForm = this.fb.group({
      method: [PaymentMethod.CASH, Validators.required],
      amountTendered: [this.amountDue, [Validators.required, Validators.min(0)]],
      printReceipt: [true]
    });
  }

  ngOnInit(): void {
    // Écouter les changements sur le montant donné pour calculer la monnaie
    this.paymentForm.get('amountTendered')?.valueChanges.subscribe(value => {
      this.calculateChange();
    });
    
    // Écouter les changements de méthode de paiement
    this.paymentForm.get('method')?.valueChanges.subscribe(method => {
      if (method === PaymentMethod.CASH) {
        this.paymentForm.get('amountTendered')?.enable();
      } else {
        // Pour les cartes et autres méthodes, le montant exact est utilisé
        this.paymentForm.get('amountTendered')?.setValue(this.amountDue);
        this.paymentForm.get('amountTendered')?.disable();
        this.change = 0;
      }
    });
  }

  /**
   * Calcule la monnaie à rendre
   */
  calculateChange(): void {
    const tendered = parseFloat(this.paymentForm.get('amountTendered')?.value || 0);
    this.amountTendered = tendered;
    this.change = Math.max(0, tendered - this.amountDue);
  }

  /**
   * Ajoute rapidement un montant au paiement
   */
  addAmount(amount: number): void {
    const currentAmount = parseFloat(this.paymentForm.get('amountTendered')?.value || 0);
    this.paymentForm.get('amountTendered')?.setValue(currentAmount + amount);
  }

  /**
   * Définit un montant exact pour le paiement
   */
  setExactAmount(amount: number): void {
    this.paymentForm.get('amountTendered')?.setValue(amount);
  }

  /**
   * Confirme le paiement et ferme le dialogue
   */
  confirmPayment(): void {
    if (this.paymentForm.invalid) {
      return;
    }
    
    const paymentDetails = {
      method: this.paymentForm.get('method')?.value,
      amountTendered: this.amountTendered,
      change: this.change,
      printReceipt: this.paymentForm.get('printReceipt')?.value
    };
    
    this.dialogRef.close(paymentDetails);
  }

  /**
   * Annule le paiement et ferme le dialogue
   */
  cancel(): void {
    this.dialogRef.close();
  }
}
