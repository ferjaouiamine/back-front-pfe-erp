import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap, switchMap } from 'rxjs/operators';
import { AuthService } from '../../auth/services/auth.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface FactureItem {
  id: string;
  factureId: string;
  productId: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category?: {
    id?: number;
    name?: string;
  };
  imageUrl?: string;
  sku?: string;
  barcode?: string;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  taxRate?: number;
  tax?: number; // Ajout de la propriété tax
  discount?: number;
  metadata?: Record<string, any>;
}

export interface Product {
  id: string | number;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  category?: {
    id?: number;
    name?: string;
  };
  active?: boolean;
  alertThreshold?: number;
  reference?: string;
}

export interface Facture {
  id: string;
  number?: string;
  reference?: string;
  vendorId?: string;
  vendorName?: string;
  vendorEmail?: string;
  vendorAddress?: string; // Ajout de l'adresse du vendeur
  clientId?: string;
  clientName: string;
  clientEmail: string;
  clientAddress?: string;
  clientPhone?: string;
  date: Date | string;
  dueDate: Date | string;
  status: 'DRAFT' | 'PENDING' | 'PAID' | 'CANCELLED';
  total: number;
  subtotal?: number;
  tax?: number;
  discount?: number;
  notes?: string;
  items: FactureItem[];
  products?: Product[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
  paymentMethod?: string;
  paymentStatus?: string;
  pdfUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class FactureService {
  private apiUrl = 'http://localhost:8085/api/factures';

  private apiUrls: Record<string, string> = {
    springBoot: 'http://localhost:8085/api/factures',
    mockServer: 'http://localhost:3000/api/factures',
    production: '/api/factures'
  };

  constructor(private http: HttpClient, private authService: AuthService) {
    const savedUrl = localStorage.getItem('api_url_config');
    if (savedUrl) {
      this.apiUrl = savedUrl;
    }
  }

  setApiUrl(type: 'springBoot' | 'mockServer' | 'production' | 'custom', customUrl?: string): void {
    if (type === 'custom' && customUrl) {
      this.apiUrl = customUrl;
    } else if (type in this.apiUrls) {
      this.apiUrl = this.apiUrls[type];
    } else {
      throw new Error(`Unknown API URL type: ${type}`);
    }
    localStorage.setItem('api_url_config', this.apiUrl);
  }

  getFactures(): Observable<Facture[]> {
    return this.http.get<Facture[]>(this.apiUrl, {
      headers: this.getAuthHeaders(),
    });
  }

  getAllFactures(useMockData: boolean = false): Observable<Facture[]> {
    // Essayer d'abord de récupérer les données du backend
    return this.getFactures().pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération des factures depuis le backend:', error);
        // En cas d'erreur, utiliser les données fictives si useMockData est true
        if (useMockData) {
          console.log('Utilisation des données fictives pour les factures');
          return of(this.generateMockFactures());
        }
        // Sinon, propager l'erreur
        return throwError(() => error);
      })
    ) as Observable<Facture[]>;
  }

  getVendorFactures(): Observable<Facture[]> {
    try {
      return this.http.get<Facture[]>(`${this.apiUrl}/vendor`, {
        headers: this.getAuthHeaders(),
      });
    } catch (error) {
      console.error(`Erreur lors de la récupération des factures du vendeur:`, error);
      return of(this.generateMockFactures());
    }
  }

  getFactureById(id: string): Observable<Facture> {
    // Si l'ID commence par 'mock-', retourner directement les données fictives
    if (id.startsWith('mock-')) {
      console.log(`Récupération de la facture fictive ${id}`);
      const mockFacturesStr = localStorage.getItem('mock_factures');
      const mockFactures = mockFacturesStr ? JSON.parse(mockFacturesStr) : [];
      const mockFacture = mockFactures.find((f: Facture) => f.id === id);
      
      if (mockFacture) {
        return of(mockFacture);
      } else {
        console.error(`Facture fictive ${id} non trouvée`);
        // Générer une facture fictive avec cet ID
        const mockFacture: Facture = {
          id: id,
          clientName: 'Client test',
          clientEmail: 'test@example.com',
          date: new Date(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'DRAFT',
          total: 0,
          items: []
        };
        return of(mockFacture);
      }
    }
    
    // Sinon, essayer de récupérer la facture depuis le backend
    return this.http.get<Facture>(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders(),
    }).pipe(
      catchError(error => {
        console.error(`Erreur lors de la récupération de la facture ${id}:`, error);
        
        // En cas d'erreur, générer une facture fictive
        const mockFacture: Facture = {
          id: `mock-${Date.now()}`,
          clientName: 'Client test',
          clientEmail: 'test@example.com',
          date: new Date(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'DRAFT',
          total: 0,
          items: []
        };
        return of(mockFacture);
      })
    );
  }

  createFacture(facture: Facture): Observable<Facture> {
    // Préparer la facture pour le backend
    const factureForBackend = this.prepareFactureForBackend(facture);
    
    // Si l'ID commence par 'mock-', sauvegarder dans localStorage et retourner
    if (facture.id && facture.id.startsWith('mock-')) {
      console.log('Sauvegarde de la facture fictive dans localStorage');
      this.saveMockFactureToLocalStorage(facture);
      return of(facture);
    }
    
    // Sinon, envoyer au backend
    return this.http.post<Facture>(this.apiUrl, factureForBackend, {
      headers: this.getAuthHeaders(),
    }).pipe(
      catchError(error => {
        console.error('Erreur lors de la création de la facture:', error);
        // En cas d'erreur, sauvegarder comme facture fictive
        facture.id = `mock-${Date.now()}`;
        this.saveMockFactureToLocalStorage(facture);
        return of(facture);
      })
    );
  }

  // Sauvegarde une facture fictive dans le localStorage
  saveMockFactureToLocalStorage(facture: Facture): void {
    // S'assurer que l'ID commence par 'mock-'
    if (!facture.id || !facture.id.startsWith('mock-')) {
      facture.id = `mock-${Date.now()}`;
    }
    
    // Récupérer les factures existantes
    const mockFacturesStr = localStorage.getItem('mock_factures');
    const mockFactures = mockFacturesStr ? JSON.parse(mockFacturesStr) : [];
    
    // Vérifier si la facture existe déjà
    const existingIndex = mockFactures.findIndex((f: Facture) => f.id === facture.id);
    
    if (existingIndex >= 0) {
      // Mettre à jour la facture existante
      mockFactures[existingIndex] = facture;
    } else {
      // Ajouter la nouvelle facture
      mockFactures.push(facture);
    }
    
    // Sauvegarder dans localStorage
    localStorage.setItem('mock_factures', JSON.stringify(mockFactures));
    console.log(`Facture ${facture.id} sauvegardée dans localStorage`);
  }

  updateFacture(facture: Facture): Observable<Facture> {
    // TODO: Implémenter la mise à jour de facture
    return of(facture);
  }

  updateFactureStatus(id: string, status: 'DRAFT' | 'PENDING' | 'PAID' | 'CANCELLED'): Observable<Facture> {
    // Si l'ID commence par 'mock-', mettre à jour dans localStorage
    if (id.startsWith('mock-')) {
      return this.updateMockFactureStatus(id, status);
    }
    
    // Sinon, mettre à jour dans le backend
    return this.http.patch<Facture>(`${this.apiUrl}/${id}/status`, { status }, {
      headers: this.getAuthHeaders(),
    }).pipe(
      catchError(error => {
        console.error(`Erreur lors de la mise à jour du statut de la facture ${id}:`, error);
        return this.updateMockFactureStatus(id, status);
      })
    );
  }

  // Met à jour le statut d'une facture fictive
  // @param id ID de la facture
  // @param status Nouveau statut
  updateMockFactureStatus(id: string, status: 'DRAFT' | 'PENDING' | 'PAID' | 'CANCELLED'): Observable<Facture> {
    const mockFacturesStr = localStorage.getItem('mock_factures');
    const mockFactures = mockFacturesStr ? JSON.parse(mockFacturesStr) : [];
    const mockFacture = mockFactures.find((f: Facture) => f.id === id);
    
    if (mockFacture) {
      mockFacture.status = status;
      localStorage.setItem('mock_factures', JSON.stringify(mockFactures));
      return of(mockFacture);
    } else {
      return throwError(() => new Error(`Facture fictive ${id} non trouvée`));
    }
  }

  generatePdf(id: string): Observable<Blob> {
    // Si l'ID commence par 'mock-', générer un PDF fictif
    if (id.startsWith('mock-')) {
      return this.generateMockPdf(id);
    }
    
    // Sinon, récupérer le PDF depuis le backend
    return this.http.get(`${this.apiUrl}/${id}/pdf`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        console.error(`Erreur lors de la génération du PDF pour la facture ${id}:`, error);
        return this.generateMockPdf(id);
      })
    );
  }

  // Génère un PDF fictif pour les factures de test
  // @param id ID de la facture
  generateMockPdf(id: string): Observable<Blob> {
    return this.getFactureById(id).pipe(
      switchMap(facture => {
        return new Observable<Blob>(observer => {
          try {
            // Créer un document PDF
            const doc = new jsPDF();
            
            // Ajouter le contenu au PDF
            doc.setFontSize(22);
            doc.text('FACTURE', 105, 20, { align: 'center' });
            
            doc.setFontSize(12);
            doc.text(`Numéro: ${facture.number || facture.id}`, 20, 40);
            doc.text(`Date: ${new Date(facture.date).toLocaleDateString()}`, 20, 50);
            doc.text(`Échéance: ${new Date(facture.dueDate).toLocaleDateString()}`, 20, 60);
            
            doc.text('Vendeur:', 20, 80);
            doc.text(`${facture.vendorName || 'Vendeur'}`, 20, 90);
            doc.text(`${facture.vendorEmail || 'email@vendeur.com'}`, 20, 100);
            doc.text(`${facture.vendorAddress || 'Adresse du vendeur'}`, 20, 110);
            
            doc.text('Client:', 120, 80);
            doc.text(`${facture.clientName}`, 120, 90);
            doc.text(`${facture.clientEmail}`, 120, 100);
            doc.text(`${facture.clientAddress || 'Adresse du client'}`, 120, 110);
            
            // Tableau des articles
            doc.setFontSize(10);
            doc.text('Description', 20, 130);
            doc.text('Quantité', 100, 130);
            doc.text('Prix unitaire', 130, 130);
            doc.text('Total', 170, 130);
            
            doc.line(20, 135, 190, 135);
            
            let y = 145;
            facture.items.forEach(item => {
              doc.text(item.productName, 20, y);
              doc.text(item.quantity.toString(), 100, y);
              doc.text(item.unitPrice.toFixed(2) + ' €', 130, y);
              doc.text(item.total.toFixed(2) + ' €', 170, y);
              y += 10;
            });
            
            doc.line(20, y, 190, y);
            y += 10;
            
            // Totaux
            doc.text('Sous-total:', 130, y);
            doc.text((facture.subtotal || 0).toFixed(2) + ' €', 170, y);
            y += 10;
            
            if (facture.tax) {
              doc.text('TVA:', 130, y);
              doc.text(facture.tax.toFixed(2) + ' €', 170, y);
              y += 10;
            }
            
            if (facture.discount) {
              doc.text('Remise:', 130, y);
              doc.text('-' + facture.discount.toFixed(2) + ' €', 170, y);
              y += 10;
            }
            
            doc.setFontSize(12);
            doc.text('Total:', 130, y);
            doc.text(facture.total.toFixed(2) + ' €', 170, y);
            
            // Pied de page
            doc.setFontSize(10);
            doc.text('Merci pour votre confiance !', 105, 280, { align: 'center' });
            
            // Convertir le PDF en Blob
            const pdfBlob = doc.output('blob');
            observer.next(pdfBlob);
            observer.complete();
          } catch (error) {
            console.error('Erreur lors de la génération du PDF:', error);
            observer.error(error);
          }
        });
      })
    );
  }

  /**
   * Envoie une facture par email
   * Si c'est une facture fictive (mock), elle est d'abord enregistrée dans la base de données
   * @param id ID de la facture
   * @param email Email du destinataire
   * @param emailSubject Sujet de l'email
   * @param emailMessage Message de l'email
   */
  sendFactureByEmail(id: string, email: string, emailSubject: string, emailMessage: string): Observable<void> {
    console.log(`Envoi de la facture ${id} par email à ${email}`);
    
    // Si l'ID commence par 'mock-', d'abord enregistrer la facture puis envoyer l'email
    if (id.startsWith('mock-')) {
      // Récupérer la facture fictive depuis le localStorage
      const mockFacturesStr = localStorage.getItem('mock_factures');
      const mockFactures = mockFacturesStr ? JSON.parse(mockFacturesStr) : [];
      const mockFacture = mockFactures.find((f: Facture) => f.id === id);
      if (!mockFacture) {
        console.error(`Facture fictive ${id} non trouvée`);
        return throwError(() => new Error(`Facture fictive ${id} non trouvée`));
      }
      
      console.log('Enregistrement de la facture fictive dans la base de données avant envoi d\'email');
      // Enregistrer d'abord la facture dans la base de données
      return this.createFacture(mockFacture).pipe(
        switchMap(savedFacture => {
          console.log('Facture enregistrée avec succès, ID:', savedFacture.id);
          // Puis envoyer l'email avec la facture réelle
          return this.http.post<void>(`${this.apiUrl}/${savedFacture.id}/send-email`, { 
            email,
            subject: emailSubject,
            message: emailMessage
          }, {
            headers: this.getAuthHeaders(),
          }).pipe(
            catchError(error => {
              console.error('Erreur lors de l\'envoi de la facture par email:', error);
              // En cas d'erreur d'envoi d'email, simuler l'envoi
              return this.sendMockFactureByEmail(savedFacture.id.toString(), email, emailSubject, emailMessage);
            })
          );
        }),
        catchError(error => {
          console.error('Erreur lors de l\'enregistrement de la facture:', error);
          // En cas d'erreur d'enregistrement, simuler l'envoi d'email avec la facture fictive
          return this.sendMockFactureByEmail(id, email, emailSubject, emailMessage);
        })
      );
    }
    
    // Si ce n'est pas une facture fictive, essayer d'appeler l'API directement
    return this.http.post<void>(`${this.apiUrl}/${id}/send-email`, { 
      email,
      subject: emailSubject,
      message: emailMessage
    }, {
      headers: this.getAuthHeaders(),
    }).pipe(
      catchError(error => {
        console.error('Erreur lors de l\'envoi de la facture par email:', error);
        // En cas d'erreur, simuler l'envoi d'email
        return this.sendMockFactureByEmail(id, email, emailSubject, emailMessage);
      })
    );
  }

  /**
   * Simule l'envoi d'une facture par email
   * @param id ID de la facture
   * @param email Email du destinataire
   * @param emailSubject Sujet de l'email
   * @param emailMessage Message de l'email
   */
  private sendMockFactureByEmail(id: string, email: string, emailSubject: string, emailMessage: string): Observable<void> {
    // Générer le PDF
    return this.generateMockPdf(id).pipe(
      switchMap(pdfBlob => {
        // Simuler un délai d'envoi d'email
        console.log(`Simulation d'envoi d'email pour la facture ${id} à ${email}`);
        console.log(`Sujet: ${emailSubject}`);
        console.log(`Message: ${emailMessage}`);
        
        // Retourner un Observable qui émet après un court délai
        return new Observable<void>(observer => {
          setTimeout(() => {
            observer.next();
            observer.complete();
          }, 1000);
        });
      })
    );
  }

  calculateSubtotal(items: FactureItem[]): number {
    return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }

  calculateTaxAmount(subtotal: number, taxRate: number): number {
    return subtotal * (taxRate / 100);
  }

  calculateTotal(subtotal: number, taxAmount: number, discount: number = 0): number {
    return subtotal + taxAmount - discount;
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }
  
  /**
   * Prépare une facture pour l'envoi au backend Spring Boot
   * @param facture La facture à préparer
   * @returns La facture adaptée au format attendu par le backend
   */
  private prepareFactureForBackend(facture: Facture): any {
    // Créer une copie profonde pour éviter de modifier l'original
    const factureForBackend: any = JSON.parse(JSON.stringify(facture));
    
    // S'assurer que les champs obligatoires sont présents
    // Informations client et vendeur
    factureForBackend.clientName = facture.clientName || 'Client non spécifié';
    factureForBackend.clientEmail = facture.clientEmail || '';
    factureForBackend.clientAddress = facture.clientAddress || '';
    factureForBackend.vendorName = facture.vendorName || 'Vendeur non spécifié';
    factureForBackend.vendorEmail = facture.vendorEmail || '';
    factureForBackend.vendorAddress = facture.vendorAddress || '';
    
    // Dates
    factureForBackend.date = facture.date instanceof Date ? 
      facture.date.toISOString() : facture.date || new Date().toISOString();
    factureForBackend.dueDate = facture.dueDate instanceof Date ? 
      facture.dueDate.toISOString() : facture.dueDate || new Date(Date.now() + 30*24*60*60*1000).toISOString();
    
    // Statut et montants
    factureForBackend.status = facture.status || 'DRAFT';
    factureForBackend.total = facture.total || 0;
    factureForBackend.subtotal = facture.subtotal || 0;
    factureForBackend.tax = facture.tax || 0;
    factureForBackend.discount = facture.discount || 0;
    factureForBackend.notes = facture.notes || '';
    
    // Adapter les lignes de facture
    if (facture.items && Array.isArray(facture.items)) {
      factureForBackend.items = facture.items.map((item: FactureItem) => {
        return {
          productId: item.productId || '',
          productName: item.productName || 'Produit sans nom',
          description: item.description || '',
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          discount: item.discount || 0,
          tax: item.tax || 0,
          total: (item.quantity || 1) * (item.unitPrice || 0),
          sku: item.sku || '',
          imageUrl: item.imageUrl || '',
          category: item.category || null,
          dimensions: item.dimensions || null,
          weight: item.weight || null,
          metadata: item.metadata || null
        };
      });
    } else {
      factureForBackend.items = [];
    }
    
    return factureForBackend;
  }

  createEmptyFacture(): Facture {
    return {
      id: '',
      clientName: '',
      clientEmail: '',
      date: new Date(),
      dueDate: new Date(),
      status: 'DRAFT',
      total: 0,
      items: []
    };
  }

  generateMockFactures(): Facture[] {
    const date = new Date();
    return [
      {
        id: 'mock-1',
        clientName: 'Client test',
        clientEmail: 'test@example.com',
        date: date,
        dueDate: new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: 'PAID',
        total: 150,
        items: [
          {
            id: 'item-1',
            factureId: 'mock-1',
            productId: 'prod-1',
            productName: 'Produit démo',
            quantity: 1,
            unitPrice: 150,
            total: 150
          }
        ]
      }
    ];
  }
}
