import { NgModule, NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

// Material Imports
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';

// Routing
import { FournisseurRoutingModule } from './fournisseur-routing.module';

// Components
import { FournisseurDashboardComponent } from './components/fournisseur-dashboard/fournisseur-dashboard.component';
import { CommandeListComponent } from './components/commande-list/commande-list.component';
import { CommandeDetailComponent } from './components/commande-detail/commande-detail.component';
import { ProfilFournisseurComponent } from './components/profil-fournisseur/profil-fournisseur.component';
import { FournisseurLayoutComponent } from './components/fournisseur-layout/fournisseur-layout.component';
import { PaiementListComponent } from './components/paiement-list/paiement-list.component';
import { PaiementDialogComponent } from './components/paiement-dialog/paiement-dialog.component';
import { NotificationsComponent } from './components/notifications/notifications.component';
import { AvisExpeditionComponent } from './components/avis-expedition/avis-expedition.component';
import { FactureListComponent } from './components/facture-list/facture-list.component';
import { FactureFormComponent } from './components/facture-form/facture-form.component';
import { ProduitListComponent } from './components/produit-list/produit-list.component';
import { PdfGeneratorComponent } from './components/pdf-generator/pdf-generator.component';

// Services
import { FournisseurService } from './services/fournisseur.service';
import { PdfService } from './services/pdf.service';

@NgModule({
  declarations: [
    FournisseurDashboardComponent,
    CommandeListComponent,
    CommandeDetailComponent,
    ProfilFournisseurComponent,
    FournisseurLayoutComponent,
    PaiementListComponent,
    PaiementDialogComponent,
    NotificationsComponent,
    AvisExpeditionComponent,
    FactureListComponent,
    FactureFormComponent,
    ProduitListComponent,
    PdfGeneratorComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,
    FournisseurRoutingModule,
    // Material Modules
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule,
    MatExpansionModule,
    MatSlideToggleModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  providers: [
    FournisseurService,
    PdfService
  ],
  schemas: [NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA]
})
export class FournisseurModule { }
