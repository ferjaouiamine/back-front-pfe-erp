import { Injectable } from '@angular/core';
import { loadStripe, Stripe, StripeElements, StripeCardElement } from '@stripe/stripe-js';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable, from, BehaviorSubject, throwError } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class StripeService {
  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private card: StripeCardElement | null = null;
  private paymentIntentId = new BehaviorSubject<string | null>(null);

  constructor(private http: HttpClient) {
    this.initStripe();
  }

  private async initStripe(): Promise<void> {
    // Utiliser la clé publique Stripe depuis l'environnement
    const stripePublicKey = environment.stripe?.publishableKey;
    if (!stripePublicKey) {
      console.error('Clé publique Stripe non configurée dans environment.ts');
      return;
    }
    this.stripe = await loadStripe(stripePublicKey);
  }

  /**
   * Crée un élément de carte Stripe et le monte dans le conteneur spécifié
   * @param elementId ID du conteneur HTML où monter l'élément de carte
   */
  public async createCardElement(elementId: string): Promise<void> {
    if (!this.stripe) {
      await this.initStripe();
    }

    if (this.stripe) {
      this.elements = this.stripe.elements();
      this.card = this.elements.create('card', {
        style: {
          base: {
            color: '#32325d',
            fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
            fontSmoothing: 'antialiased',
            fontSize: '16px',
            '::placeholder': {
              color: '#aab7c4'
            }
          },
          invalid: {
            color: '#fa755a',
            iconColor: '#fa755a'
          }
        }
      });

      this.card.mount(`#${elementId}`);
    }
  }

  /**
   * Crée une intention de paiement sur le serveur
   * @param amount Montant en centimes (ex: 1000 pour 10€)
   * @param currency Devise (ex: 'eur')
   */
  public createPaymentIntent(amount: number, currency: string = 'eur', description?: string): Observable<string> {
    // Utiliser l'URL depuis l'environnement
    return this.http.post<any>(`${environment.apiUrl}/payments/create-payment-intent`, {
      amount: Math.round(amount * 100), // Convertir en centimes
      currency,
      description
    }).pipe(
      tap(response => this.paymentIntentId.next(response.clientSecret)),
      map(response => response.clientSecret)
    );
  }

  /**
   * Confirme le paiement avec les détails de la carte
   */
  public confirmCardPayment(): Observable<any> {
    if (!this.stripe || !this.card) {
      return from(Promise.reject('Stripe n\'est pas initialisé'));
    }

    return this.paymentIntentId.pipe(
      switchMap(clientSecret => {
        if (!clientSecret) {
          return from(Promise.reject('Pas d\'intention de paiement'));
        }
        
        return from(this.stripe!.confirmCardPayment(clientSecret, {
          payment_method: {
            card: this.card!
          }
        }));
      })
    );
  }

  /**
   * Crée un lien de paiement pour un virement bancaire
   * @param amount Montant en centimes
   * @param currency Devise
   * @param email Email du client
   * @returns Un Observable contenant l'URL du lien de paiement et le statut d'envoi d'email
   */
  public createBankTransferLink(amount: number, email: string, currency: string = 'eur', description?: string): Observable<{url: string, emailSent: boolean}> {
    // Utiliser directement l'URL complète pour éviter les problèmes de proxy
    const apiUrl = 'http://localhost:8086/api/payments/create-bank-transfer';
    
    return this.http.post<any>(apiUrl, {
      amount: Math.round(amount * 100),
      currency,
      email,
      description
    }, {
      // Ajouter les options pour permettre les credentials
      withCredentials: true
    }).pipe(
      map(response => ({
        url: response.url,
        emailSent: response.emailSent || false
      })),
      // Ajouter un gestionnaire d'erreur
      catchError(error => {
        console.error('Erreur lors de la création du lien de virement bancaire:', error);
        throw error;
      })
    );
  }

  /**
   * Nettoie les ressources Stripe
   */
  public cleanup(): void {
    if (this.card) {
      this.card.destroy();
      this.card = null;
    }
  }
}
