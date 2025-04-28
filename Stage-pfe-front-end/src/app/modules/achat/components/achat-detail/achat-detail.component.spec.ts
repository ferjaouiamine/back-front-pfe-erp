import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AchatDetailComponent } from './achat-detail.component';

describe('AchatDetailComponent', () => {
  let component: AchatDetailComponent;
  let fixture: ComponentFixture<AchatDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AchatDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AchatDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
