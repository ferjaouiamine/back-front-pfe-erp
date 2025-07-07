import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { StripeService } from '../../../../shared/services/stripe.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-bank-transfer',
  templateUrl: './bank-transfer.component.html',
  styleUrls: ['./bank-transfer.component.scss']
})
export class BankTransferComponent implements OnInit {
  @Input() amount: number = 0;
  @Output() transferInitiated = new EventEmitter<any>();
  @Output() transferError = new EventEmitter<any>();
  
  transferForm: FormGroup;
  loading: boolean = false;
  error: string | null = null;
  transferUrl: string | null = null;
  successMessage: string | null = null;
  success: boolean = false;

  constructor(
    private fb: FormBuilder,
    private stripeService: StripeService
  ) {
    this.transferForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit(): void {}

  initiateTransfer(): void {
    if (this.transferForm.valid) {
      this.loading = true;
      this.error = null;
      this.transferUrl = null;
      this.success = false;
      this.successMessage = null;

      const email = this.transferForm.get('email')?.value;
      const amount = this.amount;
      const description = `Paiement de ${this.amount} €`;

      this.stripeService.createBankTransferLink(amount, email, 'eur', description)
        .pipe(finalize(() => this.loading = false))
        .subscribe(
          (response) => {
            this.transferUrl = response.url;
            this.success = true;
            
            // Afficher un message spécifique en fonction de l'envoi de l'email
            if (response.emailSent) {
              this.successMessage = `Un email avec les instructions de paiement a été envoyé à ${email}.`;
            } else {
              this.successMessage = 'Le lien de paiement a été créé, mais l\'envoi de l\'email a échoué.';
            }
            
            this.transferInitiated.emit({
              email,
              amount: this.amount,
              url: response.url,
              emailSent: response.emailSent || false
            });
            
            // Ouvrir l'URL dans un nouvel onglet
            window.open(response.url, '_blank');
          },
          (error: any) => {
            this.error = error.error?.message || 'Erreur lors de la création du lien de virement bancaire';
            console.error('Erreur de virement bancaire:', error);
            this.transferError.emit(error);
          }
        );
    }
  }
}
