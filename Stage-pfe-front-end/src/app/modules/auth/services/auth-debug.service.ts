import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthDebugService {
  private apiUrl = `${environment.apiUrl}/auth/debug`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  /**
   * Récupère les informations sur les rôles des utilisateurs
   */
  getUserRoles(): Observable<any> {
    const token = this.authService.getToken();
    console.log('Token JWT récupéré:', token);
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    console.log('Headers envoyés:', headers);
    console.log('URL appelée:', `${this.apiUrl}/user-roles`);
    
    return this.http.get(`${this.apiUrl}/user-roles`, { headers });
  }

  /**
   * Teste l'authentification de l'utilisateur courant
   */
  testAuth(): Observable<any> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    
    return this.http.get(`${this.apiUrl}/auth-test`, { headers });
  }

  /**
   * Teste l'accès avec le rôle ADMIN
   */
  testAdminAccess(): Observable<any> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    
    return this.http.get(`${this.apiUrl}/admin-test`, { headers });
  }

  /**
   * Teste l'accès avec l'autorité ROLE_ADMIN
   */
  testAdminAuthorityAccess(): Observable<any> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    
    return this.http.get(`${this.apiUrl}/admin-authority-test`, { headers });
  }
}
