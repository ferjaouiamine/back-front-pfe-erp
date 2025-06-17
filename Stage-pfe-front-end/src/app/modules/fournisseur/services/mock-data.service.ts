import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class MockDataService {

  constructor() { }

  /**
   * Génère des données fictives pour les commandes
   */
  getMockCommandes(page: number = 0, size: number = 10, statut?: string): Observable<any> {
    const totalElements = 25;
    const totalPages = Math.ceil(totalElements / size);
    
    let commandes = this.generateMockCommandes(totalElements);
    
    // Filtrage par statut si spécifié
    if (statut) {
      commandes = commandes.filter(cmd => cmd.statut === statut);
    }
    
    // Pagination
    const startIndex = page * size;
    const endIndex = Math.min(startIndex + size, commandes.length);
    const paginatedCommandes = commandes.slice(startIndex, endIndex);
    
    return of({
      content: paginatedCommandes,
      totalElements: commandes.length,
      totalPages: Math.ceil(commandes.length / size),
      currentPage: page,
      size: size
    });
  }

  /**
   * Génère des données fictives pour une commande spécifique
   */
  getMockCommandeById(id: string): Observable<any> {
    const commande = this.generateMockCommande(id);
    return of(commande);
  }

  /**
   * Génère des données fictives pour les factures avec filtrage simple
   * @deprecated Utiliser getMockFactures avec filtres avancés à la place
   */
  getMockFacturesSimple(page: number = 0, size: number = 10, statut?: string): Observable<any> {
    // Crée un filtre compatible avec la nouvelle méthode
    const filters = statut ? { statut } : undefined;
    
    // Utilise la nouvelle méthode avec filtres avancés
    return this.getMockFactures(page, size, filters);
  }

  /**
   * Génère des données fictives pour une facture spécifique
   */
  getMockFactureById(id: string): Observable<any> {
    // Vérifie si l'ID est déjà au format FACT-X
    const factureId = id.startsWith('FACT-') ? id : `FACT-${id}`;
    
    // Génère une facture fictive avec l'ID spécifié
    const statuts = ['PAYEE', 'EN_ATTENTE', 'RETARD'];
    const randomStatut = statuts[Math.floor(Math.random() * statuts.length)];
    const montantTotal = Math.floor(Math.random() * 10000) + 500;
    const montantPaye = randomStatut === 'PAYEE' ? montantTotal : Math.floor(Math.random() * montantTotal);
    
    const facture = {
      id: factureId,
      reference: `REF-${factureId}`,
      dateEmission: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
      dateEcheance: new Date(Date.now() + Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
      montantTotal: montantTotal,
      montantPaye: montantPaye,
      statut: randomStatut,
      commandeId: `CMD-${factureId.replace('FACT-', '')}`,
      lignesFacture: this.generateMockLignesFacture(Math.floor(Math.random() * 5) + 1)
    };
    
    return of(facture);
  }

  /**
   * Génère des données fictives pour les produits
   */
  getMockProduits(page: number = 0, size: number = 10, filters?: any): Observable<any> {
    const totalElements = 30;
    
    let produits = this.generateMockProduits(totalElements);
    
    // Filtrage si des filtres sont spécifiés
    if (filters) {
      if (filters.categorie) {
        produits = produits.filter(p => p.categorie === filters.categorie);
      }
      if (filters.disponible !== undefined) {
        produits = produits.filter(p => p.disponible === filters.disponible);
      }
      if (filters.query) {
        const query = filters.query.toLowerCase();
        produits = produits.filter(p => 
          p.nom.toLowerCase().includes(query) || 
          p.description.toLowerCase().includes(query)
        );
      }
    }
    
    // Pagination
    const startIndex = page * size;
    const endIndex = Math.min(startIndex + size, produits.length);
    const paginatedProduits = produits.slice(startIndex, endIndex);
    
    return of({
      content: paginatedProduits,
      totalElements: produits.length,
      totalPages: Math.ceil(produits.length / size),
      currentPage: page,
      size: size
    });
  }

  /**
   * Génère des données fictives pour les catégories de produits
   */
  getMockCategories(): Observable<string[]> {
    return of([
      'Électronique',
      'Informatique',
      'Mobilier',
      'Fournitures de bureau',
      'Équipement industriel',
      'Matériaux de construction',
      'Produits alimentaires'
    ]);
  }

  /**
   * Génère des données fictives pour le profil du fournisseur connecté
   */
  getMockProfilFournisseur(): Observable<any> {
    return of({
      id: 'FOURN-1',
      nom: 'Fournisseur Exemple',
      email: 'contact@fournisseur-exemple.com',
      telephone: '0123456789',
      adresse: '123 Rue des Fournisseurs, 75001 Paris',
      description: 'Fournisseur spécialisé dans les produits électroniques et informatiques.',
      categorieProduits: ['Électronique', 'Informatique'],
      dateInscription: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString() // 1 an avant aujourd'hui
    });
  }

  /**
   * Génère des données fictives pour les statistiques du tableau de bord
   */
  getMockDashboardStats(): Observable<any> {
    // Génère des statistiques fictives
    const stats = {
      commandesEnCours: Math.floor(Math.random() * 20) + 5,
      commandesLivrees: Math.floor(Math.random() * 100) + 50,
      facturesEnAttente: Math.floor(Math.random() * 15) + 3,
      facturesPayees: Math.floor(Math.random() * 80) + 40,
      chiffreAffaires: Math.floor(Math.random() * 100000) + 50000,
      produitsEnStock: Math.floor(Math.random() * 500) + 100,
      graphData: this.generateMockSalesData()
    };
    
    return of(stats);
  }
  
  /**
   * Génère des lignes de facture fictives
   */
  private generateMockLignesFacture(count: number): any[] {
    const lignes = [];
    
    for (let i = 1; i <= count; i++) {
      const quantite = Math.floor(Math.random() * 10) + 1;
      const prixUnitaire = Math.floor(Math.random() * 1000) + 50;
      const montant = quantite * prixUnitaire;
      
      lignes.push({
        id: `LF-${i}`,
        produitId: `PROD-${Math.floor(Math.random() * 100) + 1}`,
        nomProduit: `Produit ${Math.floor(Math.random() * 100) + 1}`,
        quantite: quantite,
        prixUnitaire: prixUnitaire,
        montant: montant
      });
    }
    
    return lignes;
  }
  
  /**
   * Génère des factures fictives pour le fournisseur
   */
  getMockFactures(page: number = 0, size: number = 10, filters?: any): Observable<any> {
    // Génère un ensemble de factures fictives
    let factures: any[] = [];
    const totalElements = 50;
    
    // Génère les factures
    for (let i = 1; i <= totalElements; i++) {
      const statuts = ['PAYEE', 'EN_ATTENTE', 'RETARD'];
      const randomStatut = statuts[Math.floor(Math.random() * statuts.length)];
      const montantTotal = Math.floor(Math.random() * 10000) + 500;
      const montantPaye = randomStatut === 'PAYEE' ? montantTotal : Math.floor(Math.random() * montantTotal);
      
      factures.push({
        id: `FACT-${i}`,
        reference: `REF-FACT-${i}`,
        dateEmission: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
        dateEcheance: new Date(Date.now() + Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
        montantTotal: montantTotal,
        montantPaye: montantPaye,
        statut: randomStatut,
        commandeId: `CMD-${i}`,
        lignesFacture: this.generateMockLignesFacture(Math.floor(Math.random() * 5) + 1)
      });
    }
    
    // Applique les filtres si fournis
    if (filters) {
      if (filters.statut) {
        factures = factures.filter(f => f.statut === filters.statut);
      }
      if (filters.dateDebut) {
        const dateDebut = new Date(filters.dateDebut);
        factures = factures.filter(f => new Date(f.dateEmission) >= dateDebut);
      }
      if (filters.dateFin) {
        const dateFin = new Date(filters.dateFin);
        factures = factures.filter(f => new Date(f.dateEmission) <= dateFin);
      }
    }
    
    // Pagination
    const startIndex = page * size;
    const endIndex = Math.min(startIndex + size, factures.length);
    const paginatedFactures = factures.slice(startIndex, endIndex);
    
    return of({
      content: paginatedFactures,
      totalElements: factures.length,
      totalPages: Math.ceil(factures.length / size),
      currentPage: page,
      size: size
    });
  }
  
  /**
   * Génère des données fictives pour les factures avec filtres avancés
   */
  getMockFacturesWithFilters(page: number = 0, size: number = 10, filters?: any): Observable<any> {
    // Génère un ensemble de factures fictives
    let factures = this.generateMockFactures(50);
    
    // Applique les filtres si fournis
    if (filters) {
      if (filters.statut) {
        factures = factures.filter(f => f.statut === filters.statut);
      }
      if (filters.dateDebut) {
        const dateDebut = new Date(filters.dateDebut);
        factures = factures.filter(f => new Date(f.dateEmission) >= dateDebut);
      }
      if (filters.dateFin) {
        const dateFin = new Date(filters.dateFin);
        factures = factures.filter(f => new Date(f.dateEmission) <= dateFin);
      }
      if (filters.montantMin) {
        factures = factures.filter(f => f.montantTotal >= filters.montantMin);
      }
      if (filters.montantMax) {
        factures = factures.filter(f => f.montantTotal <= filters.montantMax);
      }
    }
    
    // Pagination
    const startIndex = page * size;
    const endIndex = Math.min(startIndex + size, factures.length);
    const paginatedFactures = factures.slice(startIndex, endIndex);
    
    return of({
      content: paginatedFactures,
      totalElements: factures.length,
      totalPages: Math.ceil(factures.length / size),
      currentPage: page,
      size: size
    });
  }
  
  /**
   * Simule la création d'une facture fictive pour une commande
   */
  createMockFacture(commandeId: string, factureData: any): Observable<any> {
    // Génère un ID aléatoire pour la nouvelle facture
    const newId = `FACT-${commandeId.replace('CMD-', '')}`;
    
    // Crée une nouvelle facture avec les données fournies et des valeurs par défaut pour les champs manquants
    const newFacture = {
      id: newId,
      reference: factureData.reference || `REF-${newId}`,
      dateEmission: factureData.dateEmission || new Date().toISOString(),
      dateEcheance: factureData.dateEcheance || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      montantTotal: factureData.montantTotal || Math.floor(Math.random() * 10000) + 500,
      montantPaye: factureData.montantPaye || 0,
      statut: factureData.statut || 'EN_ATTENTE',
      commandeId: commandeId,
      lignesFacture: factureData.lignesFacture || this.generateMockLignesFacture(Math.floor(Math.random() * 5) + 1)
    };
    
    return of(newFacture);
  }
  
  /**
   * Simule la mise à jour d'une facture fictive
   */
  updateMockFacture(factureId: string, factureData: any): Observable<any> {
    // Récupère d'abord la facture fictive existante
    return this.getMockFactureById(factureId).pipe(
      map((existingFacture: any) => {
        // Fusionne les données existantes avec les nouvelles données
        return {
          ...existingFacture,
          ...factureData,
          id: existingFacture.id, // Conserve l'ID original
          dateModification: new Date().toISOString() // Ajoute une date de modification
        };
      })
    );
  }
  
  /**
   * Simule la récupération des paiements d'une facture
   */
  getMockPaiementsByFacture(factureId: string): Observable<any[]> {
    // Génère des paiements fictifs pour la facture spécifiée
    const paiements: any[] = [];
    const nbPaiements = Math.floor(Math.random() * 3) + 1; // Entre 1 et 3 paiements
    
    // Récupère d'abord la facture pour connaître son montant total
    return this.getMockFactureById(factureId).pipe(
      map((facture: any) => {
        const montantTotal = facture.montantTotal;
        let montantRestant = montantTotal;
        
        for (let i = 1; i <= nbPaiements; i++) {
          let montantPaiement;
          
          if (i === nbPaiements) {
            // Le dernier paiement couvre le reste
            montantPaiement = montantRestant;
          } else {
            // Paiements intermédiaires
            montantPaiement = Math.floor(montantRestant / (nbPaiements - i + 1));
          }
          
          montantRestant -= montantPaiement;
          
          paiements.push({
            id: `PAY-${factureId.replace('FACT-', '')}-${i}`,
            reference: `REF-PAY-${factureId.replace('FACT-', '')}-${i}`,
            datePaiement: new Date(Date.now() - (nbPaiements - i) * 7 * 24 * 60 * 60 * 1000).toISOString(),
            montant: montantPaiement,
            methode: ['VIREMENT', 'CARTE', 'CHEQUE'][Math.floor(Math.random() * 3)],
            factureId: factureId
          });
        }
        
        return paiements;
      })
    );
  }

  /**
   * Génère des données fictives pour le graphique des ventes
   */
  private generateMockSalesData(): any[] {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const data = [];
    
    for (let i = 0; i < 12; i++) {
      data.push({
        mois: months[i],
        ventes: Math.floor(Math.random() * 15000) + 5000,
        commandes: Math.floor(Math.random() * 30) + 10
      });
    }
    
    return data;
  }

  /**
   * Génère des données fictives pour les paiements
   */
  getMockPaiements(page: number = 0, size: number = 10, statut?: string): Observable<any> {
    const totalElements = 15;
    
    let paiements = this.generateMockPaiements(totalElements);
    
    // Filtrage par statut si spécifié
    if (statut) {
      paiements = paiements.filter(p => p.statut === statut);
    }
    
    // Pagination
    const startIndex = page * size;
    const endIndex = Math.min(startIndex + size, paiements.length);
    const paginatedPaiements = paiements.slice(startIndex, endIndex);
    
    return of({
      content: paginatedPaiements,
      totalElements: paiements.length,
      totalPages: Math.ceil(paiements.length / size),
      currentPage: page,
      size: size
    });
  }

  // Méthodes privées pour générer des données fictives

  private generateMockCommandes(count: number): any[] {
    const statuts = ['EN_ATTENTE', 'CONFIRMEE', 'EN_COURS', 'LIVREE', 'ANNULEE'];
    const commandes = [];
    
    for (let i = 1; i <= count; i++) {
      commandes.push(this.generateMockCommande(`CMD-${i}`));
    }
    
    return commandes;
  }

  private generateMockCommande(id: string): any {
    const statuts = ['EN_ATTENTE', 'CONFIRMEE', 'EN_COURS', 'LIVREE', 'ANNULEE'];
    const randomStatut = statuts[Math.floor(Math.random() * statuts.length)];
    const dateCommande = new Date();
    dateCommande.setDate(dateCommande.getDate() - Math.floor(Math.random() * 30));
    
    const lignesCommande = [];
    const nbLignes = Math.floor(Math.random() * 5) + 1;
    let montantTotal = 0;
    
    for (let i = 1; i <= nbLignes; i++) {
      const quantite = Math.floor(Math.random() * 10) + 1;
      const prixUnitaire = Math.floor(Math.random() * 1000) + 50;
      const montant = quantite * prixUnitaire;
      montantTotal += montant;
      
      lignesCommande.push({
        id: `LC-${id}-${i}`,
        produitId: `PROD-${Math.floor(Math.random() * 100) + 1}`,
        nomProduit: `Produit ${Math.floor(Math.random() * 100) + 1}`,
        quantite: quantite,
        prixUnitaire: prixUnitaire,
        montant: montant
      });
    }
    
    return {
      id: id,
      reference: `REF-${id}`,
      dateCommande: dateCommande.toISOString(),
      statut: randomStatut,
      montantTotal: montantTotal,
      client: {
        id: 'CLIENT-1',
        nom: 'Entreprise ABC',
        adresse: '123 Rue du Commerce',
        email: 'contact@entreprise-abc.com',
        telephone: '0123456789'
      },
      lignesCommande: lignesCommande
    };
  }

  /**
   * Génère une liste de factures fictives
   * @param count Nombre de factures à générer
   * @returns Liste de factures fictives
   */
  private generateMockFactures(count: number): any[] {
    const factures: any[] = [];
    
    for (let i = 1; i <= count; i++) {
      factures.push(this.generateMockFacture(`FACT-${i}`));
    }
    
    return factures;
  }
  
  /**
   * Génère une facture fictive avec l'ID spécifié
   * @param id Identifiant de la facture
   * @returns Facture fictive
   */
  private generateMockFacture(id: string): any {
    // Vérifie si l'ID est déjà au format FACT-X
    const factureId = id.startsWith('FACT-') ? id : `FACT-${id}`;
    
    // Génère des données aléatoires pour la facture
    const statuts = ['PAYEE', 'EN_ATTENTE', 'RETARD'];
    const randomStatut = statuts[Math.floor(Math.random() * statuts.length)];
    const montantTotal = Math.floor(Math.random() * 10000) + 500;
    const montantPaye = randomStatut === 'PAYEE' ? montantTotal : Math.floor(Math.random() * montantTotal);
    
    return {
      id: factureId,
      reference: `REF-${factureId}`,
      dateEmission: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
      dateEcheance: new Date(Date.now() + Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
      montantTotal: montantTotal,
      montantPaye: montantPaye,
      statut: randomStatut,
      commandeId: `CMD-${factureId.replace('FACT-', '')}`,
      lignesFacture: this.generateMockLignesFacture(Math.floor(Math.random() * 5) + 1)
    };
  }

  /**
   * Génère des données fictives pour les produits avec filtres avancés
   */
  getMockProduitsWithFilters(page: number = 0, size: number = 10, filters?: any): Observable<any> {
    // Génère un ensemble de produits fictifs
    let produits = this.generateMockProduits(50);
    
    // Applique les filtres si fournis
    if (filters) {
      if (filters.nom) {
        produits = produits.filter(p => p.nom.toLowerCase().includes(filters.nom.toLowerCase()));
      }
      if (filters.categorie) {
        produits = produits.filter(p => p.categorie === filters.categorie);
      }
      if (filters.disponible !== undefined) {
        produits = produits.filter(p => p.disponible === filters.disponible);
      }
      if (filters.prixMin) {
        produits = produits.filter(p => p.prix >= filters.prixMin);
      }
      if (filters.prixMax) {
        produits = produits.filter(p => p.prix <= filters.prixMax);
      }
    }
    
    // Pagination
    const startIndex = page * size;
    const endIndex = Math.min(startIndex + size, produits.length);
    const paginatedProduits = produits.slice(startIndex, endIndex);
    
    return of({
      content: paginatedProduits,
      totalElements: produits.length,
      totalPages: Math.ceil(produits.length / size),
      currentPage: page,
      size: size
    });
  }

  private generateMockProduits(count: number): any[] {
    const categories = [
      'Électronique',
      'Informatique',
      'Mobilier',
      'Fournitures de bureau',
      'Équipement industriel',
      'Matériaux de construction',
      'Produits alimentaires'
    ];
    
    const produits = [];
    
    for (let i = 1; i <= count; i++) {
      const randomCategorie = categories[Math.floor(Math.random() * categories.length)];
      const disponible = Math.random() > 0.2; // 80% de chance d'être disponible
      const prix = Math.floor(Math.random() * 1000) + 50;
      
      produits.push({
        id: `PROD-${i}`,
        reference: `REF-PROD-${i}`,
        nom: `Produit ${i}`,
        description: `Description détaillée du produit ${i}. Ce produit est de haute qualité et fait partie de la catégorie ${randomCategorie}.`,
        prix: prix,
        categorie: randomCategorie,
        disponible: disponible,
        stock: disponible ? Math.floor(Math.random() * 100) + 1 : 0,
        dateCreation: new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000)).toISOString()
      });
    }
    
    return produits;
  }
  
  /**
   * Génère un produit fictif spécifique
   */
  getMockProduitById(id: string): Observable<any> {
    // Vérifie si l'ID est déjà au format PROD-X
    const produitId = id.startsWith('PROD-') ? id : `PROD-${id}`;
    
    // Génère un produit fictif avec l'ID spécifié
    const categories = [
      'Électronique',
      'Informatique',
      'Mobilier',
      'Fournitures de bureau',
      'Équipement industriel',
      'Matériaux de construction',
      'Produits alimentaires'
    ];
    
    const randomCategorie = categories[Math.floor(Math.random() * categories.length)];
    const disponible = Math.random() > 0.2; // 80% de chance d'être disponible
    const prix = Math.floor(Math.random() * 1000) + 50;
    
    const produit = {
      id: produitId,
      reference: `REF-${produitId}`,
      nom: `Produit ${produitId.replace('PROD-', '')}`,
      description: `Description détaillée du produit ${produitId.replace('PROD-', '')}. Ce produit est de haute qualité et fait partie de la catégorie ${randomCategorie}.`,
      prix: prix,
      categorie: randomCategorie,
      disponible: disponible,
      stock: disponible ? Math.floor(Math.random() * 100) + 1 : 0,
      dateCreation: new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000)).toISOString()
    };
    
    return of(produit);
  }
  
  /**
   * Simule la création d'un produit fictif
   */
  createMockProduit(produitData: any): Observable<any> {
    // Génère un ID aléatoire pour le nouveau produit
    const newId = `PROD-${Math.floor(Math.random() * 1000) + 100}`;
    
    // Crée un nouveau produit avec les données fournies et des valeurs par défaut pour les champs manquants
    const newProduit = {
      id: newId,
      reference: produitData.reference || `REF-${newId}`,
      nom: produitData.nom || `Nouveau Produit`,
      description: produitData.description || `Description du nouveau produit`,
      prix: produitData.prix || Math.floor(Math.random() * 1000) + 50,
      categorie: produitData.categorie || 'Électronique',
      disponible: produitData.disponible !== undefined ? produitData.disponible : true,
      stock: produitData.stock || Math.floor(Math.random() * 100) + 1,
      dateCreation: new Date().toISOString()
    };
    
    return of(newProduit);
  }
  
  /**
   * Simule la mise à jour d'un produit fictif
   */
  updateMockProduit(id: string, produitData: any): Observable<any> {
    // Récupère d'abord le produit fictif existant
    return this.getMockProduitById(id).pipe(
      map((existingProduit: any) => {
        // Fusionne les données existantes avec les nouvelles données
        return {
          ...existingProduit,
          ...produitData,
          id: existingProduit.id, // Conserve l'ID original
          dateModification: new Date().toISOString() // Ajoute une date de modification
        };
      })
    );
  }
  
  /**
   * Simule la mise à jour de la disponibilité d'un produit fictif
   */
  updateMockProduitDisponibilite(id: string, disponible: boolean): Observable<any> {
    // Récupère d'abord le produit fictif existant
    return this.getMockProduitById(id).pipe(
      map((existingProduit: any) => {
        // Met à jour uniquement la disponibilité
        return {
          ...existingProduit,
          disponible: disponible,
          dateModification: new Date().toISOString() // Ajoute une date de modification
        };
      })
    );
  }
  
  /**
   * Simule la suppression d'un produit fictif
   */
  deleteMockProduit(id: string): Observable<any> {
    // Simule une réponse de suppression réussie
    return of({ success: true, message: `Produit ${id} supprimé avec succès` });
  }

  private generateMockPaiements(count: number): any[] {
    const paiements = [];
    
    for (let i = 1; i <= count; i++) {
      paiements.push(this.generateMockPaiement(`PAIE-${i}`));
    }
    
    return paiements;
  }

  private generateMockPaiement(id: string): any {
    const modesPaiement = ['VIREMENT', 'CHEQUE', 'ESPECES', 'CARTE_BANCAIRE'];
    const randomMode = modesPaiement[Math.floor(Math.random() * modesPaiement.length)];
    const datePaiement = new Date();
    datePaiement.setDate(datePaiement.getDate() - Math.floor(Math.random() * 30));
    
    const factureId = `FACT-${Math.floor(Math.random() * 20) + 1}`;
    const montant = Math.floor(Math.random() * 5000) + 100;
    
    return {
      id: id,
      reference: `REF-${id}`,
      datePaiement: datePaiement.toISOString(),
      montant: montant,
      modePaiement: randomMode,
      factureId: factureId,
      description: `Paiement pour la facture ${factureId}`
    };
  }
}
