import fetch from 'node-fetch';

// Configuration
const API_URL = 'http://localhost:8088/api/commandes/with-email';
const FOURNISSEUR_EMAIL = 'test.fournisseur@example.com';

// Données de la commande
const commandeData = {
  dateCommande: new Date().toISOString().split('T')[0],
  dateLivraisonPrevue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  notes: "Commande de test avec email",
  creePar: "Magasinier Test",
  lignes: [
    {
      produitId: 1,
      designation: "Produit Test 1",
      reference: "REF001",
      quantite: 10,
      prixUnitaireHT: 15.50
    },
    {
      produitId: 2,
      designation: "Produit Test 2",
      reference: "REF002",
      quantite: 5,
      prixUnitaireHT: 25.75
    }
  ]
};

// Fonction pour créer une commande avec email
async function createCommandeWithEmail() {
  try {
    console.log('Envoi de la requête pour créer une commande avec email...');
    
    // Construction de l'URL avec le paramètre email
    const url = `${API_URL}?fournisseurEmail=${encodeURIComponent(FOURNISSEUR_EMAIL)}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commandeData),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
    }
    
    const commande = await response.json();
    console.log('Commande créée avec succès:');
    console.log(`ID: ${commande.id}`);
    console.log(`Numéro: ${commande.numero}`);
    console.log(`Fournisseur: ${commande.fournisseur ? commande.fournisseur.nom : 'Non défini'} (Email: ${commande.fournisseur ? commande.fournisseur.email : 'Non défini'})`);
    console.log(`Date de commande: ${commande.dateCommande}`);
    console.log(`Statut: ${commande.statut}`);
    console.log(`Montant HT: ${commande.montantHT}`);
    console.log(`Montant TTC: ${commande.montantTTC}`);
    console.log(`Nombre de lignes: ${commande.lignes ? commande.lignes.length : 0}`);
    
    // Afficher les détails des lignes de commande
    if (commande.lignes && commande.lignes.length > 0) {
      console.log('\nDétails des lignes de commande:');
      commande.lignes.forEach((ligne, index) => {
        console.log(`\nLigne ${index + 1}:`);
        console.log(`  Produit ID: ${ligne.produitId}`);
        console.log(`  Désignation: ${ligne.designation}`);
        console.log(`  Référence: ${ligne.reference}`);
        console.log(`  Quantité: ${ligne.quantite}`);
        console.log(`  Prix unitaire HT: ${ligne.prixUnitaireHT}`);
        console.log(`  Montant HT: ${ligne.montantHT}`);
      });
    }
    
    return commande;
  } catch (error) {
    console.error('Erreur lors de la création de la commande:', error.message);
    throw error;
  }
}

// Exécution du test
createCommandeWithEmail()
  .then(() => console.log('\nTest terminé avec succès'))
  .catch(error => console.error('\nTest échoué:', error));
