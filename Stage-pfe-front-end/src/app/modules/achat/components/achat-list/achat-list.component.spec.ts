import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AchatListComponent } from './achat-list.component';

describe('AchatListComponent', () => {
  let component: AchatListComponent;
  let fixture: ComponentFixture<AchatListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AchatListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AchatListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
