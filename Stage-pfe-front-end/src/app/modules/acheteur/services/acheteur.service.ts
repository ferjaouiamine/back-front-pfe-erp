import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, delay } from 'rxjs/operators';
import { AuthService } from '../../auth/services/auth.service';

export interface PaymentIntent {
  id: string;
  client_secret: string;
  amount: number;
  currency: string;
  status: string;
}

export interface Facture {
  id: number;
  numero: string;
  dateCreation: string;
  montantTotal: number;
  statut: string;
  payee: boolean;
}

export interface Paiement {
  id: number;
  reference: string;
  factureId: number;
  factureNumero: string;
  montant: number;
  date: string;
  statut: string;
  methode: string;
}

@Injectable({
  providedIn: 'root'
})
export class AcheteurService {
  // URL de l'API de paiement - Ã  ajuster selon votre configuration backend
  private apiUrl = 'http://localhost:8086/api/paiements';
  private simulationMode = true; // Mode simulation activÃ© pour le dÃ©veloppement sans backend

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  /**
   * RÃ©cupÃ¨re la liste des factures de l'acheteur connectÃ©
   */
  getFactures(): Observable<Facture[]> {
    if (this.simulationMode) {
      return this.simulateGetFactures();
    }

    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    return this.http.get<Facture[]>(`${this.apiUrl}/factures`, { headers })
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la rÃ©cupÃ©ration des factures:', error);
          return throwError(() => new Error('Impossible de rÃ©cupÃ©rer les factures. Veuillez rÃ©essayer.'));
        })
      );
  }

  /**
   * RÃ©cupÃ¨re la liste des paiements de l'acheteur connectÃ©
   */
  getPaiements(): Observable<Paiement[]> {
    if (this.simulationMode) {
      return this.simulateGetPaiements();
    }

    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    return this.http.get<Paiement[]>(`${this.apiUrl}/historique`, { headers })
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la rÃ©cupÃ©ration des paiements:', error);
          return throwError(() => new Error('Impossible de rÃ©cupÃ©rer les paiements. Veuillez rÃ©essayer.'));
        })
      );
  }

  /**
   * CrÃ©e une intention de paiement avec Stripe
   */
  createPaymentIntent(montant: number, factureId: number | null, email: string): Observable<PaymentIntent> {
    if (this.simulationMode) {
      return this.simulateCreatePaymentIntent(montant);
    }

    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    let params = new HttpParams()
      .set('montant', montant.toString())
      .set('email', email);
      
    if (factureId) {
      params = params.set('factureId', factureId.toString());
    }

    return this.http.post<PaymentIntent>(`${this.apiUrl}/create-payment-intent`, null, { headers, params })
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la crÃ©ation de l\'intention de paiement:', error);
          return throwError(() => new Error('Impossible de crÃ©er l\'intention de paiement. Veuillez rÃ©essayer.'));
        })
      );
  }

  /**
   * Met Ã  jour le statut d'une facture aprÃ¨s paiement
   */
  updateFactureStatus(factureId: number, statut: string): Observable<any> {
    if (this.simulationMode) {
      return this.simulateUpdateFactureStatus();
    }

    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    const params = new HttpParams()
      .set('statut', statut);

    return this.http.put(`${this.apiUrl}/factures/${factureId}/statut`, null, { headers, params })
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la mise Ã  jour du statut de la facture:', error);
          return throwError(() => new Error('Impossible de mettre Ã  jour le statut de la facture.'));
        })
      );
  }

  /**
   * TÃ©lÃ©charge le reÃ§u d'un paiement
   */
  downloadRecu(paiementId: number): Observable<Blob> {
    if (this.simulationMode) {
      return this.simulateDownloadRecu();
    }

    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    return this.http.get(`${this.apiUrl}/${paiementId}/recu`, { 
      headers, 
      responseType: 'blob' 
    }).pipe(
      catchError(error => {
        console.error('Erreur lors du tÃ©lÃ©chargement du reÃ§u:', error);
        return throwError(() => new Error('Impossible de tÃ©lÃ©charger le reÃ§u. Veuillez rÃ©essayer.'));
      })
    );
  }

  // MÃ©thodes de simulation pour le dÃ©veloppement sans backend

  private simulateGetFactures(): Observable<Facture[]> {
    const factures: Facture[] = [
      {
        id: 1,
        numero: 'FAC-2025-001',
        dateCreation: '2025-06-01',
        montantTotal: 450.75,
        statut: 'En attente',
        payee: false
      },
      {
        id: 2,
        numero: 'FAC-2025-002',
        dateCreation: '2025-06-05',
        montantTotal: 320.50,
        statut: 'En attente',
        payee: false
      },
      {
        id: 3,
        numero: 'FAC-2025-003',
        dateCreation: '2025-06-08',
        montantTotal: 480.00,
        statut: 'En attente',
        payee: false
      }
    ];
    
    return of(factures).pipe(delay(500));
  }

  private simulateGetPaiements(): Observable<Paiement[]> {
    const paiements: Paiement[] = [
      {
        id: 1,
        reference: 'PAY-2025-001',
        factureId: 1,
        factureNumero: 'FAC-2025-001',
        montant: 450.75,
        date: '2025-06-09',
        statut: 'ComplÃ©tÃ©',
        methode: 'Carte bancaire'
      },
      {
        id: 2,
        reference: 'PAY-2025-002',
        factureId: 2,
        factureNumero: 'FAC-2025-002',
        montant: 320.50,
        date: '2025-06-10',
        statut: 'ComplÃ©tÃ©',
        methode: 'Carte bancaire'
      }
    ];
    
    return of(paiements).pipe(delay(500));
  }

  private simulateCreatePaymentIntent(montant: number): Observable<PaymentIntent> {
    // Simuler une intention de paiement Stripe
    const paymentIntent: PaymentIntent = {
      id: 'pi_' + Math.random().toString(36).substr(2, 9),
      client_secret: 'pi_' + Math.random().toString(36).substr(2, 9) + '_secret_' + Math.random().toString(36).substr(2, 9),
      amount: montant * 100, // Stripe utilise les centimes
      currency: 'eur',
      status: 'requires_payment_method'
    };
    
    return of(paymentIntent).pipe(delay(500));
  }

  private simulateUpdateFactureStatus(): Observable<any> {
    return of({ success: true }).pipe(delay(500));
  }

  private simulateDownloadRecu(): Observable<Blob> {
    // Simuler un PDF vide
    const pdfBlob = new Blob(['ReÃ§u simulÃ©'], { type: 'application/pdf' });
    return of(pdfBlob).pipe(delay(500));
  }
}
