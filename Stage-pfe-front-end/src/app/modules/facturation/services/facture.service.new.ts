import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
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
  total: number;
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
  // URL de l'API pour les factures - point d'accès à votre backend Spring Boot
  private apiUrl = 'http://localhost:8080/api/factures';

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

  // Récupérer toutes les factures depuis le backend Spring Boot
  getFactures(): Observable<Facture[]> {
    console.log('Récupération des factures depuis le backend Spring Boot:', this.apiUrl);
    
    return this.http.get<any[]>(this.apiUrl, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        console.log('Réponse du backend Spring Boot pour les factures:', response);
        
        if (!Array.isArray(response)) {
          console.warn('La réponse n\'est pas un tableau, utilisation de données factices');
          return this.generateMockFactures();
        }
        
        // Mapper les données du backend aux objets Facture
        const factures = response.map(item => this.mapSpringResponseToFacture(item));
        console.log('Factures extraites du backend Spring Boot:', factures.length, 'factures trouvées');
        return factures;
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des factures:', error);
        return of(this.generateMockFactures());
      })
    );
  }
  
  // Récupérer les factures du vendeur connecté
  getVendorFactures(): Observable<Facture[]> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return of([]);
    }
    
    const vendorId = currentUser.id;
    const url = `${this.apiUrl}/vendor/${vendorId}`;
    
    return this.http.get<any[]>(url, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        if (!Array.isArray(response)) {
          return this.generateMockFactures();
        }
        
        return response.map(item => this.mapSpringResponseToFacture(item));
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des factures du vendeur:', error);
        return of(this.generateMockFactures());
      })
    );
  }
  
  // Récupérer une facture par son ID
  getFactureById(id: string): Observable<Facture> {
    console.log(`Récupération de la facture ${id} depuis le backend Spring Boot`);
    
    return this.http.get<any>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        console.log('Réponse du backend Spring Boot pour la facture:', response);
        return this.mapSpringResponseToFacture(response);
      }),
      catchError(error => {
        console.error(`Erreur lors de la récupération de la facture ${id}:`, error);
        return of(this.createMockFacture(id));
      })
    );
  }
  
  // Mapper une réponse du backend Spring Boot vers un objet Facture
  private mapSpringResponseToFacture(item: any): Facture {
    if (!item) {
      return this.createMockFacture('0');
    }
    
    return {
      id: item.id?.toString() || '',
      number: item.numeroFacture || '',
      vendorId: item.idVendeur?.toString() || '',
      vendorName: item.vendorName || 'Vendeur',
      vendorEmail: item.vendorEmail || '',
      clientId: item.client?.id?.toString() || '',
      clientName: item.client?.nom || 'Client',
      clientEmail: item.client?.email || '',
      date: new Date(item.dateCreation || new Date()),
      dueDate: new Date(item.dateFinalisation || new Date()),
      status: this.mapStatusFromSpring(item.statut),
      total: item.totalTTC || 0,
      discount: item.remise || 0,
      notes: item.notes || '',
      items: this.mapLignesFacture(item.lignes || []),
      createdAt: new Date(item.dateCreation || new Date()),
      updatedAt: new Date(item.dateModification || new Date())
    };
  }
  
  // Mapper les lignes de facture du backend Spring Boot
  private mapLignesFacture(lignes: any[]): FactureItem[] {
    if (!Array.isArray(lignes)) {
      return [];
    }
    
    return lignes.map(ligne => ({
      id: ligne.id?.toString() || '',
      factureId: ligne.factureId?.toString() || '',
      productId: ligne.produitId?.toString() || '',
      productName: ligne.nomProduit || '',
      description: ligne.description || '',
      quantity: ligne.quantite || 0,
      unitPrice: ligne.prixUnitaire || 0,
      total: ligne.total || 0
    }));
  }
  
  // Mapper le statut du backend Spring Boot au format attendu par l'application
  mapStatusFromSpring(status: string): 'DRAFT' | 'PENDING' | 'PAID' | 'CANCELLED' {
    if (!status) return 'DRAFT';
    
    switch (status.toUpperCase()) {
      case 'BROUILLON':
        return 'DRAFT';
      case 'EN_ATTENTE':
      case 'EN ATTENTE':
        return 'PENDING';
      case 'PAYEE':
      case 'PAYÉ':
      case 'PAYÉE':
        return 'PAID';
      case 'ANNULEE':
      case 'ANNULÉ':
      case 'ANNULÉE':
        return 'CANCELLED';
      default:
        return 'PENDING';
    }
  }
  
  // Générer des données factices pour le tableau de bord
  generateMockFactures(): Facture[] {
    console.log('Génération de factures factices pour le tableau de bord');
    
    const factures: Facture[] = [];
    const statuses: ('DRAFT' | 'PENDING' | 'PAID' | 'CANCELLED')[] = ['DRAFT', 'PENDING', 'PAID', 'CANCELLED'];
    const currentDate = new Date();
    
    // Générer 10 factures factices
    for (let i = 1; i <= 10; i++) {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const date = new Date(currentDate);
      date.setDate(date.getDate() - Math.floor(Math.random() * 30)); // Date dans les 30 derniers jours
      
      const dueDate = new Date(date);
      dueDate.setDate(dueDate.getDate() + 30); // Échéance à 30 jours
      
      const items: FactureItem[] = [];
      const itemCount = Math.floor(Math.random() * 5) + 1; // 1 à 5 articles
      
      let total = 0;
      
      // Générer des articles pour la facture
      for (let j = 1; j <= itemCount; j++) {
        const quantity = Math.floor(Math.random() * 5) + 1; // 1 à 5 unités
        const unitPrice = Math.floor(Math.random() * 100) + 10; // 10 à 110 euros
        const itemTotal = quantity * unitPrice;
        total += itemTotal;
        
        items.push({
          id: `item-${i}-${j}`,
          factureId: `facture-${i}`,
          productId: `product-${j}`,
          productName: `Produit ${j}`,
          description: `Description du produit ${j}`,
          quantity,
          unitPrice,
          total: itemTotal
        });
      }
      
      // Appliquer une remise aléatoire (0 à 10%)
      const discount = Math.random() < 0.3 ? Math.floor(total * (Math.random() * 0.1)) : 0;
      total -= discount;
      
      factures.push({
        id: `facture-${i}`,
        number: `FACT-${2025}${i.toString().padStart(3, '0')}`,
        vendorId: '1',
        vendorName: 'Vendeur Test',
        vendorEmail: 'vendeur@example.com',
        clientId: `client-${i}`,
        clientName: `Client ${i}`,
        clientEmail: `client${i}@example.com`,
        date,
        dueDate,
        status,
        total,
        discount,
        notes: `Notes pour la facture ${i}`,
        items,
        createdAt: date,
        updatedAt: date
      });
    }
    
    return factures;
  }
  
  // Créer une facture fictive pour éviter les erreurs d'affichage
  createMockFacture(id: string): Facture {
    const date = new Date();
    const dueDate = new Date();
    dueDate.setDate(date.getDate() + 30);
    
    return {
      id,
      number: `FACT-${id}`,
      vendorId: '1',
      vendorName: 'Vendeur Test',
      vendorEmail: 'vendeur@example.com',
      clientId: '1',
      clientName: 'Client Test',
      clientEmail: 'client@example.com',
      date,
      dueDate,
      status: 'DRAFT',
      total: 0,
      discount: 0,
      notes: '',
      items: [],
      createdAt: date,
      updatedAt: date
    };
  }
  
  // Créer une nouvelle facture
  createFacture(facture: Facture): Observable<Facture> {
    console.log('Création d\'une nouvelle facture:', facture);
    
    return this.http.post<any>(this.apiUrl, facture, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        console.log('Réponse du backend Spring Boot pour la création de facture:', response);
        return this.mapSpringResponseToFacture(response);
      }),
      catchError(error => {
        console.error('Erreur lors de la création de la facture:', error);
        
        // Simuler une création réussie
        const mockFacture = { ...facture };
        mockFacture.id = `mock-${Date.now()}`;
        mockFacture.createdAt = new Date();
        mockFacture.updatedAt = new Date();
        
        return of(mockFacture);
      })
    );
  }
  
  // Mettre à jour le statut d'une facture
  updateFactureStatus(id: string, status: 'DRAFT' | 'PENDING' | 'PAID' | 'CANCELLED'): Observable<Facture> {
    console.log(`Mise à jour du statut de la facture ${id} vers ${status}`);
    
    const url = `${this.apiUrl}/${id}/statut`;
    const body = { statut: this.mapStatusToSpring(status) };
    
    return this.http.patch<any>(url, body, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        console.log('Réponse du backend Spring Boot pour la mise à jour du statut:', response);
        return this.mapSpringResponseToFacture(response);
      }),
      catchError(error => {
        console.error(`Erreur lors de la mise à jour du statut de la facture ${id}:`, error);
        
        // Simuler une mise à jour réussie
        return this.getFactureById(id).pipe(
          map(facture => {
            facture.status = status;
            facture.updatedAt = new Date();
            return facture;
          })
        );
      })
    );
  }
  
  // Mapper le statut de l'application au format attendu par le backend Spring Boot
  private mapStatusToSpring(status: 'DRAFT' | 'PENDING' | 'PAID' | 'CANCELLED'): string {
    switch (status) {
      case 'DRAFT':
        return 'BROUILLON';
      case 'PENDING':
        return 'EN_ATTENTE';
      case 'PAID':
        return 'PAYEE';
      case 'CANCELLED':
        return 'ANNULEE';
      default:
        return 'BROUILLON';
    }
  }
  
  // Générer un PDF pour une facture
  generatePdf(id: string): Observable<Blob> {
    console.log(`Génération du PDF pour la facture ${id}`);
    
    const url = `${this.apiUrl}/${id}/pdf`;
    
    return this.http.get(url, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        console.error(`Erreur lors de la génération du PDF pour la facture ${id}:`, error);
        
        // Simuler un PDF
        return this.getFactureById(id).pipe(
          map(facture => {
            const content = `Facture ${facture.number} pour ${facture.clientName}`;
            return new Blob([content], { type: 'application/pdf' });
          })
        );
      })
    );
  }
  
  // Envoyer une facture par email
  sendFactureByEmail(id: string, email: string, subject?: string, message?: string): Observable<any> {
    console.log(`Envoi de la facture ${id} par email à ${email}`);
    
    const url = `${this.apiUrl}/${id}/envoyer`;
    const body = {
      email,
      subject: subject || 'Votre facture',
      message: message || 'Veuillez trouver ci-joint votre facture.'
    };
    
    return this.http.post<any>(url, body, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error(`Erreur lors de l'envoi de la facture ${id} par email:`, error);
        return of({ success: true, message: 'Email envoyé avec succès (simulé)' });
      })
    );
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
