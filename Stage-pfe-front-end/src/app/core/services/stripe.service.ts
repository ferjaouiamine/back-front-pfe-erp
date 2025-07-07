import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class StripeService {
  private apiUrl = `${environment.apiUrl}/payments`;

  constructor(
    private http: HttpClient,
    private apiService: ApiService
  ) { }

  /**
   * Crée une intention de paiement pour un paiement par carte
   * @param amount Montant en centimes
   * @param currency Devise (par défaut EUR)
   * @param description Description optionnelle du paiement
   * @returns Observable contenant le client secret et l'ID de l'intention de paiement
   */
  createPaymentIntent(amount: number, currency: string = 'eur', description?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/create-payment-intent`, {
      amount,
      currency,
      description
    });
  }

  /**
   * Crée un lien de paiement par virement bancaire
   * @param amount Montant en centimes
   * @param currency Devise (par défaut EUR)
   * @param email Email du client
   * @param description Description optionnelle du paiement
   * @returns Observable contenant l'URL du lien de paiement
   */
  createBankTransferLink(amount: number, email: string, currency: string = 'eur', description?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/create-bank-transfer`, {
      amount,
      currency,
      email,
      description
    });
  }

  /**
   * Récupère la clé publique Stripe depuis l'environnement
   * @returns La clé publique Stripe
   */
  getPublicKey(): string {
    return environment.stripe.publishableKey;
  }
}
