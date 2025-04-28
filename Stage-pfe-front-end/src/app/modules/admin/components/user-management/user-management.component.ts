import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UserManagementService } from '../../services/user-management.service';
import { User } from '../../../auth/services/auth.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit {
  // Propriétés pour la gestion des utilisateurs
  users: User[] = [];
  filteredUsers: User[] = [];
  selectedUser: User | null = null;
  userToDelete: User | null = null;
  showDeleteConfirmation = false;
  isLoading = false;
  isEditing = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  formErrorMessage: string | null = null;
  searchQuery = '';
  testResult: any = null;
  availableRoles = ['ADMIN', 'VENDEUR', 'CLIENT'];
  userForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private userService: UserManagementService,
    private userManagementService: UserManagementService
  ) {
    // Initialiser le formulaire
    this.userForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      roles: [[], [Validators.required]],
      password: ['', [Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    this.loadUsers();
  }
  
  /**
   * Teste l'accès aux endpoints d'administration
   */
  testAdminAccess(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;
    this.testResult = null;
    
    this.userManagementService.testAdminAccess().subscribe({
      next: (result: any) => {
        this.testResult = result;
        this.successMessage = 'Test d\'accès admin réussi !';
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Erreur lors du test d\'accès admin:', error);
        this.errorMessage = `Erreur lors du test d'accès admin: ${error.message}`;
        this.isLoading = false;
        this.testResult = { error: error.status, message: error.error?.message || error.statusText };
      }
    });
  }

  // Charger la liste des utilisateurs
  loadUsers(): void {
    this.isLoading = true;
    // Ne pas effacer le message de succès lors du rechargement des utilisateurs
    // this.errorMessage = null;
    
    this.userService.getUsers()
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (users) => {
          // Normaliser les rôles pour l'affichage (supprimer le préfixe ROLE_ si présent)
          this.users = users.map(user => ({
            ...user,
            roles: user.roles.map(role => this.userService.normalizeRole(role))
          }));
          this.filteredUsers = [...this.users];
        },
        error: (error) => {
          this.errorMessage = error.message || "Une erreur s'est produite lors du chargement des utilisateurs.";
          console.error('Erreur de chargement des utilisateurs:', error);
        }
      });
  }

  // Filtrer les utilisateurs en fonction de la recherche
  filterUsers(): void {
    if (!this.searchQuery.trim()) {
      this.filteredUsers = [...this.users];
      return;
    }
    
    const query = this.searchQuery.toLowerCase().trim();
    this.filteredUsers = this.users.filter(user => 
      user.username.toLowerCase().includes(query) || 
      user.email.toLowerCase().includes(query) ||
      user.roles.some(role => role.toLowerCase().includes(query))
    );
  }

  // Sélectionner un utilisateur pour édition
  selectUser(user: User): void {
    this.selectedUser = { ...user };
    this.isEditing = true;
    this.userForm.patchValue({
      username: user.username,
      email: user.email,
      roles: user.roles,
      password: '' // Vider le mot de passe pour l'édition
    });
    
    // Rendre le mot de passe optionnel en mode édition
    const passwordControl = this.userForm.get('password');
    if (passwordControl) {
      passwordControl.setValidators([]);
      passwordControl.updateValueAndValidity();
    }
  }

  // Préparer le formulaire pour un nouvel utilisateur
  newUser(): void {
    this.selectedUser = null;
    this.isEditing = true; // Mettre à true pour afficher le formulaire
    this.formErrorMessage = null;
    this.errorMessage = null;
    this.successMessage = null;
    
    // Réinitialiser le formulaire
    this.userForm.reset({
      username: '',
      email: '',
      roles: [],
      password: ''
    });
    
    // Rendre le mot de passe obligatoire pour un nouvel utilisateur
    const passwordControl = this.userForm.get('password');
    if (passwordControl) {
      passwordControl.setValidators([Validators.required, Validators.minLength(6)]);
      passwordControl.updateValueAndValidity();
    }
  }
  
  // Annuler l'édition et fermer le formulaire
  cancelEdit(): void {
    this.selectedUser = null;
    this.isEditing = false;
    this.formErrorMessage = null;
    this.userForm.reset({
      roles: []
    });
  }

  // Soumettre le formulaire (création ou mise à jour)
  onSubmit(): void {
    if (this.userForm.invalid) {
      // Marquer tous les champs comme touchés pour afficher les erreurs
      Object.keys(this.userForm.controls).forEach(key => {
        const control = this.userForm.get(key);
        if (control) {
          control.markAsTouched();
        }
      });
      this.formErrorMessage = "Veuillez corriger les erreurs dans le formulaire avant de soumettre.";
      return;
    }
    
    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;
    
    // Préparer les données utilisateur pour l'API
    const userData = {
      username: this.userForm.value.username,
      email: this.userForm.value.email,
      // Normaliser les rôles (s'assurer qu'ils ont le préfixe ROLE_)
      roles: (this.userForm.value.roles || []).map((role: string) => {
        const normalizedRole = this.userService.normalizeRole(role).toUpperCase();
        return normalizedRole.startsWith('ROLE_') ? normalizedRole : `ROLE_${normalizedRole}`;
      }),
      password: this.userForm.value.password || undefined
    };
    
    console.log('Données utilisateur à envoyer:', userData);
    
    if (this.isEditing && this.selectedUser) {
      // Mise à jour d'un utilisateur existant
      this.userService.updateUser(Number(this.selectedUser.id), userData)
        .pipe(finalize(() => this.isLoading = false))
        .subscribe({
          next: (response) => {
            console.log('Réponse de mise à jour:', response);
            this.successMessage = `L'utilisateur ${userData.username} a été mis à jour avec succès.`;
            this.loadUsers(); // Recharger la liste des utilisateurs
            this.newUser(); // Réinitialiser le formulaire
          },
          error: (error) => {
            console.error('Erreur de mise à jour:', error);
            this.errorMessage = error.message || "Une erreur s'est produite lors de la mise à jour de l'utilisateur.";
          }
        });
    } else {
      // Création d'un nouvel utilisateur
      this.userService.createUser(userData)
        .pipe(finalize(() => this.isLoading = false))
        .subscribe({
          next: (response) => {
            console.log('Réponse de création:', response);
            this.successMessage = `L'utilisateur ${userData.username} a été créé avec succès.`;
            this.loadUsers(); // Recharger la liste des utilisateurs
            this.newUser(); // Réinitialiser le formulaire
          },
          error: (error) => {
            console.error('Erreur de création:', error);
            this.errorMessage = error.message || "Une erreur s'est produite lors de la création de l'utilisateur.";
          }
        });
    }
  }

  // Confirmer la suppression d'un utilisateur
  confirmDelete(user: User): void {
    this.userToDelete = user;
    this.showDeleteConfirmation = true;
    this.errorMessage = null;
    this.successMessage = null;
  }

  // Annuler la suppression
  cancelDelete(): void {
    this.userToDelete = null;
    this.showDeleteConfirmation = false;
  }

  // Supprimer un utilisateur
  deleteUser(): void {
    if (!this.userToDelete) return;
    
    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;
    
    this.userService.deleteUser(Number(this.userToDelete.id))
      .pipe(finalize(() => {
        this.isLoading = false;
        this.showDeleteConfirmation = false;
        this.userToDelete = null;
      }))
      .subscribe({
        next: (response) => {
          const username = this.userToDelete?.username || 'L\'utilisateur';
          this.successMessage = `${username} a été supprimé avec succès.`;
          this.loadUsers(); // Recharger la liste des utilisateurs
        },
        error: (error) => {
          this.errorMessage = error.message || "Une erreur s'est produite lors de la suppression de l'utilisateur.";
          console.error('Erreur de suppression:', error);
        }
      });
  }

  // Vérifier si un rôle est sélectionné
  isRoleSelected(role: string): boolean {
    const roles = this.userForm.get('roles')?.value || [];
    return roles.includes(role);
  }

  // Normaliser un rôle pour l'affichage
  normalizeRoleForDisplay(role: string): string {
    return role.replace('ROLE_', '');
  }

  // Gérer la sélection/déselection d'un rôle
  toggleRole(role: string): void {
    const currentRoles = [...(this.userForm.value.roles || [])];
    const index = currentRoles.indexOf(role);
    
    if (index === -1) {
      currentRoles.push(role);
    } else {
      currentRoles.splice(index, 1);
    }
    
    this.userForm.patchValue({ roles: currentRoles });
  }
}
