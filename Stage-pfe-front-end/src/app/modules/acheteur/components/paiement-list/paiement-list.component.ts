import { Component, OnInit } from '@angular/core';
import { AcheteurService, Paiement } from '../../services';

@Component({
  selector: 'app-paiement-list',
  templateUrl: './paiement-list.component.html',
  styleUrls: ['./paiement-list.component.scss']
})
export class PaiementListComponent implements OnInit {
  paiements: Paiement[] = [];
  loading: boolean = true;
  error: string | null = null;

  constructor(private acheteurService: AcheteurService) { }

  ngOnInit(): void {
    this.loadPaiements();
  }

  loadPaiements(): void {
    this.loading = true;
    this.error = null;

    // Dans un environnement réel, nous utiliserions le service pour récupérer les paiements
    // Pour l'instant, nous utilisons des données fictives
    setTimeout(() => {
      this.paiements = [
        {
          id: 1,
          reference: 'PAY-2025-001',
          factureId: 1,
          factureNumero: 'FAC-2025-001',
          montant: 450.75,
          date: '2025-06-09',
          statut: 'Complété',
          methode: 'Carte bancaire'
        },
        {
          id: 2,
          reference: 'PAY-2025-002',
          factureId: 2,
          factureNumero: 'FAC-2025-002',
          montant: 320.50,
          date: '2025-06-10',
          statut: 'Complété',
          methode: 'Carte bancaire'
        }
      ];
      this.loading = false;
    }, 500);
  }

  telechargerRecu(paiement: Paiement): void {
    // Dans un environnement réel, nous utiliserions le service pour télécharger le reçu
    alert(`Téléchargement du reçu pour le paiement ${paiement.reference}`);
  }
}
