import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FournisseurService, AvisExpedition, CommandeFournisseur } from '../../services/fournisseur.service';
import { catchError, finalize, switchMap, tap } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-avis-expedition',
  templateUrl: './avis-expedition.component.html',
  styleUrls: ['./avis-expedition.component.scss']
})
export class AvisExpeditionComponent implements OnInit {
  commandeId: string = '';
  commande: CommandeFournisseur = {} as CommandeFournisseur;
  avisExpedition: AvisExpedition = {} as AvisExpedition;
  avisForm: FormGroup = {} as FormGroup;
  loading = false;
  submitting = false;
  isNewAvis = true;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private fournisseurService: FournisseurService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.initForm();
    const idParam = this.route.snapshot.paramMap.get('id');
    this.commandeId = idParam !== null ? idParam : '';
    this.loadData();
  }

  initForm(): void {
    this.avisForm = this.fb.group({
      dateExpedition: [new Date(), Validators.required],
      dateLivraisonEstimee: [new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), Validators.required], // Date actuelle + 7 jours
      transporteur: ['', Validators.required],
      numeroSuivi: ['', Validators.required],
      commentaires: [''],
      expeditionPartielle: [false]
    });
  }

  loadData(): void {
    this.loading = true;
    
    // Récupérer les détails de la commande
    this.fournisseurService.getCommandeById(this.commandeId)
      .pipe(
        tap(commande => this.commande = commande),
        switchMap(() => {
          // Essayer de récupérer un avis d'expédition existant
          return this.fournisseurService.getAvisExpedition(this.commandeId).pipe(
            tap(avis => {
              this.avisExpedition = avis;
              this.isNewAvis = false;
              this.updateFormWithAvis(avis);
            }),
            catchError(error => {
              // Si aucun avis n'existe, on reste en mode création
              this.isNewAvis = true;
              return of(null);
            })
          );
        }),
        finalize(() => this.loading = false)
      )
      .subscribe({
        error: error => {
          this.snackBar.open('Erreur lors du chargement des données: ' + error.message, 'Fermer', { duration: 5000 });
        }
      });
  }

  updateFormWithAvis(avis: AvisExpedition): void {
    this.avisForm.patchValue({
      dateExpedition: avis.dateExpedition,
      dateLivraisonEstimee: avis.dateLivraisonEstimee,
      transporteur: avis.transporteur,
      numeroSuivi: avis.numeroSuivi,
      commentaires: avis.commentaires || '',
      expeditionPartielle: avis.expeditionPartielle
    });
  }

  onSubmit(): void {
    if (this.avisForm.invalid) {
      return;
    }

    this.submitting = true;
    const avisData = this.avisForm.value;

    if (this.isNewAvis) {
      // Créer un nouvel avis d'expédition
      this.fournisseurService.createAvisExpedition(this.commandeId, avisData)
        .pipe(finalize(() => this.submitting = false))
        .subscribe({
          next: avis => {
            this.snackBar.open('Avis d\'expédition créé avec succès', 'Fermer', { duration: 3000 });
            this.router.navigate(['/fournisseur/commandes', this.commandeId]);
          },
          error: error => {
            this.snackBar.open('Erreur lors de la création de l\'avis d\'expédition: ' + error.message, 'Fermer', { duration: 5000 });
          }
        });
    } else {
      // Mettre à jour l'avis d'expédition existant
      this.fournisseurService.updateAvisExpedition(this.avisExpedition.id, avisData)
        .pipe(finalize(() => this.submitting = false))
        .subscribe({
          next: avis => {
            this.snackBar.open('Avis d\'expédition mis à jour avec succès', 'Fermer', { duration: 3000 });
            this.router.navigate(['/fournisseur/commandes', this.commandeId]);
          },
          error: error => {
            this.snackBar.open('Erreur lors de la mise à jour de l\'avis d\'expédition: ' + error.message, 'Fermer', { duration: 5000 });
          }
        });
    }
  }

  onCancel(): void {
    this.router.navigate(['/fournisseur/commandes', this.commandeId]);
  }
}
