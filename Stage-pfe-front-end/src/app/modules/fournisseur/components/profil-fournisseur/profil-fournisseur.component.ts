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
        next: (profil: ProfilFournisseur) => {
          this.profil = profil;
          this.remplirFormulaire(profil);
            this.isLoading = false;
        },
        error: (err: any) => {
          this.isLoading = false;
          
          if (err.status === 401 || err.status === 403) {
            this.error = 'Accès non autorisé. Veuillez vous reconnecter.';
            this.snackBar.open('Session expirée. Veuillez vous reconnecter.', 'Fermer', {
              duration: 5000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom',
              panelClass: ['error-snackbar']
            });
          } else if (err.status === 0) {
            this.error = 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.';
          } else {
            this.error = `Erreur lors du chargement du profil: ${err.status ? err.status : 'Erreur inconnue'}`;
          }
          
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
      
      this.snackBar.open('Veuillez corriger les erreurs dans le formulaire', 'Fermer', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['warning-snackbar']
      });
      return;
    }
    
    this.isSaving = true;
    this.error = null;
    
    const profilData: Partial<ProfilFournisseur> = {
      ...this.profilForm.value
    };
    
    this.fournisseurService.updateProfilFournisseur(profilData)
      .subscribe({
        next: (profil: ProfilFournisseur) => {
          this.profil = profil;
          this.isSaving = false;
          this.snackBar.open('Profil mis à jour avec succès', 'Fermer', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['success-snackbar']
          });
        },
        error: (err: any) => {
          this.isSaving = false;
          
          let errorMessage = 'Erreur lors de la mise à jour du profil';
          
          if (err.status === 401 || err.status === 403) {
            errorMessage = 'Session expirée. Veuillez vous reconnecter.';
          } else if (err.status === 0) {
            errorMessage = 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.';
          } else if (err.status === 400) {
            errorMessage = 'Données invalides. Veuillez vérifier les informations saisies.';
          } else if (err.error && err.error.message) {
            errorMessage = err.error.message;
          }
          
          this.snackBar.open(errorMessage, 'Fermer', {
            duration: 5000,
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
