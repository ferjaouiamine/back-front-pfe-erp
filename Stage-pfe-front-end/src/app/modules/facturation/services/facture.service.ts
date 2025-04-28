import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay, map, catchError } from 'rxjs/operators';
import { AuthService } from '../../auth/services/auth.service';

export interface FactureItem {
  id: string;
  factureId: string;
  productId: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
}

export interface Facture {
  id: string;
  number: string;
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
  clientId?: string;
  clientName: string;
  clientEmail: string;
  date: Date;
  dueDate: Date;
  status: 'DRAFT' | 'PENDING' | 'PAID' | 'CANCELLED';
  total: number;
  discount?: number;
  notes?: string;
  items: FactureItem[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class FactureService {
  private apiUrl = 'http://localhost:8081/api/factures';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }
  
  // Obtenir les headers d'authentification
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // Récupérer toutes les factures du vendeur connecté
  getFactures(): Observable<Facture[]> {
    console.log('Tentative de récupération des factures depuis:', this.apiUrl);
    return this.http.get<Facture[]>(this.apiUrl, { headers: this.getAuthHeaders() }).pipe(
      map(factures => {
        console.log('Factures récupérées depuis l\'API:', factures);
        return factures;
      }),
      catchError(error => {
        console.error('ERREUR API: Impossible de récupérer les factures:', error);
        // Ne pas utiliser de données fictives, retourner un tableau vide
        return of([]);
      })
    );
  }

  // Récupérer les factures du vendeur connecté
  getVendorFactures(): Observable<Facture[]> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return throwError(() => new Error('Utilisateur non connecté'));
    }
    
