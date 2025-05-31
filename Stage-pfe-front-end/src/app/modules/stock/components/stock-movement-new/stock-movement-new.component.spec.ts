import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StockMovementNewComponent } from './stock-movement-new.component';

describe('StockMovementNewComponent', () => {
  let component: StockMovementNewComponent;
  let fixture: ComponentFixture<StockMovementNewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StockMovementNewComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(StockMovementNewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
