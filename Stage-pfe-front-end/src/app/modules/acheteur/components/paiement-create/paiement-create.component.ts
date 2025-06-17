import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { StripeService, StripeCardComponent } from 'ngx-stripe';
import { 
  StripeCardElementOptions,
  StripeElementsOptions,
  PaymentIntent,
  StripeCardElementChangeEvent
} from '@stripe/stripe-js';
import { AcheteurService } from '../../services';

@Component({
  selector: 'app-paiement-create',
  templateUrl: './paiement-create.component.html',
  styleUrls: ['./paiement-create.component.scss']
})
export class PaiementCreateComponent implements OnInit {
  @ViewChild(StripeCardComponent) card!: StripeCardComponent;
  
  factureId: number | null = null;
  montant: number = 0;
  paiementForm!: FormGroup;
  loading = false;
  error: string | null = null;
  success: boolean = false;
  paymentIntentId: string | null = null;

  cardOptions: StripeCardElementOptions = {
    style: {
      base: {
        iconColor: '#666EE8',
        color: '#31325F',
        fontWeight: '400',
        fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
        fontSize: '16px',
        '::placeholder': {
          color: '#CFD7E0'
        }
      }
    }
  };

  elementsOptions: StripeElementsOptions = {
    locale: 'fr'
  };

  constructor(
    private fb: FormBuilder,
    private stripeService: StripeService,
    private acheteurService: AcheteurService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.paiementForm = this.fb.group({
      nom: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      montant: [{ value: 0, disabled: true }]
    });

    // Récupérer les paramètres de l'URL (factureId et montant)
    this.route.queryParams.subscribe(params => {
      if (params['factureId']) {
        this.factureId = Number(params['factureId']);
      }
      
      if (params['montant']) {
        this.montant = Number(params['montant']);
        const montantControl = this.paiementForm.get('montant');
        if (montantControl) {
          montantControl.setValue(this.montant);
        }
      }
    });
  }

  async pay(): Promise<void> {
    if (this.paiementForm.invalid) {
      this.error = 'Veuillez remplir correctement tous les champs.';
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      // 1. Créer un PaymentIntent côté serveur
      const emailControl = this.paiementForm.get('email');
      const email = emailControl ? emailControl.value : '';
      
      const paymentIntent = await this.acheteurService.createPaymentIntent(
        this.montant,
        this.factureId,
        email
      ).toPromise();

      if (!paymentIntent) {
        throw new Error('Impossible de créer l\'intention de paiement');
      }

      this.paymentIntentId = paymentIntent.id;

      // 2. Confirmer le paiement avec les détails de la carte
      const nomControl = this.paiementForm.get('nom');
      const nom = nomControl ? nomControl.value : '';
      
      const result = await this.stripeService.confirmCardPayment(paymentIntent.client_secret, {
        payment_method: {
          card: this.card.element,
          billing_details: {
            name: nom,
            email: email
          }
        }
      }).toPromise();

      if (result && result.error) {
        // Afficher l'erreur à l'utilisateur
        this.error = result.error.message || 'Une erreur est survenue lors du paiement';
        this.loading = false;
      } else if (result && result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        // Paiement réussi
        this.success = true;
        this.loading = false;
        
        // Mettre à jour le statut de la facture côté serveur
        if (this.factureId) {
          await this.acheteurService.updateFactureStatus(this.factureId, 'PAYEE').toPromise();
        }
      }
    } catch (error) {
      console.error('Erreur lors du paiement:', error);
      this.error = 'Une erreur est survenue lors du traitement du paiement. Veuillez réessayer.';
      this.loading = false;
    }
  }

  retourFactures(): void {
    this.router.navigate(['/acheteur/factures']);
  }
}
