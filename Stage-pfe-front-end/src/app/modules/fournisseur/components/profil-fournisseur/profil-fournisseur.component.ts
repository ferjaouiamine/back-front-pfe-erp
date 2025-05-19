import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FournisseurService, ProfilFournisseur } from '../../services/fournisseur.service';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-profil-fournisseur',
  templateUrl: './profil-fournisseur.component.html',
  styleUrls: ['./profil-fournisseur.component.scss']
})
export class ProfilFournisseurComponent implements OnInit {
  // Formulaire de profil
  profilForm: FormGroup;
  
  // Données du profil
  profil: ProfilFournisseur | null = null;
  
  // État de chargement
  isLoading: boolean = true;
  isSaving: boolean = false;
  error: string | null = null;
  
  // Catégories de produits disponibles
  categoriesProduits: string[] = [
    'Électronique',
    'Informatique',
    'Vêtements',
    'Alimentation',
    'Mobilier',
    'Fournitures de bureau',
    'Matériel industriel',
    'Produits chimiques',
    'Autres'
  ];

  constructor(
    private fb: FormBuilder,
    private fournisseurService: FournisseurService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {
    // Initialiser le formulaire
    this.profilForm = this.fb.group({
      nom: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      telephone: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{8,15}$/)]],
      adresse: ['', Validators.required],
      description: [''],
      categorieProduits: [[], Validators.required]
    });
  }

  ngOnInit(): void {
    this.chargerProfil();
  }

  /**
   * Charge le profil du fournisseur
   */
  chargerProfil(): void {
    this.isLoading = true;
    this.error = null;
    
    this.fournisseurService.getProfilFournisseur()
      .subscribe({
        next: (profil) => {
          this.profil = profil;
          this.remplirFormulaire(profil);
          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Erreur lors du chargement du profil';
          this.isLoading = false;
          console.error('Erreur profil fournisseur:', err);
        }
      });
  }

  /**
   * Remplit le formulaire avec les données du profil
   */
  remplirFormulaire(profil: ProfilFournisseur): void {
    this.profilForm.patchValue({
      nom: profil.nom,
      email: profil.email,
      telephone: profil.telephone,
      adresse: profil.adresse,
      description: profil.description || '',
      categorieProduits: profil.categorieProduits || []
    });
  }

  /**
   * Enregistre les modifications du profil
   */
  enregistrerProfil(): void {
    if (this.profilForm.invalid) {
      // Marquer tous les champs comme touchés pour afficher les erreurs
      Object.keys(this.profilForm.controls).forEach(key => {
        const control = this.profilForm.get(key);
        control?.markAsTouched();
      });
      return;
    }
    
    this.isSaving = true;
    
    const profilData: Partial<ProfilFournisseur> = {
      ...this.profilForm.value
    };
    
    this.fournisseurService.updateProfilFournisseur(profilData)
      .subscribe({
        next: (profil) => {
          this.profil = profil;
          this.isSaving = false;
          this.snackBar.open('Profil mis à jour avec succès', 'Fermer', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
          });
        },
        error: (err) => {
          this.isSaving = false;
          this.snackBar.open('Erreur lors de la mise à jour du profil', 'Fermer', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['error-snackbar']
          });
          console.error('Erreur mise à jour profil:', err);
        }
      });
  }

  /**
   * Réinitialise le formulaire avec les données actuelles du profil
   */
  annulerModifications(): void {
    if (this.profil) {
      this.remplirFormulaire(this.profil);
    }
  }
}
