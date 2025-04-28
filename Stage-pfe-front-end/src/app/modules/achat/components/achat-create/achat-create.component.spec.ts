import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AchatCreateComponent } from './achat-create.component';

describe('AchatCreateComponent', () => {
  let component: AchatCreateComponent;
  let fixture: ComponentFixture<AchatCreateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AchatCreateComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AchatCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
