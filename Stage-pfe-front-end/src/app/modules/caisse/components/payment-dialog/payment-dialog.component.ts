import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PaymentMethod } from '../../models/pos.models';
import { StripeService } from '../../../../shared/services/stripe.service';
import { MatSnackBar } from '@angular/material/snack-bar';

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
  
  // États de paiement
  cardPaymentProcessing: boolean = false;
  cardPaymentSuccess: boolean = false;
  cardPaymentError: string | null = null;
  
  transferInitiated: boolean = false;
  transferError: string | null = null;
  transferDetails: any = null;

  constructor(
    private dialogRef: MatDialogRef<PaymentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private fb: FormBuilder,
    private stripeService: StripeService,
    private snackBar: MatSnackBar
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
   * Vérifie si le bouton de confirmation de paiement doit être désactivé
   */
  isPaymentButtonDisabled(): boolean {
    const method = this.paymentForm.get('method')?.value;
    
    if (this.paymentForm.invalid) {
      return true;
    }
    
    switch (method) {
      case PaymentMethod.CASH:
        return this.amountTendered < this.amountDue;
      case PaymentMethod.CARD:
        return this.cardPaymentProcessing || !this.cardPaymentSuccess;
      case PaymentMethod.TRANSFER:
        return !this.transferInitiated;
      default:
        return true;
    }
  }
  
  /**
   * Gère le succès du paiement par carte
   */
  onCardPaymentSuccess(event: any): void {
    this.cardPaymentSuccess = true;
    this.cardPaymentError = null;
    this.snackBar.open('Paiement par carte réussi!', 'Fermer', {
      duration: 3000,
      panelClass: 'success-snackbar'
    });
  }
  
  /**
   * Gère l'erreur du paiement par carte
   */
  onCardPaymentError(error: any): void {
    this.cardPaymentSuccess = false;
    this.cardPaymentError = error.message || 'Erreur lors du traitement du paiement par carte';
    this.snackBar.open(this.cardPaymentError || 'Erreur de paiement', 'Fermer', {
      duration: 5000,
      panelClass: 'error-snackbar'
    });
  }
  
  /**
   * Gère l'initialisation du virement bancaire
   */
  onTransferInitiated(event: any): void {
    this.transferInitiated = true;
    this.transferError = null;
    this.transferDetails = event;
    this.snackBar.open('Instructions de virement envoyées!', 'Fermer', {
      duration: 3000,
      panelClass: 'success-snackbar'
    });
  }
  
  /**
   * Gère l'erreur du virement bancaire
   */
  onTransferError(error: any): void {
    this.transferInitiated = false;
    this.transferError = error.message || 'Erreur lors de la création du virement bancaire';
    this.snackBar.open(this.transferError || 'Erreur de virement', 'Fermer', {
      duration: 5000,
      panelClass: 'error-snackbar'
    });
  }
  
  /**
   * Confirme le paiement et ferme le dialogue
   */
  confirmPayment(): void {
    if (this.paymentForm.invalid) {
      return;
    }
    
    const method = this.paymentForm.get('method')?.value;
    let paymentDetails: any = {
      method: method,
      printReceipt: this.paymentForm.get('printReceipt')?.value
    };
    
    switch (method) {
      case PaymentMethod.CASH:
        paymentDetails.amountTendered = this.amountTendered;
        paymentDetails.change = this.change;
        break;
      case PaymentMethod.CARD:
        if (!this.cardPaymentSuccess) {
          this.snackBar.open('Veuillez compléter le paiement par carte avant de confirmer', 'Fermer', {
            duration: 3000
          });
          return;
        }
        break;
      case PaymentMethod.TRANSFER:
        if (!this.transferInitiated) {
          this.snackBar.open('Veuillez initialiser le virement avant de confirmer', 'Fermer', {
            duration: 3000
          });
          return;
        }
        paymentDetails.transferDetails = this.transferDetails;
        break;
    }
    
    this.dialogRef.close(paymentDetails);
  }

  /**
   * Annule le paiement et ferme le dialogue
   */
  cancel(): void {
    this.dialogRef.close();
  }
}
