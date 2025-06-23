import { Component, ChangeDetectorRef } from '@angular/core';
import {
  NavigationEnd,
  NavigationStart,
  Router,
  Event as RouterEvent,
} from '@angular/router';
import { SpinnerService } from './core/core.index';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'template';
  public page = '';

  constructor(
    private router: Router, 
    private spinner: SpinnerService,
    private cdr: ChangeDetectorRef
  ) {
    // Une seule souscription pour gérer à la fois la page et le spinner
    this.router.events.subscribe((event: RouterEvent) => {
      if (event instanceof NavigationStart) {
        // Extraire le segment de route pour le titre
        const URL = event.url.split('/');
        // Si on navigue vers auth/signin, on utilise signin comme titre de page
        if (URL[1] === 'auth') {
          this.page = URL[2] || URL[1];
        } else {
          this.page = URL[1];
        }
        
        this.spinner.show();
      }
      
      if (event instanceof NavigationEnd) {
        this.spinner.hide();
        // Forcer la détection de changements après la navigation
        // Cela résout le problème ExpressionChangedAfterItHasBeenCheckedError
        this.cdr.detectChanges();
      }
    });
  
  }
}
