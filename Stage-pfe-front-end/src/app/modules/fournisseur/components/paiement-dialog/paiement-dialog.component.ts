import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FournisseurService } from '../../services/fournisseur.service';

@Component({
  selector: 'app-paiement-dialog',
  templateUrl: './paiement-dialog.component.html',
  styleUrls: ['./paiement-dialog.component.scss']
})
export class PaiementDialogComponent implements OnInit {
  paiementForm!: FormGroup;
  isLoading = false;
  factureDetails: any = null;
  modesPaiement = ['VIREMENT', 'CHEQUE', 'CARTE', 'ESPECES', 'AUTRE'];
  statutOptions = ['EN_ATTENTE', 'VALIDE', 'REFUSE', 'AUTRE'];

  constructor(
    private fb: FormBuilder,
    private fournisseurService: FournisseurService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<PaiementDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { factureId: string }
  ) { }

  ngOnInit(): void {
    this.initForm();
    this.loadFactureDetails();
  }

  initForm(): void {
    this.paiementForm = this.fb.group({
      montant: ['', [Validators.required, Validators.min(0.01)]],
      datePaiement: [new Date(), Validators.required],
      modePaiement: ['VIREMENT', Validators.required],
      reference: [''],
      statut: ['EN_ATTENTE', Validators.required],
      commentaires: ['']
    });
  }

  loadFactureDetails(): void {
    if (!this.data.factureId) return;

    this.isLoading = true;
    this.fournisseurService.getFactureById(this.data.factureId).subscribe(
      (response) => {
        this.factureDetails = response;
        // Préremplir le montant avec le montant restant à payer
        if (this.factureDetails.statutPaiement !== 'VALIDE') {
          this.paiementForm.patchValue({
            montant: this.factureDetails.montantTTC
          });
        }
        this.isLoading = false;
      },
      (error) => {
        console.error('Erreur lors du chargement des détails de la facture', error);
        this.snackBar.open('Erreur lors du chargement des détails de la facture', 'Fermer', { duration: 3000 });
        this.isLoading = false;
      }
    );
  }

  onSubmit(): void {
    if (this.paiementForm.invalid) {
      return;
    }

    this.isLoading = true;
    const paiementData = {
      ...this.paiementForm.value,
      datePaiement: this.formatDate(this.paiementForm.value.datePaiement)
    };

    this.fournisseurService.createPaiement(this.data.factureId, paiementData).subscribe(
      (response) => {
        this.isLoading = false;
        this.dialogRef.close(response);
      },
      (error) => {
        console.error('Erreur lors de la création du paiement', error);
        this.snackBar.open('Erreur lors de la création du paiement', 'Fermer', { duration: 3000 });
        this.isLoading = false;
      }
    );
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  private formatDate(date: Date): string {
    if (!date) return '';
    
    // Si date est déjà une chaîne au format ISO, la retourner telle quelle
    if (typeof date === 'string') {
      return date;
    }
    
    // Sinon, convertir la date en format ISO
    const d = new Date(date);
    return d.toISOString().split('T')[0]; // Format YYYY-MM-DD
  }
}
