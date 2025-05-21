import { Component, OnInit } from '@angular/core';
import { Facture, FactureItem, FactureService } from './services/facture.service';
import { ProductService } from '../stock/services/product.service';

interface IndexableFacture extends Facture {
  [key: string]: any;
}

interface IndexableFactureItem extends FactureItem {
  [key: string]: any;
}

export class TestFacturation {
  constructor(
    private factureService: FactureService,
    private productService: ProductService
  ) {}

  runAllTests(): void {
    console.log('=== DÉBUT DES TESTS DE FACTURATION ===');
    this.testCreateFacture();
    this.testGetFacture();
    this.testGetAllFactures();
    console.log('=== FIN DES TESTS DE FACTURATION ===');
  }

  testCreateFacture(): void {
    console.log('--- Test de création de facture ---');

    const facture: Facture = {
      id: '',
      clientName: 'Client Test',
      clientEmail: 'client.test@example.com',
      clientAddress: '123 Rue de Test, Ville Test',
      clientPhone: '0123456789',
      date: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'DRAFT',
      total: 0,
      subtotal: 0,
      tax: 0,
      items: [this.createTestItem(1), this.createTestItem(2)]
    };

    facture.subtotal = facture.items.reduce((sum, item) => sum + item.total, 0);
    facture.tax = facture.subtotal * 0.2;
    facture.total = facture.subtotal + facture.tax;

    console.log('Facture à créer:', facture);

    this.factureService.createFacture(facture).subscribe({
      next: (createdFacture) => {
        console.log('Facture créée avec succès:', createdFacture);
        console.log('ID de la facture créée:', createdFacture.id);
        this.verifyFactureFields(facture, createdFacture);
        this.verifyFactureItems(facture.items, createdFacture.items);
      },
      error: (error) => {
        console.error('Erreur lors de la création de la facture:', error);
      }
    });
  }

  testGetFacture(): void {
    console.log('--- Test de récupération de facture ---');

    const factureId = 'mock-1747849924011-541';

    this.factureService.getFactureById(factureId).subscribe({
      next: (facture) => {
        console.log('Facture récupérée avec succès:', facture);
        this.checkFactureCompleteness(facture);

        if (facture.items && facture.items.length > 0) {
          facture.items.forEach(item => this.checkItemCompleteness(item));
        } else {
          console.warn('La facture n\'a pas d\'items ou le tableau est vide');
        }
      },
      error: (error) => {
        console.error('Erreur lors de la récupération de la facture:', error);
      }
    });
  }

  testGetAllFactures(): void {
    console.log('--- Test de récupération de toutes les factures ---');

    this.factureService.getAllFactures().subscribe({
      next: (factures) => {
        console.log('Factures récupérées avec succès:', factures.length, 'factures');

        if (factures.length > 0) {
          console.log('Première facture:', factures[0]);
          this.checkFactureCompleteness(factures[0]);

          if (factures[0].items && factures[0].items.length > 0) {
            factures[0].items.forEach(item => this.checkItemCompleteness(item));
          } else {
            console.warn('La première facture n\'a pas d\'items ou le tableau est vide');
          }
        } else {
          console.warn('Aucune facture récupérée');
        }
      },
      error: (error) => {
        console.error('Erreur lors de la récupération des factures:', error);
      }
    });
  }

  private createTestItem(index: number): FactureItem {
    return {
      id: '',
      factureId: '',
      productId: `prod-${index}`,
      productName: `Produit Test ${index}`,
      description: `Description du produit test ${index}`,
      quantity: index,
      unitPrice: 100 * index,
      total: 100 * index * index,
      category: {
        id: index,
        name: `Catégorie ${index}`
      },
      imageUrl: `https://example.com/images/product${index}.jpg`,
      sku: `SKU-${index}`,
      barcode: `BARCODE-${index}`,
      weight: 1.5 * index,
      dimensions: {
        length: 10 * index,
        width: 5 * index,
        height: 2 * index
      },
      taxRate: 20,
      discount: 0,
      metadata: {
        couleur: index % 2 === 0 ? 'Rouge' : 'Bleu',
        matière: index % 2 === 0 ? 'Plastique' : 'Métal',
        origine: 'France'
      }
    };
  }

  private verifyFactureFields(original: Facture, created: Facture): boolean {
    console.log('Vérification des champs de la facture:');
    const fieldsToCheck = [
      'clientName', 'clientEmail', 'clientAddress', 'clientPhone',
      'status', 'subtotal', 'tax', 'total'
    ];

    let allFieldsPreserved = true;
    const indexableOriginal = original as IndexableFacture;
    const indexableCreated = created as IndexableFacture;

    fieldsToCheck.forEach(field => {
      if (indexableOriginal[field] !== indexableCreated[field]) {
        console.warn(`Champ ${field} non préservé: Original=${indexableOriginal[field]}, Créé=${indexableCreated[field]}`);
        allFieldsPreserved = false;
      }
    });

    if (allFieldsPreserved) {
      console.log('Tous les champs de la facture ont été préservés');
    }

    return allFieldsPreserved;
  }

  private verifyFactureItems(originalItems: FactureItem[], createdItems: FactureItem[]): boolean {
    console.log('Vérification des éléments de la facture:');

    if (originalItems.length !== createdItems.length) {
      console.warn(`Nombre d'éléments différent: Original=${originalItems.length}, Créé=${createdItems.length}`);
      return false;
    }

    const fieldsToCheck = [
      'productId', 'productName', 'quantity', 'unitPrice', 'total', 'category'
    ];

    let allItemsPreserved = true;

    originalItems.forEach((original, i) => {
      const created = createdItems[i];
      const indexableOriginal = original as IndexableFactureItem;
      const indexableCreated = created as IndexableFactureItem;

      fieldsToCheck.forEach(field => {
        if (indexableOriginal[field] !== indexableCreated[field]) {
          console.warn(`Champ ${field} non préservé dans l'item ${i + 1}: Original=${indexableOriginal[field]}, Créé=${indexableCreated[field]}`);
          allItemsPreserved = false;
        }
      });
    });

    if (allItemsPreserved) {
      console.log('Tous les items de la facture ont été préservés avec tous leurs détails');
    }

    return allItemsPreserved;
  }

  private checkFactureCompleteness(facture: Facture): void {
    console.log('Vérification de la complétude de la facture:');
    const requiredFields = [
      'id', 'clientName', 'clientEmail', 'date', 'dueDate', 'status', 'total', 'items'
    ];

    let allFieldsPresent = true;
    const indexableFacture = facture as IndexableFacture;

    requiredFields.forEach(field => {
      if (indexableFacture[field] === undefined || indexableFacture[field] === null) {
        console.warn(`Champ ${field} manquant dans la facture`);
        allFieldsPresent = false;
      }
    });

    if (allFieldsPresent) {
      console.log('La facture contient tous les champs obligatoires');
    }
  }

  private checkItemCompleteness(item: FactureItem): void {
    console.log("Vérification de la complétude de l'item:");
    const requiredFields = [
      'id', 'productId', 'productName', 'quantity', 'unitPrice', 'total'
    ];

    let allFieldsPresent = true;
    const indexableItem = item as IndexableFactureItem;

    requiredFields.forEach(field => {
      if (indexableItem[field] === undefined || indexableItem[field] === null) {
        console.warn(`Champ ${field} manquant dans l'item`);
        allFieldsPresent = false;
      }
    });

    if (allFieldsPresent) {
      console.log("L'item contient tous les champs obligatoires");
    }
  }
}
