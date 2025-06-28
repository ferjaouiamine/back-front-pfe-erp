import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import * as AOS from 'aos';
import Swal from 'sweetalert2';
import { AuthService, LoginRequest } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  usernameOrEmail: string = '';
  password: string = '';
  errorMessage: string | null = null;
  successMessage: string | null = null; // Message de succès
  isLoading: boolean = false;
  showPassword: boolean = false;
  loginForm: FormGroup;

  returnUrl: string = '/facturation';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      usernameOrEmail: ['', [Validators.required]], 
      password: ['', Validators.required],
      rememberMe: [false]
    });
  }

  ngOnInit(): void {
    AOS.init();
    
    // Récupérer les informations sauvegardées si elles existent
    const savedUsername = localStorage.getItem('rememberedUsername');
    if (savedUsername) {
      this.loginForm.patchValue({ usernameOrEmail: savedUsername, rememberMe: true });
    }

    // Récupérer l'URL de retour des paramètres de requête
    this.route.queryParams.subscribe(params => {
      this.returnUrl = params['returnUrl'] || this.getDefaultRedirectUrl();
      
      // Vérifier si l'utilisateur vient de s'inscrire
      if (params['registered'] === 'true') {
        const roleName = params['roleName'] || 'Utilisateur';
        this.successMessage = `Inscription réussie en tant que ${roleName}! Vous pouvez maintenant vous connecter.`;
        
        // Si un nom d'utilisateur a été passé dans les paramètres, le pré-remplir
        if (params['username']) {
          this.loginForm.patchValue({ usernameOrEmail: params['username'] });
        }
      }
    });
  }
  
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onLogin(): void {
    if (this.loginForm.invalid) {
      this.errorMessage = 'Veuillez remplir correctement tous les champs.'; 
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null; // Réinitialiser le message de succès
    console.log('Tentative de connexion avec', this.loginForm.value.usernameOrEmail);

    // Créer un objet conforme à l'interface LoginRequest
    const loginRequest: LoginRequest = {
      usernameOrEmail: this.loginForm.value.usernameOrEmail,
      password: this.loginForm.value.password
    };

    this.authService.login(loginRequest) 
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          console.log('Connexion réussie:', response);
          
          // Sauvegarder le nom d'utilisateur si "Se souvenir de moi" est coché
          if (this.loginForm.value.rememberMe) {
            localStorage.setItem('rememberedUsername', this.loginForm.value.usernameOrEmail);
          } else {
            localStorage.removeItem('rememberedUsername');
          }
          
          // Forcer le rechargement des informations utilisateur depuis le token
          this.authService.loadUserFromToken();
          
          // Attendre que les informations utilisateur soient chargées avant de rediriger
          setTimeout(() => {
            const currentUser = this.authService.getCurrentUser();
            const userRoles = this.authService.getUserRoles();
            
            console.log('Utilisateur après connexion:', currentUser);
            console.log('Rôles utilisateur:', userRoles);
            console.log('Rôles normalisés:', this.authService.getUserRoles(true));
            console.log('URL de retour:', this.returnUrl);
            
            // Vérification détaillée des rôles
            console.log('Vérification des rôles:');
            console.log('- ADMIN:', this.authService.hasRole('ADMIN'));
            console.log('- VENDEUR:', this.authService.hasRole('VENDEUR'));
            console.log('- CLIENT:', this.authService.hasRole('CLIENT'));
            
            // Si returnUrl est spécifié, rediriger vers cette URL
            // Sinon, rediriger en fonction du rôle
            if (this.returnUrl && this.returnUrl !== '/auth/login') {
              console.log('Redirection vers URL de retour:', this.returnUrl);
              this.router.navigateByUrl(this.returnUrl);
            } else {
              const defaultUrl = this.getDefaultRedirectUrl();
              console.log('Redirection vers URL par défaut:', defaultUrl);
              this.router.navigateByUrl(defaultUrl);
            }
          }, 300); // Augmenter le délai à 300ms pour s'assurer que tout est bien chargé
        },
        error: (error: any) => {
          this.isLoading = false;
          console.error('Erreur de connexion:', error);
          
          // Traiter les différents types d'erreurs
          if (error.message) {
            this.errorMessage = error.message;
          } else if (error.error && error.error.message) {
            this.errorMessage = error.error.message;
          } else {
            this.errorMessage = 'Une erreur est survenue lors de la connexion. Veuillez réessayer.';
          }
          
          // Si l'erreur est de type 403 (Forbidden) ou contient des mots liés à l'activation
          if (error.status === 403 || 
              (this.errorMessage && this.errorMessage.toLowerCase().includes('activ')) ||
              (this.errorMessage && this.errorMessage.toLowerCase().includes('approuv'))) {
            
            console.log('Erreur liée à l\'activation du compte détectée');
            
            // Message d'erreur plus visible et explicite
            this.errorMessage = 'ATTENTION: Votre compte n\'a pas encore été approuvé par un administrateur.';
            
            // Afficher un popup élégant avec SweetAlert2
            Swal.fire({
              title: 'Compte en attente d\'approbation',
              html: `
                <div class="approval-message">
                  <p class="alert-text"><i class="fas fa-exclamation-circle"></i> <strong>Votre compte est actuellement en attente d'approbation par un administrateur.</strong></p>
                  
                  <div class="info-section">
                    <h3>Que faire maintenant ?</h3>
                    <ul>
                      <li><i class="fas fa-clock"></i> Veuillez patienter jusqu'à ce qu'un administrateur approuve votre compte</li>
                      <li><i class="fas fa-calendar-check"></i> Ce processus peut prendre jusqu'à 24 heures ouvrables</li>
                      <li><i class="fas fa-envelope"></i> Vous serez notifié par email une fois votre compte activé</li>
                    </ul>
                  </div>
                  
                  <div class="contact-section">
                    <p><strong>Pour toute question, contactez notre équipe support :</strong></p>
                    <p><i class="fas fa-envelope"></i> support@company.com</p>
                    <p><i class="fas fa-phone"></i> +216 71 123 456</p>
                  </div>
                </div>
              `,
              imageUrl: 'assets/img/waiting-approval.svg',
              imageWidth: 120,
              imageHeight: 120,
              imageAlt: 'Compte en attente',
              showConfirmButton: true,
              confirmButtonText: '<i class="fas fa-check"></i> Compris',
              confirmButtonColor: '#3b82f6',
              showClass: {
                popup: 'animate__animated animate__fadeIn'
              },
              hideClass: {
                popup: 'animate__animated animate__fadeOut'
              },
              allowOutsideClick: false,
              customClass: {
                title: 'swal-title',
                htmlContainer: 'swal-html-container',
                confirmButton: 'swal-confirm-button',
                image: 'swal-image'
              }
            }).then((result) => {
              // Rediriger vers la page d'attente d'activation
              this.router.navigate(['/auth/inactive-account']);
            });
            
            return;
          }
          
          // Si l'erreur contient "mot de passe", mettre en évidence le champ de mot de passe
          if (this.errorMessage && this.errorMessage.toLowerCase().includes('mot de passe')) {
            this.loginForm.get('password')?.setErrors({incorrect: true});
          }
          
          // Si l'erreur contient "utilisateur", mettre en évidence le champ d'utilisateur
          if (this.errorMessage && this.errorMessage.toLowerCase().includes('utilisateur')) {
            this.loginForm.get('usernameOrEmail')?.setErrors({incorrect: true});
          } else if (!this.errorMessage) {
            // Message par défaut si aucun message spécifique n'est disponible
            this.errorMessage = 'Une erreur s\'est produite lors de la connexion. Veuillez réessayer.';
          }
        }
      });
  }

  // Déterminer l'URL de redirection par défaut en fonction du rôle
  private getDefaultRedirectUrl(): string {
    // Vérifier si l'utilisateur est connecté
    if (!this.authService.isLoggedIn()) {
      console.log('Utilisateur non connecté, redirection vers login');
      return '/auth/login';
    }
    
    // Récupérer l'utilisateur actuel et ses rôles
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      console.log('Aucun utilisateur trouvé, redirection vers login');
      return '/auth/login';
    }
    
    // Vérifier si l'utilisateur est actif - pour TOUS les utilisateurs
    if (currentUser.active === false) {
      console.log('Utilisateur inactif, redirection vers page d\'information');
      return '/auth/inactive-account';
    }
    
    // Si l'utilisateur n'a pas la propriété active explicitement définie à true, le considérer comme inactif
    if (currentUser.active !== true) {
      console.log('État d\'activation de l\'utilisateur non confirmé, redirection vers page d\'information');
      return '/auth/inactive-account';
    }
    
    // Vérifier les rôles avec la méthode hasRole qui normalise les rôles
    const hasAdminRole = this.authService.hasRole('ADMIN');
    const hasVendeurRole = this.authService.hasRole('VENDEUR');
    const hasClientRole = this.authService.hasRole('CLIENT');
    const hasFournisseurRole = this.authService.hasRole('FOURNISSEUR');
    const hasAchatRole = this.authService.hasRole('ACHAT');
    const hasMagasinierRole = this.authService.hasRole('MAGASINIER');
    
    // Afficher les rôles pour le débogage
    console.log('Décision de redirection basée sur les rôles:', {
      utilisateur: currentUser.username,
      rolesOriginaux: this.authService.getUserRoles(),
      rolesNormalises: this.authService.getUserRoles(true),
      estAdmin: hasAdminRole,
      estVendeur: hasVendeurRole,
      estClient: hasClientRole,
      estFournisseur: hasFournisseurRole,
      estAchat: hasAchatRole,
      estMagasinier: hasMagasinierRole
    });
    
    // Récupérer le rôle principal de l'utilisateur
    // Nous utilisons le paramètre de l'URL pour déterminer le rôle principal si présent
    const queryParams = this.route.snapshot.queryParams;
    const roleParam = queryParams['role'];
    
    // Si un rôle est spécifié dans l'URL et que l'utilisateur a ce rôle, l'utiliser
    if (roleParam) {
      const normalizedRoleParam = roleParam.toUpperCase();
      if (this.authService.hasRole(normalizedRoleParam)) {
        console.log(`Redirection basée sur le paramètre de rôle: ${normalizedRoleParam}`);
        return this.getUrlForRole(normalizedRoleParam);
      }
    }
    
    // Vérifier si l'utilisateur a un double rôle (vendeur et magasinier)
    if (hasVendeurRole && hasMagasinierRole) {
      // Le vendeur est prioritaire, donc rediriger vers l'espace POS
      console.log('Utilisateur avec double rôle (vendeur + magasinier), redirection vers POS');
      return '/caisse/pos';
    }
    
    // Prioriser le rôle ADMIN sur les autres rôles
    if (hasAdminRole) {
      console.log('Redirection vers dashboard ADMIN');
      return '/admin/dashboard';
    } else if (hasVendeurRole) {
      console.log('Redirection vers dashboard VENDEUR');
      return '/vendor-dashboard';
    } else if (hasFournisseurRole) {
      console.log('Redirection vers interface FOURNISSEUR');
      return '/fournisseur/commandes';
    } else if (hasAchatRole) {
      console.log('Redirection vers module ACHAT');
      return '/achat/commandes';
    } else if (hasMagasinierRole) {
      console.log('Redirection vers dashboard MAGASINIER');
      return '/stock/dashboard';
    } else if (hasClientRole) {
      console.log('Redirection vers interface ACHETEUR (rôle CLIENT)');
      return '/acheteur/dashboard';
    } else {
      console.log('Aucun rôle reconnu, redirection vers CAISSE (par défaut)');
      return '/caisse';
    }
  }
  
  // Obtenir l'URL correspondant à un rôle spécifique
  private getUrlForRole(role: string): string {
    const normalizedRole = role.toUpperCase();
    
    switch (normalizedRole) {
      case 'ADMIN':
        return '/admin/dashboard';
      case 'VENDEUR':
        return '/vendor-dashboard'; // Redirection des vendeurs vers le nouveau dashboard
      case 'FOURNISSEUR':
        return '/fournisseur/commandes';
      case 'ACHAT':
        return '/achat/commandes';
      case 'MAGASINIER':
        return '/stock/dashboard';
      case 'CLIENT':
        return '/acheteur/dashboard';
      default:
        return '/caisse';
    }
  }
}
