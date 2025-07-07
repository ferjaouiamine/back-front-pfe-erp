import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { StripeService } from '../../../../shared/services/stripe.service';

@Component({
  selector: 'app-stripe-card',
  templateUrl: './stripe-card.component.html',
  styleUrls: ['./stripe-card.component.scss']
})
export class StripeCardComponent implements OnInit, OnDestroy {
  @Input() amount: number = 0;
  @Output() paymentSuccess = new EventEmitter<any>();
  @Output() paymentError = new EventEmitter<any>();
  
  loading: boolean = false;
  error: string | null = null;

  constructor(private stripeService: StripeService) {}

  ngOnInit(): void {
    // Initialiser l'élément de carte Stripe
    setTimeout(() => {
      this.stripeService.createCardElement('card-element');
    }, 100);
  }

  ngOnDestroy(): void {
    // Nettoyer les ressources Stripe
    this.stripeService.cleanup();
  }

  async processPayment(): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      // Créer une intention de paiement
      this.stripeService.createPaymentIntent(this.amount, 'eur')
        .subscribe(
          () => {
            // Confirmer le paiement avec les détails de la carte
            this.stripeService.confirmCardPayment().subscribe(
              result => {
                this.loading = false;
                if (result.error) {
                  this.error = result.error.message;
                  this.paymentError.emit(result.error);
                } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
                  this.paymentSuccess.emit({
                    paymentIntentId: result.paymentIntent.id,
                    amount: this.amount,
                    status: 'succeeded'
                  });
                }
              },
              error => {
                this.loading = false;
                this.error = 'Erreur lors du traitement du paiement';
                this.paymentError.emit(error);
              }
            );
          },
          error => {
            this.loading = false;
            this.error = 'Erreur lors de la création de l\'intention de paiement';
            this.paymentError.emit(error);
          }
        );
    } catch (error) {
      this.loading = false;
      this.error = 'Erreur inattendue lors du traitement du paiement';
      this.paymentError.emit(error);
    }
  }
}
