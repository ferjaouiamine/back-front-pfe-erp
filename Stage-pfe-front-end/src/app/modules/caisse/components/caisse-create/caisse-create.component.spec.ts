import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CaisseCreateComponent } from './caisse-create.component';

describe('CaisseCreateComponent', () => {
  let component: CaisseCreateComponent;
  let fixture: ComponentFixture<CaisseCreateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CaisseCreateComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CaisseCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
