import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { AccessDeniedComponent } from './components/access-denied.component';

const routes: Routes = [
  { path: '', component: AccessDeniedComponent }
];

@NgModule({
  declarations: [
    AccessDeniedComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
  ]
})
export class AccessDeniedModule { }
