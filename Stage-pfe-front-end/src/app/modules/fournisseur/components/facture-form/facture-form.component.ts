import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FournisseurService, FactureFournisseur, CommandeFournisseur } from '../../services/fournisseur.service';
import { catchError, finalize, switchMap, tap } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-facture-form',
  templateUrl: './facture-form.component.html',
  styleUrls: ['./facture-form.component.scss']
})
export class FactureFormComponent implements OnInit {
  commandeId: string = '';
  factureId: string = '';
  commande: CommandeFournisseur = {} as CommandeFournisseur;
  facture: FactureFournisseur = {} as FactureFournisseur;
  factureForm!: FormGroup;
  loading = false;
  submitting = false;
  isNewFacture = true;
  uploadedFile: File | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private fournisseurService: FournisseurService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.initForm();
    
    const commandeIdParam = this.route.snapshot.paramMap.get('commandeId');
    const factureIdParam = this.route.snapshot.paramMap.get('factureId');
    
    this.commandeId = commandeIdParam !== null ? commandeIdParam : '';
    this.factureId = factureIdParam !== null ? factureIdParam : '';
    
    if (this.factureId) {
      this.isNewFacture = false;
      this.loadFacture();
    } else if (this.commandeId) {
      this.loadCommande();
    } else {
      this.snackBar.open('Paramètres invalides', 'Fermer', { duration: 3000 });
      this.router.navigate(['/fournisseur/factures']);
    }
  }

  initForm(): void {
    this.factureForm = this.fb.group({
      dateFacture: [new Date(), Validators.required],
      dateEcheance: [new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), Validators.required], // Date actuelle + 30 jours
      montantHT: [0, [Validators.required, Validators.min(0)]],
      montantTVA: [0, [Validators.required, Validators.min(0)]],
      montantTTC: [0, [Validators.required, Validators.min(0)]],
      commentaires: [''],
      cheminFichier: ['']
    });

    // Mettre à jour automatiquement le montant TTC lorsque HT ou TVA change
    this.factureForm.get('montantHT')?.valueChanges.subscribe(() => this.updateMontantTTC());
    this.factureForm.get('montantTVA')?.valueChanges.subscribe(() => this.updateMontantTTC());
  }

  updateMontantTTC(): void {
    const montantHT = this.factureForm.get('montantHT')?.value || 0;
    const montantTVA = this.factureForm.get('montantTVA')?.value || 0;
    this.factureForm.get('montantTTC')?.setValue(montantHT + montantTVA);
  }

  loadCommande(): void {
    this.loading = true;
    this.fournisseurService.getCommandeById(this.commandeId)
      .pipe(
        tap(commande => {
          this.commande = commande;
          // Pré-remplir les montants avec ceux de la commande
          this.factureForm.patchValue({
            montantHT: commande.montantTotal / 1.2, // Approximation pour séparer HT et TVA
            montantTVA: commande.montantTotal - (commande.montantTotal / 1.2),
            montantTTC: commande.montantTotal
          });
        }),
        finalize(() => this.loading = false)
      )
      .subscribe({
        error: error => {
          this.snackBar.open('Erreur lors du chargement de la commande: ' + error.message, 'Fermer', { duration: 5000 });
        }
      });
  }

  loadFacture(): void {
    this.loading = true;
    this.fournisseurService.getFactureById(this.factureId)
      .pipe(
        tap(facture => {
          this.facture = facture;
          this.updateFormWithFacture(facture);
        }),
        switchMap(facture => {
          // Récupérer les détails de la commande associée
          return this.fournisseurService.getCommandeById(facture.commandeId).pipe(
            tap(commande => this.commande = commande)
          );
        }),
        finalize(() => this.loading = false)
      )
      .subscribe({
        error: error => {
          this.snackBar.open('Erreur lors du chargement de la facture: ' + error.message, 'Fermer', { duration: 5000 });
        }
      });
  }

  updateFormWithFacture(facture: FactureFournisseur): void {
    this.factureForm.patchValue({
      dateFacture: facture.dateFacture,
      dateEcheance: facture.dateEcheance,
      montantHT: facture.montantHT,
      montantTVA: facture.montantTVA,
      montantTTC: facture.montantTTC,
      commentaires: facture.commentaires || '',
      cheminFichier: facture.cheminFichier || ''
    });
  }

  onFileSelected(event: Event): void {
    const element = event.target as HTMLInputElement;
    if (element.files && element.files.length > 0) {
      this.uploadedFile = element.files[0];
      // Dans un cas réel, on utiliserait un service pour uploader le fichier
      // et récupérer l'URL ou le chemin du fichier uploadé
      this.factureForm.patchValue({
        cheminFichier: this.uploadedFile.name
      });
    }
  }

  onSubmit(): void {
    if (this.factureForm.invalid) {
      return;
    }

    this.submitting = true;
    const factureData = this.factureForm.value;

    if (this.isNewFacture) {
      // Créer une nouvelle facture
      this.fournisseurService.createFacture(this.commandeId, factureData)
        .pipe(finalize(() => this.submitting = false))
        .subscribe({
          next: facture => {
            this.snackBar.open('Facture créée avec succès', 'Fermer', { duration: 3000 });
            this.router.navigate(['/fournisseur/factures']);
          },
          error: error => {
            this.snackBar.open('Erreur lors de la création de la facture: ' + error.message, 'Fermer', { duration: 5000 });
          }
        });
    } else {
      // Mettre à jour la facture existante
      this.fournisseurService.updateFacture(this.factureId, factureData)
        .pipe(finalize(() => this.submitting = false))
        .subscribe({
          next: facture => {
            this.snackBar.open('Facture mise à jour avec succès', 'Fermer', { duration: 3000 });
            this.router.navigate(['/fournisseur/factures']);
          },
          error: error => {
            this.snackBar.open('Erreur lors de la mise à jour de la facture: ' + error.message, 'Fermer', { duration: 5000 });
          }
        });
    }
  }

  onCancel(): void {
    if (this.isNewFacture) {
      this.router.navigate(['/fournisseur/commandes', this.commandeId]);
    } else {
      this.router.navigate(['/fournisseur/factures']);
    }
  }
}
