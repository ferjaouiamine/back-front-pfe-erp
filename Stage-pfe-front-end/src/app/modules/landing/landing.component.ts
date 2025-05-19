import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit {
  // Propriété pour la tarification
  isAnnualBilling = false;

  // Fonctionnalités principales
  features = [
    {
      icon: 'speed',
      title: 'Performance optimisée',
      description: 'Tijartek ERP offre des performances exceptionnelles même avec de grandes quantités de données.'
    },
    {
      title: 'Gestion de Stock',
      description: 'Suivez vos produits en temps réel, gérez les alertes de stock et optimisez votre inventaire.',
      icon: 'inventory_2',
      route: '/stock'
    },
    {
      icon: 'security',
      title: 'Sécurité renforcée',
      description: 'Protection des données avec authentification JWT et gestion avancée des rôles utilisateurs.'
    },
    {
      title: 'Point de Vente',
      description: 'Interface intuitive pour vos caisses avec gestion des paiements, tickets et code-barres.',
      icon: 'point_of_sale',
      route: '/caisse'
    },
    {
      title: 'Facturation',
      description: 'Créez et gérez vos factures, suivez les paiements et générez des rapports détaillés.',
      icon: 'receipt_long',
      route: '/facturation'
    },
    {
      title: 'Achats',
      description: 'Gérez vos fournisseurs, commandes et suivez les livraisons de manière efficace.',
      icon: 'shopping_cart',
      route: '/achat'
    }
  ];

  // Témoignages clients
  testimonials = [
    {
      quote: 'Depuis que nous avons adopté Tijartek ERP, notre productivité a augmenté de 30%. L\'interface est intuitive et les fonctionnalités répondent parfaitement à nos besoins.',
      author: 'Sophie Martin',
      position: 'Directrice des opérations, Retail Plus'
    },
    {
      quote: 'La modularité de Tijartek ERP nous permet d\'adapter le système à nos besoins spécifiques. Le support client est également très réactif.',
      author: 'Thomas Dubois',
      position: 'DSI, Groupe Innovatech'
    },
    {
      quote: 'Ce système ERP a transformé notre gestion quotidienne. Tout est centralisé et accessible en quelques clics.',
      author: 'Émilie Laurent',
      position: 'Responsable Achats, Magasin Bio & Local'
    }
  ];

  constructor(private router: Router, private dialog: MatDialog) { }

  ngOnInit(): void {
    // Initialisation si nécessaire
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  openContactForm(companySize: string): void {
    // Cette méthode pourrait ouvrir un dialogue de contact
    console.log(`Contact requested for ${companySize} company`);
    // Ici, vous pourriez implémenter un dialogue avec MatDialog
    // this.dialog.open(ContactDialogComponent, { data: { companySize } });
  }
}
