import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ConfirmDialogComponent
  ],
  exports: [
    ConfirmDialogComponent
  ]
})
export class SharedModule { }
