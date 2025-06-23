import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { routes } from '../../helpers/routes';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root',
})
export class SidebarService {
  // Variables pour contrôle d'affichage de la sidebar
  public sideBarPosition = new BehaviorSubject<string>('side_menu');
  public toggleMobileSideBar = new BehaviorSubject<boolean>(false);
  public expandSideBar = new BehaviorSubject<boolean>(false);
  public collapse$ = new BehaviorSubject<boolean>(false);

  public sidebarData1: any[] = [];
  public sidebarData2: any[] = [];
  public sidebarData3: any[] = [];

  // Structure pour videocall
  public videocall = [
    {
      img: 'assets/img/users/user-01.jpg',
      name: 'Barbara',
    },
    {
      img: 'assets/img/users/user-02.jpg',
      name: 'Linnea',
    },
    {
      img: 'assets/img/users/user-05.jpg',
      name: 'Richard',
    },
    {
      img: 'assets/img/users/user-03.jpg',
      name: 'Freda',
    },
  ];

  // Structure pour settings_sidebar
  public settings_sidebar = [
    {
      icon: 'feather icon-settings',
      title: 'General Settings',
      page: 'general-settings',
      subMenu: [
        { title: 'Profile', routes: routes.generalSettings },
        { title: 'Security', routes: routes.securitySettings },
        { title: 'Notifications', routes: routes.settingsNotification },
        { title: 'Connected Apps', routes: routes.connectedApps },
      ],
    },
    {
      icon: 'feather icon-airplay',
      title: 'Website Settings',
      page: 'website-settings',
      subMenu: [
        { title: 'System Settings', routes: routes.systemSettings },
        { title: 'Company Settings', routes: routes.companySettings },
        { title: 'Localization', routes: routes.localizationSettings },
        { title: 'Prefixes', routes: routes.prefixes },
        { title: 'Preference', routes: routes.preference },
        { title: 'Appearance', routes: routes.appearance },
        {
          title: 'Social Authentication',
          routes: routes.socialAuthentication,
        },
        { title: 'Language', routes: routes.languageSettings },
      ],
    },
    {
      icon: 'feather icon-archive',
      title: 'App Settings',
      page: 'app-settings',
      subMenu: [
        { title: 'Invoice', routes: routes.invoiceSettings },
        { title: 'Printer', routes: routes.printerSettings },
        { title: 'POS', routes: routes.posSettings },
        { title: 'Custom Fields', routes: routes.customFields },
      ],
    },
    {
      icon: 'feather icon-server',
      title: 'System Settings',
      page: 'system-settings',
      subMenu: [
        { title: 'Email', routes: routes.emailSettings },
        { title: 'SMS Gateways', routes: routes.smsGateway },
        { title: 'OTP', routes: routes.otpSettings },
        { title: 'GDPR Cookies', routes: routes.gdprSettings },
      ],
    },
    {
      icon: 'feather icon-credit-card',
      title: 'Financial Settings',
      page: 'financial-settings',
      subMenu: [
        { title: 'Payment Gateway', routes: routes.paymentGatewaySettings },
        { title: 'Bank Accounts', routes: routes.bankSettingsGrid },
        { title: 'Tax Rates', routes: routes.taxRates },
        { title: 'Currencies', routes: routes.currencySettings },
      ],
    },
    {
      icon: 'feather icon-layout',
      title: 'Other Settings',
      page: 'other-settings',
      subMenu: [
        { title: 'Storage', routes: routes.storageSettings },
        { title: 'Ban IP Address', routes: routes.banIpAddress },
      ],
    },
  ];

  constructor(private authService: AuthService) {
    // Réinitialiser les menus quand le statut de connexion change
    this.authService.currentUser.subscribe(() => {
      this.initSidebarData();
    });
    
    // Initialiser les menus au démarrage
    this.initSidebarData();
  }
  
  // Méthode pour basculer la position du menu latéral
  public switchSideMenuPosition() {
    if (this.sideBarPosition.value === 'side_menu') {
      this.sideBarPosition.next('dual_menu');
    } else if (this.sideBarPosition.value === 'dual_menu') {
      this.sideBarPosition.next('icon_menu');
    } else if (this.sideBarPosition.value === 'icon_menu') {
      this.sideBarPosition.next('side_menu');
    }
  }

  // Méthode pour basculer la position du menu mobile
  public switchMobileSideBarPosition() {
    this.toggleMobileSideBar.next(!this.toggleMobileSideBar.value);
  }

  // Méthode pour basculer l'état du collapse
  public toggleCollapse() {
    this.collapse$.next(!this.collapse$.value);
  }
  
  // Initialiser les données de la sidebar en fonction du rôle utilisateur
  private initSidebarData(): void {
    const menuItems = this.generateMenuItems();
    this.sidebarData1 = menuItems;
    this.sidebarData2 = menuItems;
    this.sidebarData3 = menuItems;
  }

  // Générer les éléments du menu en fonction du rôle utilisateur
  private generateMenuItems(): any[] {
    const isLoggedIn = this.authService.isLoggedIn();
    const isAdmin = this.authService.isAdmin();
    const menuItems = [];
    
    // Menu principal disponible pour les administrateurs uniquement
    if (isAdmin) {
      const mainMenu = {
        tittle: 'Main',
        showAsTab: true,
        separateRoute: false,
        menu: [
          {
            menuValue: 'Admin Dashboard',
            hasSubRoute: false,
            showSubRoute: false,
            icon: 'home',
            route: routes.adminDashboard,
            subRoutes: [],
          },
          {
            menuValue: 'Sales Dashboard',
            hasSubRoute: false,
            showSubRoute: false,
            icon: 'shopping-bag',
            route: routes.salesDashboard,
            subRoutes: [],
          }
        ]
      };
      
      menuItems.push(mainMenu);
      
      // User Management, uniquement pour les admins
      const userManagementMenu = {
        tittle: 'User Management',
        showAsTab: true,
        separateRoute: false,
        menu: [
          {
            menuValue: 'Users',
            hasSubRoute: false,
            showSubRoute: false,
            icon: 'user-check',
            route: routes.people,
            subRoutes: [],
          },
          {
            menuValue: 'Roles & Permissions',
            hasSubRoute: false,
            showSubRoute: false,
            icon: 'shield',
            route: routes.rolesPermission,
            subRoutes: [],
          }
        ]
      };
      
      menuItems.push(userManagementMenu);
    }
    
    // Pages, disponible pour tous les utilisateurs connectés
    if (isLoggedIn) {
      const pagesMenu = {
        tittle: 'Pages',
        showAsTab: true,
        separateRoute: false,
        menu: [
          {
            menuValue: 'Profile',
            hasSubRoute: false,
            showSubRoute: false,
            icon: 'user',
            route: routes.profile,
            subRoutes: [],
          }
        ]
      };
      
      menuItems.push(pagesMenu);
    }
    
    return menuItems;
  }
}
