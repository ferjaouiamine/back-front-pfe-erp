// Simple test script to create and retrieve a purchase order
import fetch from 'node-fetch';

const API_URL = 'http://localhost:8088/api/commandes';

// Test data for creating a new purchase order
const newOrder = {
  fournisseur: {
    id: 1,
    nom: "Fournisseur Test"
  },
  dateCommande: new Date().toISOString().split('T')[0],
  dateLivraisonPrevue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  notes: "Commande de test via script",
  creePar: "Script Test",
  lignes: [
    {
      produitId: 1,
      designation: "Produit Test 1",
      reference: "REF001",
      description: "Description du produit test 1",
      quantite: 5,
      prixUnitaireHT: 100,
      tauxTVA: 20
    },
    {
      produitId: 2,
      designation: "Produit Test 2",
      reference: "REF002",
      description: "Description du produit test 2",
      quantite: 3,
      prixUnitaireHT: 200,
      tauxTVA: 20
    }
  ]
};

// Create a new purchase order
async function createOrder() {
  try {
    console.log('Creating new purchase order...');
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newOrder)
    });
    
    if (!response.ok) {
      throw new Error(`Error creating order: ${response.status} ${response.statusText}`);
    }
    
    const createdOrder = await response.json();
    console.log('Order created successfully!');
    console.log(`Order ID: ${createdOrder.id}`);
    console.log(`Order Number: ${createdOrder.numero}`);
    console.log(`Number of line items: ${createdOrder.lignes ? createdOrder.lignes.length : 0}`);
    
    return createdOrder;
  } catch (error) {
    console.error('Failed to create order:', error);
    return null;
  }
}

// Retrieve a purchase order by ID
async function getOrder(id) {
  try {
    console.log(`Retrieving order with ID ${id}...`);
    const response = await fetch(`${API_URL}/${id}`);
    
    if (!response.ok) {
      throw new Error(`Error retrieving order: ${response.status} ${response.statusText}`);
    }
    
    const order = await response.json();
    console.log('Order retrieved successfully!');
    console.log(`Order Number: ${order.numero}`);
    console.log(`Supplier: ${order.fournisseur ? order.fournisseur.nom : 'N/A'}`);
    console.log(`Number of line items: ${order.lignes ? order.lignes.length : 0}`);
    
    if (order.lignes && order.lignes.length > 0) {
      console.log('\nLine Items:');
      order.lignes.forEach((ligne, index) => {
        console.log(`${index + 1}. ${ligne.designation} - Quantity: ${ligne.quantite}, Unit Price: ${ligne.prixUnitaireHT}`);
      });
    }
    
    return order;
  } catch (error) {
    console.error(`Failed to retrieve order with ID ${id}:`, error);
    return null;
  }
}

// Run the test
async function runTest() {
  const createdOrder = await createOrder();
  
  if (createdOrder && createdOrder.id) {
    // Wait a moment to ensure the order is fully processed
    console.log('Waiting 2 seconds before retrieving the order...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await getOrder(createdOrder.id);
  }
}

runTest();
