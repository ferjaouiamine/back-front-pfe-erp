import { Component, OnInit } from '@angular/core';
import { AuthDebugService } from '../../services/auth-debug.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth-debug',
  templateUrl: './auth-debug.component.html',
  styleUrls: ['./auth-debug.component.scss']
})
export class AuthDebugComponent implements OnInit {
  userRoles: any[] = [];
  authTest: any = null;
  adminTest: any = null;
  adminAuthorityTest: any = null;
  
  isLoading = false;
  errorMessage: string | null = null;
  
  constructor(
    private authDebugService: AuthDebugService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.loadUserRoles();
  }
  
  loadUserRoles(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    this.authDebugService.getUserRoles().subscribe({
      next: (data) => {
        this.userRoles = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors de la récupération des rôles:', error);
        this.errorMessage = `Erreur lors de la récupération des rôles: ${error.message}`;
        this.isLoading = false;
      }
    });
  }
  
  testAuth(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    this.authDebugService.testAuth().subscribe({
      next: (data) => {
        this.authTest = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du test d\'authentification:', error);
        this.errorMessage = `Erreur lors du test d'authentification: ${error.message}`;
        this.isLoading = false;
      }
    });
  }
  
  testAdminAccess(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    this.authDebugService.testAdminAccess().subscribe({
      next: (data) => {
        this.adminTest = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du test d\'accès admin:', error);
        this.errorMessage = `Erreur lors du test d'accès admin: ${error.message}`;
        this.isLoading = false;
        this.adminTest = { error: error.status, message: error.error?.message || error.statusText };
      }
    });
  }
  
  testAdminAuthorityAccess(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    this.authDebugService.testAdminAuthorityAccess().subscribe({
      next: (data) => {
        this.adminAuthorityTest = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du test d\'accès avec autorité admin:', error);
        this.errorMessage = `Erreur lors du test d'accès avec autorité admin: ${error.message}`;
        this.isLoading = false;
        this.adminAuthorityTest = { error: error.status, message: error.error?.message || error.statusText };
      }
    });
  }
  
  getCurrentUserInfo(): any {
    return {
      username: this.authService.getCurrentUser()?.username,
      roles: this.authService.getUserRoles(),
      normalizedRoles: this.authService.getUserRoles(true),
      token: this.authService.getToken()
    };
  }
}