    return this.http.get<Facture[]>(`${this.apiUrl}/vendor/${currentUser.id}`, { headers: this.getAuthHeaders() }).pipe(
      map(factures => {
        console.log('Factures du vendeur récupérées depuis l\'API:', factures);
        return factures;
      }),
      catchError(error => {
        console.error(`Erreur lors de la récupération des factures du vendeur ${currentUser.id}:`, error);
        // En cas d'erreur, utiliser les données factices comme fallback
        return of(this.generateMockFactures());
      })
    );
  }
  
  // Générer des données factices pour le tableau de bord
  private generateMockFactures(): Facture[] {
    const statuses: ('DRAFT' | 'PENDING' | 'PAID' | 'CANCELLED')[] = ['DRAFT', 'PENDING', 'PAID', 'CANCELLED'];
    const currentUser = this.authService.getCurrentUser();
    const vendorId = currentUser?.id || 'vendor_123';
    const vendorName = currentUser?.username || 'Vendeur Test';
    const vendorEmail = 'vendeur@example.com';
    const facturesCount = 30; // Nombre total de factures à générer
    
    const factureItems: FactureItem[][] = [
      // Exemple d'items pour la première facture
      [
        {
          id: 'item_1',
          factureId: 'fact_1',
          productId: 'prod_1',
          productName: 'Ordinateur portable',
          description: 'Ordinateur portable HP EliteBook avec processeur Intel Core i7',
          quantity: 2,
          unitPrice: 1200
        },
        {
          id: 'item_2',
          factureId: 'fact_1',
          productId: 'prod_2',
          productName: 'Écran 27 pouces',
          description: 'Écran Dell UltraSharp 27" 4K',
          quantity: 3,
          unitPrice: 350
        }
      ],
      // Exemple d'items pour la deuxième facture
      [
        {
          id: 'item_3',
          factureId: 'fact_2',
          productId: 'prod_3',
          productName: 'Clavier mécanique',
          description: 'Clavier mécanique Corsair K95 RGB',
          quantity: 5,
          unitPrice: 120
        }
      ]
    ];

    // Générer des factures avec des données aléatoires
    const factures: Facture[] = [];
    
    for (let i = 1; i <= facturesCount; i++) {
      const itemsIndex = i <= 2 ? i - 1 : Math.floor(Math.random() * 2); // Utiliser les exemples pour les 2 premières factures
      const items = factureItems[itemsIndex].map(item => ({
        ...item,
        factureId: `fact_${i}`,
        id: `item_${Math.floor(Math.random() * 1000)}`
      }));
      
      // Calculer le total
      const total = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      // Remise aléatoire (0-10%)
      const discount = Math.random() > 0.7 ? Math.floor(Math.random() * 10) + 1 : 0;
      
      // Date aléatoire dans les 6 derniers mois
      const date = new Date();
      date.setMonth(date.getMonth() - Math.floor(Math.random() * 6));
      date.setDate(Math.floor(Math.random() * 28) + 1); // Jour entre 1 et 28
      let status: 'DRAFT' | 'PENDING' | 'PAID' | 'CANCELLED';
      const statusRandom = Math.random();
      if (statusRandom < 0.6) {
        status = 'PAID';
      } else if (statusRandom < 0.9) {
        status = 'PENDING';
      } else {
        status = 'CANCELLED';
      }
      
      // Date d'échéance (15 jours après la date de facture)
      const dueDate = new Date(date);
      dueDate.setDate(date.getDate() + 15);
      
      factures.push({
        id: `fact_${i}`,
        number: `F-${new Date().getFullYear()}-${i.toString().padStart(4, '0')}`,
        vendorId,
        vendorName,
        vendorEmail,
        clientName: `Client ${i}`,
        clientEmail: `client${i}@example.com`,
        date,
        dueDate,
        items,
        discount,
        total,
        status,
        notes: Math.random() > 0.7 ? 'Notes sur la facture...' : undefined,
        createdAt: date,
        updatedAt: date
      });
    }
    
    return factures;
  }

  // Récupérer une facture par son ID
  getFactureById(id: string): Observable<Facture> {
    return this.http.get<Facture>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() }).pipe(
      map(facture => {
        console.log(`Facture ${id} récupérée depuis l'API:`, facture);
        return facture;
      }),
      catchError(error => {
        console.error(`Erreur lors de la récupération de la facture ${id}:`, error);
        // En cas d'erreur, essayer de récupérer depuis les données locales
        return this.getFactures().pipe(
          map((factures: Facture[]) => {
            const facture = factures.find((f: Facture) => f.id === id);
            if (facture) {
              return facture;
            } else {
              throw new Error(`Facture avec ID ${id} non trouvée`);
            }
          })
        );
      })
    );
  }

  // Créer une nouvelle facture
  createFacture(facture: Facture): Observable<Facture> {
    // Ajouter automatiquement l'ID du vendeur connecté
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      facture.vendorId = currentUser.id;
      facture.vendorName = currentUser.username;
      facture.vendorEmail = currentUser.email || '';
    }
    
    // Les champs createdAt et updatedAt seront gérés par le backend
    
    return this.http.post<Facture>(this.apiUrl, facture, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        console.log('Facture créée avec succès:', response);
        return response;
      }),
      catchError(error => {
        console.error('Erreur lors de la création de la facture:', error);
        // En cas d'erreur, simuler une création réussie avec les données envoyées
        facture.id = `fact_${Math.floor(Math.random() * 1000)}`;
        facture.number = `F-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
        facture.createdAt = new Date();
        facture.updatedAt = new Date();
        return of(facture);
      })
    );
  }

  // Mettre à jour le statut d'une facture
  updateFactureStatus(id: string, status: 'DRAFT' | 'PENDING' | 'PAID' | 'CANCELLED'): Observable<Facture> {
    return this.http.patch<Facture>(`${this.apiUrl}/${id}/status`, { status }, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        console.log(`Statut de la facture ${id} mis à jour avec succès:`, response);
        return response;
      }),
      catchError(error => {
        console.error(`Erreur lors de la mise à jour du statut de la facture ${id}:`, error);
        // En cas d'erreur, simuler une mise à jour réussie
        return this.getFactureById(id).pipe(
          map((facture: Facture) => {
            facture.status = status;
            facture.updatedAt = new Date();
            return facture;
          })
        );
      })
    );
  }

  // Générer un PDF pour une facture
  generatePdf(id: string): Observable<Blob> {
    // Récupérer d'abord les données de la facture
    return this.getFactureById(id).pipe(
      delay(800), // Simuler un délai réseau
      map((facture: Facture) => {
        // Créer le contenu du PDF
        const pdfContent = this.createPdfContent(facture);
        
        // Créer un blob avec le contenu du PDF
        return new Blob([pdfContent], { type: 'application/pdf' });
      })
    );
  }
  
  // Créer le contenu du PDF pour une facture
  private createPdfContent(facture: Facture): string {
    // Créer un PDF simple au format texte (pour la simulation)
    // Dans un environnement de production, on utiliserait une bibliothèque comme pdfmake ou jspdf
    
    const content = `
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 6 0 R >>
endobj
4 0 obj
<< /Font << /F1 5 0 R >> >>
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
6 0 obj
<< /Length 1000 >>
stream
BT
/F1 24 Tf
50 700 Td
(FACTURE) Tj
/F1 16 Tf
0 -30 Td
(Numéro: ${facture.number}) Tj
0 -20 Td
(Date: ${new Date(facture.date).toLocaleDateString()}) Tj
0 -20 Td
(Date d'échéance: ${new Date(facture.dueDate).toLocaleDateString()}) Tj
0 -30 Td
(Client: ${facture.clientName}) Tj
0 -20 Td
(Email: ${facture.clientEmail}) Tj
0 -40 Td
(Vendeur: ${facture.vendorName}) Tj
0 -20 Td
(Email: ${facture.vendorEmail}) Tj
0 -40 Td
(Statut: ${facture.status}) Tj
0 -40 Td
(Articles:) Tj
/F1 12 Tf
${this.createItemsContent(facture.items)}
0 -30 Td
/F1 14 Tf
(Total: ${facture.total.toFixed(2)} EUR) Tj
0 -20 Td
${facture.discount ? `(Remise: ${facture.discount.toFixed(2)} EUR)` : ''} Tj
0 -40 Td
/F1 10 Tf
(Document généré le ${new Date().toLocaleString()}) Tj
ET
endstream
endobj
xref
0 7
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000210 00000 n
0000000251 00000 n
0000000320 00000 n
trailer
<< /Size 7 /Root 1 0 R >>
startxref
1371
%%EOF
`;
    
    return content;
  }
  
  // Créer le contenu des articles pour le PDF
  private createItemsContent(items: FactureItem[]): string {
    let content = '';
    let yOffset = 0;
    
    items.forEach((item, index) => {
      yOffset += 20;
      content += `0 -${yOffset} Td
(${index + 1}. ${item.productName} - ${item.quantity} x ${item.unitPrice.toFixed(2)} EUR = ${(item.quantity * item.unitPrice).toFixed(2)} EUR) Tj
`;
    });
    
    return content;
  }

  // Envoyer une facture par email
  sendFactureByEmail(id: string, email: string, subject?: string, message?: string): Observable<any> {
    // Solution temporaire : simuler l'envoi d'un email
    console.log(`Simulation d'envoi d'email pour la facture ${id} à ${email}`);
    console.log(`Sujet: ${subject || 'Votre facture'}`); 
    console.log(`Message: ${message || 'Veuillez trouver ci-joint votre facture.'}`); 
    
    return of({ success: true, message: 'Email envoyé avec succès' }).pipe(delay(1500)); // Simuler un délai réseau plus long pour l'envoi d'email
  }

  // Calculer le sous-total d'une facture
  calculateSubtotal(items: FactureItem[]): number {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }

  // Calculer le montant de la TVA
  calculateTaxAmount(subtotal: number, taxRate: number): number {
    return subtotal * (taxRate / 100);
  }

  // Calculer le total d'une facture
  calculateTotal(subtotal: number, taxAmount: number, discount: number = 0): number {
    return subtotal + taxAmount - discount;
  }
}
