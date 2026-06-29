// Mock database for demo mode - intercepts queries and returns fake data
// @ts-nocheck — Mock file, strict typing not required here
import { QueryResult } from 'pg';

const mockUsers = {
  'admin@storebox.app': {
    id: 1,
    code: 'ADM001',
    email: 'admin@storebox.app',
    nom: 'Admin',
    prenom: 'SystÃ¨me',
    telephone: '+22507000001',
    password_hash: '$2b$10$AbWmryQEkgfcRDnCoEigDu2hTLxZYiFmQ/wZNnqwNqQtuR7chPeKq', // Storebox@123
    role_code: 'admin',
    role_libelle: 'Administrateur',
    permissions: JSON.stringify({ all: true }),
    actif: true,
    is_super_admin: true,
    tentatives_echec: 0,
    bloque_jusqu: null,
    magasin_ids: [],
    magasin_noms: []
  },
  'commercial@storebox.app': {
    id: 2,
    code: 'COM001',
    email: 'commercial@storebox.app',
    nom: 'Dupont',
    prenom: 'Jean',
    telephone: '+22507000002',
    password_hash: '$2b$10$AbWmryQEkgfcRDnCoEigDu2hTLxZYiFmQ/wZNnqwNqQtuR7chPeKq',
    role_code: 'commercial',
    role_libelle: 'Commercial',
    permissions: JSON.stringify({ ventes: true, clients: true, produits: 'read', paiements: true }),
    actif: true,
    is_super_admin: false,
    tentatives_echec: 0,
    bloque_jusqu: null,
    magasin_ids: [1],
    magasin_noms: ['Magasin Principal']
  },
  'caisse@storebox.app': {
    id: 3,
    code: 'CAI001',
    email: 'caisse@storebox.app',
    nom: 'Martin',
    prenom: 'Sophie',
    telephone: '+22507000003',
    password_hash: '$2b$10$AbWmryQEkgfcRDnCoEigDu2hTLxZYiFmQ/wZNnqwNqQtuR7chPeKq',
    role_code: 'caissier',
    role_libelle: 'Caissier',
    permissions: JSON.stringify({ ventes: 'read', paiements: true }),
    actif: true,
    is_super_admin: false,
    tentatives_echec: 0,
    bloque_jusqu: null,
    magasin_ids: [1],
    magasin_noms: ['Magasin Principal']
  },
  'compta@storebox.app': {
    id: 4,
    code: 'COM002',
    email: 'compta@storebox.app',
    nom: 'Bernard',
    prenom: 'Marie',
    telephone: '+22507000004',
    password_hash: '$2b$10$AbWmryQEkgfcRDnCoEigDu2hTLxZYiFmQ/wZNnqwNqQtuR7chPeKq',
    role_code: 'comptable',
    role_libelle: 'Comptable',
    permissions: JSON.stringify({ ventes: 'read', creances: 'read', dettes: 'read', rapports: 'read', dashboard: 'read' }),
    actif: true,
    is_super_admin: false,
    tentatives_echec: 0,
    bloque_jusqu: null,
    magasin_ids: [1],
    magasin_noms: ['Magasin Principal']
  },
  'stock@storebox.app': {
    id: 5,
    code: 'STK001',
    email: 'stock@storebox.app',
    nom: 'Richard',
    prenom: 'Pierre',
    telephone: '+22507000005',
    password_hash: '$2b$10$AbWmryQEkgfcRDnCoEigDu2hTLxZYiFmQ/wZNnqwNqQtuR7chPeKq',
    role_code: 'magasinier',
    role_libelle: 'Magasinier',
    permissions: JSON.stringify({ produits: 'read', paiements: 'read' }),
    actif: true,
    is_super_admin: false,
    tentatives_echec: 0,
    bloque_jusqu: null,
    magasin_ids: [1],
    magasin_noms: ['Magasin Principal']
  }
};

const mockSessions: Map<string, any> = new Map();

// Dynamic storage for created entities (persists during session)
const dynamicClients: any[] = [];
const dynamicProduits: any[] = [];
const dynamicFournisseurs: any[] = [];
const dynamicMagasins: any[] = [];
const dynamicUtilisateurs: any[] = [];
const dynamicVentes: any[] = [];
const dynamicAchats: any[] = [];
const dynamicDevis: any[] = [];
const dynamicDepenses: any[] = [];
const dynamicBonsCommande: any[] = [];
const dynamicRetours: any[] = [];
const dynamicTransferts: any[] = [];
const dynamicPaiements: any[] = [];
let nextClientId = 6;
let nextProduitId = 5;
let nextFournisseurId = 3;
let nextMagasinId = 4;
let nextUtilisateurId = 6;
let nextVenteId = 7;
let nextAchatId = 3;
let nextDevisId = 1;
let nextDepenseId = 1;
let nextBonCommandeId = 1;
let nextRetourId = 1;
let nextTransfertId = 1;
let nextPaiementId = 100;

// Multi-store mock data
const mockMagasins = [
  { id: 1, code: 'MAG001', nom: 'Magasin Principal', ville: 'Abidjan', adresse: '123 Rue du Commerce', actif: true },
  { id: 2, code: 'MAG002', nom: 'Magasin Port-Bouet', ville: 'Port-Bouet', adresse: '456 Avenue du Port', actif: true },
  { id: 3, code: 'MAG003', nom: 'Magasin Cocody', ville: 'Cocody', adresse: '789 Boulevard de Cocody', actif: true },
];

const mockProduitsDetailles = [
  // Magasin 1 - Magasin Principal (25, 18, 40, 60)
  { id: 1, reference: 'APL-IP15P', designation: 'iPhone 15 Pro', marque: 'Apple', categorie: 'TÃ©lÃ©phones', prix_achat: '450000', prix_gros: '550000', prix_detail: '650000', magasin_id: 1, quantite: 25, alerte_stock: 5 },
  { id: 2, reference: 'SAM-S24', designation: 'Samsung Galaxy S24', marque: 'Samsung', categorie: 'TÃ©lÃ©phones', prix_achat: '400000', prix_gros: '480000', prix_detail: '580000', magasin_id: 1, quantite: 18, alerte_stock: 5 },
  { id: 3, reference: 'XIA-14', designation: 'Xiaomi 14', marque: 'Xiaomi', categorie: 'TÃ©lÃ©phones', prix_achat: '250000', prix_gros: '320000', prix_detail: '400000', magasin_id: 1, quantite: 40, alerte_stock: 10 },
  { id: 4, reference: 'APL-AP3', designation: 'AirPods Pro', marque: 'Apple', categorie: 'Accessoires', prix_achat: '80000', prix_gros: '95000', prix_detail: '120000', magasin_id: 1, quantite: 60, alerte_stock: 20 },
  // Magasin 2 - Magasin Port-Bouet (30, 22, 35, 45)
  { id: 1, reference: 'APL-IP15P', designation: 'iPhone 15 Pro', marque: 'Apple', categorie: 'TÃ©lÃ©phones', prix_achat: '450000', prix_gros: '550000', prix_detail: '650000', magasin_id: 2, quantite: 30, alerte_stock: 5 },
  { id: 2, reference: 'SAM-S24', designation: 'Samsung Galaxy S24', marque: 'Samsung', categorie: 'TÃ©lÃ©phones', prix_achat: '400000', prix_gros: '480000', prix_detail: '580000', magasin_id: 2, quantite: 22, alerte_stock: 5 },
  { id: 3, reference: 'XIA-14', designation: 'Xiaomi 14', marque: 'Xiaomi', categorie: 'TÃ©lÃ©phones', prix_achat: '250000', prix_gros: '320000', prix_detail: '400000', magasin_id: 2, quantite: 35, alerte_stock: 10 },
  { id: 4, reference: 'APL-AP3', designation: 'AirPods Pro', marque: 'Apple', categorie: 'Accessoires', prix_achat: '80000', prix_gros: '95000', prix_detail: '120000', magasin_id: 2, quantite: 45, alerte_stock: 20 },
  // Magasin 3 - Magasin Cocody (15, 12, 28, 38)
  { id: 1, reference: 'APL-IP15P', designation: 'iPhone 15 Pro', marque: 'Apple', categorie: 'TÃ©lÃ©phones', prix_achat: '450000', prix_gros: '550000', prix_detail: '650000', magasin_id: 3, quantite: 15, alerte_stock: 5 },
  { id: 2, reference: 'SAM-S24', designation: 'Samsung Galaxy S24', marque: 'Samsung', categorie: 'TÃ©lÃ©phones', prix_achat: '400000', prix_gros: '480000', prix_detail: '580000', magasin_id: 3, quantite: 12, alerte_stock: 5 },
  { id: 3, reference: 'XIA-14', designation: 'Xiaomi 14', marque: 'Xiaomi', categorie: 'TÃ©lÃ©phones', prix_achat: '250000', prix_gros: '320000', prix_detail: '400000', magasin_id: 3, quantite: 28, alerte_stock: 10 },
  { id: 4, reference: 'APL-AP3', designation: 'AirPods Pro', marque: 'Apple', categorie: 'Accessoires', prix_achat: '80000', prix_gros: '95000', prix_detail: '120000', magasin_id: 3, quantite: 38, alerte_stock: 20 },
];

const mockClientsDetailles = [
  { id: 1, code: 'CLT001', raison_sociale: 'Bouticom Abidjan', type_client: 'gros', contact_nom: 'Jean KouamÃ©', telephone: '+22507001111', email: 'contact@bouticom.ci', ville: 'Abidjan', magasin_id: 1, plafond_credit: '5000000', solde_restant: '1200000' },
  { id: 2, code: 'CLT002', raison_sociale: 'Telephones Plus', type_client: 'gros', contact_nom: 'Marie Diallo', telephone: '+22507002222', email: 'marie@tphones.ci', ville: 'Abidjan', magasin_id: 1, plafond_credit: '3000000', solde_restant: '800000' },
  { id: 3, code: 'CLT003', raison_sociale: 'Boutique du Port', type_client: 'detail', contact_nom: 'Yves Anon', telephone: '+22507003333', email: 'yves@port.ci', ville: 'Port-Bouet', magasin_id: 2, plafond_credit: '500000', solde_restant: '150000' },
  { id: 4, code: 'CLT004', raison_sociale: 'Cocody Mobiles', type_client: 'gros', contact_nom: 'Ama Kouassi', telephone: '+22507004444', email: 'info@cocodymobiles.ci', ville: 'Cocody', magasin_id: 3, plafond_credit: '2500000', solde_restant: '600000' },
  { id: 5, code: 'CLT005', raison_sociale: 'Express Phones', type_client: 'detail', contact_nom: 'Kofi Mensah', telephone: '+22507005555', email: 'kofi@express.ci', ville: 'Port-Bouet', magasin_id: 2, plafond_credit: '400000', solde_restant: '100000' },
];

const mockVentesDetailles = [
  // Magasin 1
  { id: 1, date_vente: '2026-05-01', type_vente: 'gros', client_id: 1, client_nom: 'Bouticom', magasin_id: 1, total_ttc: '2500000', statut: 'payÃ©e', solde_restant: '0' },
  { id: 2, date_vente: '2026-04-28', type_vente: 'detail', client_id: 3, client_nom: 'Boutique du Port', magasin_id: 1, total_ttc: '450000', statut: 'partiellement', solde_restant: '150000' },
  { id: 3, date_vente: '2026-04-25', type_vente: 'gros', client_id: 2, client_nom: 'Telephones Plus', magasin_id: 1, total_ttc: '1800000', statut: 'impayÃ©e', solde_restant: '1800000' },
  // Magasin 2
  { id: 4, date_vente: '2026-05-02', type_vente: 'gros', client_id: 4, client_nom: 'Cocody Mobiles', magasin_id: 2, total_ttc: '3200000', statut: 'payÃ©e', solde_restant: '0' },
  { id: 5, date_vente: '2026-04-29', type_vente: 'detail', client_id: 5, client_nom: 'Express Phones', magasin_id: 2, total_ttc: '520000', statut: 'partiellement', solde_restant: '100000' },
  // Magasin 3
  { id: 6, date_vente: '2026-05-01', type_vente: 'detail', client_id: 4, client_nom: 'Cocody Mobiles', magasin_id: 3, total_ttc: '650000', statut: 'payÃ©e', solde_restant: '0' },
];

export const mockDb = {
  query: async <T extends Record<string, any> = Record<string, any>>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> => {
    // Mock auth login query (stored procedure)
    if (text.includes('sp_auth_login')) {
      const email = params?.[0] as string;
      if (!email) return { rows: [], rowCount: 0, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;

      const user = mockUsers[email.toLowerCase() as keyof typeof mockUsers];
      if (user) {
        return {
          rows: [{
            ...user,
            permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions,
          }],
          rowCount: 1,
          command: 'SELECT',
          fields: [],
          oid: 0,
        } as QueryResult<T>;
      }
      return { rows: [], rowCount: 0, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock /auth/me query (fetch user full profile) â€” has WHERE clause (not admin panel listing)
    if (text.includes('utilisateurs') && text.includes('roles') && text.includes('v_utilisateurs_magasins') && text.includes('WHERE')) {
      const userId = params?.[0] as number;
      const user = mockUsers[`admin@storebox.app` as keyof typeof mockUsers]; // Return admin for demo
      if (user) {
        return {
          rows: [{
            id: user.id,
            code: user.code,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            telephone: user.telephone,
            derniere_cnx: null,
            magasin_ids: user.magasin_ids,
            magasin_noms: user.magasin_noms,
            role: user.role_code,
            role_libelle: user.role_libelle,
            permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions,
          }],
          rowCount: 1,
          command: 'SELECT',
          fields: [],
          oid: 0,
        } as QueryResult<T>;
      }
      return { rows: [], rowCount: 0, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock session save
    if (text.includes('INSERT INTO sessions')) {
      const jti = params?.[1];
      mockSessions.set(jti as string, { user_id: params?.[0], expires_at: params?.[4] });
      return { rows: [{}], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock user update (tentatives, blocage, derniere_cnx)
    if (text.includes('UPDATE utilisateurs')) {
      return { rows: [{}], rowCount: 1, command: 'UPDATE', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock audit logs
    if (text.includes('INSERT INTO audit_logs')) {
      return { rows: [{}], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock session validation
    if (text.includes('SELECT') && text.includes('sessions') && text.includes('WHERE')) {
      const jti = params?.[0] as string;
      const session = mockSessions.get(jti);
      if (session) {
        // Check if session hasn't expired
        const expiresAt = new Date(session.expires_at);
        const now = new Date();
        if (expiresAt.getTime() > now.getTime()) {
          return { rows: [{ id: 1 }], rowCount: 1, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
        }
      }
      return { rows: [], rowCount: 0, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock dashboard - CA and ventes count
    if (text.includes('SELECT') && text.includes('ventes') && text.includes('ca_mois') && text.includes('nb_ventes')) {
      const magasinId = params?.[0] as number | null;
      let ventes = mockVentesDetailles;
      if (magasinId) {
        ventes = ventes.filter(v => v.magasin_id === magasinId);
      }
      const ca_mois = ventes.reduce((sum, v) => sum + parseInt(v.total_ttc as unknown as string), 0);
      return {
        rows: [{ ca_mois: ca_mois.toString(), nb_ventes: ventes.length.toString() }],
        rowCount: 1,
        command: 'SELECT',
        fields: [],
        oid: 0,
      } as QueryResult<T>;
    }

    // Mock dashboard - creances
    if (text.includes('v_creances_clients')) {
      const magasinId = params?.[0] as number | null;
      let clients = mockClientsDetailles;
      if (magasinId) {
        clients = clients.filter(c => c.magasin_id === magasinId);
      }
      const total = clients.reduce((sum, c) => sum + parseInt(c.solde_restant as unknown as string), 0);
      const en_retard = Math.floor(total * 0.32);
      return {
        rows: [{ total: total.toString(), en_retard: en_retard.toString() }],
        rowCount: 1,
        command: 'SELECT',
        fields: [],
        oid: 0,
      } as QueryResult<T>;
    }

    // Mock dashboard - dettes
    if (text.includes('v_dettes_fournisseurs')) {
      return {
        rows: [{ total: '1200000', urgent: '300000' }],
        rowCount: 1,
        command: 'SELECT',
        fields: [],
        oid: 0,
      } as QueryResult<T>;
    }

    // Mock dashboard - paiements/tresorerie
    if (text.includes('paiements') && text.includes('entrees')) {
      const magasinId = params?.[0] as number | null;
      let ventes = mockVentesDetailles;
      if (magasinId) {
        ventes = ventes.filter(v => v.magasin_id === magasinId);
      }
      const entrees = ventes.reduce((sum, v) => sum + parseInt(v.total_ttc as unknown as string), 0);
      const sorties = Math.floor(entrees * 0.61);
      return {
        rows: [{ entrees: entrees.toString(), sorties: sorties.toString() }],
        rowCount: 1,
        command: 'SELECT',
        fields: [],
        oid: 0,
      } as QueryResult<T>;
    }

    // Mock dashboard - stocks
    if (text.includes('v_stocks') && text.includes('ruptures')) {
      const magasinId = params?.[0] as number | null;
      let produits = mockProduitsDetailles;
      if (magasinId) {
        produits = produits.filter(p => p.magasin_id === magasinId);
      }
      const ruptures = produits.filter(p => parseInt(p.quantite as unknown as string) === 0).length;
      const alertes = produits.filter(p => parseInt(p.quantite as unknown as string) > 0 && parseInt(p.quantite as unknown as string) <= parseInt(p.alerte_stock as unknown as string)).length;
      return {
        rows: [{ ruptures: ruptures.toString(), alertes: alertes.toString() }],
        rowCount: 1,
        command: 'SELECT',
        fields: [],
        oid: 0,
      } as QueryResult<T>;
    }

    // Mock dashboard - top produits
    if (text.includes('ventes_lignes') && text.includes('qte_vendue') && text.includes('ca_genere')) {
      return {
        rows: [
          { designation: 'iPhone 15 Pro', reference: 'APL-IP15P', qte_vendue: '12', ca_genere: '6000000' },
          { designation: 'Samsung Galaxy S24', reference: 'SAM-S24', qte_vendue: '8', ca_genere: '4000000' },
          { designation: 'Xiaomi 14', reference: 'XIA-14', qte_vendue: '15', ca_genere: '3000000' },
          { designation: 'AirPods Pro', reference: 'APL-AP3', qte_vendue: '25', ca_genere: '2500000' },
          { designation: 'Samsung Charger', reference: 'ACC-CHRG', qte_vendue: '50', ca_genere: '500000' },
        ],
        rowCount: 5,
        command: 'SELECT',
        fields: [],
        oid: 0,
      } as QueryResult<T>;
    }

    // Mock dashboard - CA chart (6 months)
    if (text.includes('ventes') && text.includes('mois') && text.includes('gros') && text.includes('detail')) {
      return {
        rows: [
          { mois: 'Nov 25', gros: '3500000', detail: '2100000' },
          { mois: 'DÃ©c 25', gros: '4200000', detail: '3100000' },
          { mois: 'Jan 26', gros: '3800000', detail: '2500000' },
          { mois: 'FÃ©v 26', gros: '4100000', detail: '2900000' },
          { mois: 'Mar 26', gros: '4500000', detail: '3400000' },
          { mois: 'Avr 26', gros: '4900000', detail: '3500000' },
        ],
        rowCount: 6,
        command: 'SELECT',
        fields: [],
        oid: 0,
      } as QueryResult<T>;
    }

    // Mock ventes (sales) - MUST be specific to avoid matching clients queries with LEFT JOIN ventes
    if (text.toUpperCase().includes('FROM VENTES') && !text.toUpperCase().includes('FROM CLIENTS') && !text.includes('COALESCE(MAX')) {
      let filtered = [...mockVentesDetailles, ...dynamicVentes];
      // Only filter by magasin if the query explicitly has a magasin_id parameter
      if (text.includes('v.magasin_id=')) {
        const paramMatch = text.match(/v\.magasin_id=\$(\d+)/);
        if (paramMatch) {
          const magasinId = Number(params?.[Number(paramMatch[1]) - 1]);
          if (magasinId) filtered = filtered.filter(v => v.magasin_id === magasinId);
        }
      }
      return {
        rows: filtered,
        rowCount: filtered.length,
        command: 'SELECT',
        fields: [],
        oid: 0,
      } as QueryResult<T>;
    }

    // Mock achats (purchases) - MUST be before fournisseurs, include dynamic (exclude INSERT and MAX queries)
    if ((text.includes('FROM achats') || (text.includes('achats') && text.includes('date_achat'))) && !text.toUpperCase().startsWith('INSERT') && !text.includes('COALESCE(MAX')) {
      const staticAchats = [
        { id: 1, numero: 'ACH-0001', date_achat: '2026-04-20', fournisseur_id: 1, fournisseur_nom: 'Apple Distribution CI', total_ht: '1016949', tva_montant: '183051', total_ttc: '1200000', montant_paye: '1200000', solde_restant: '0', statut_paiement: 'paye', magasin_id: 1, magasin_nom: 'Magasin Principal' },
        { id: 2, numero: 'ACH-0002', date_achat: '2026-04-15', fournisseur_id: 2, fournisseur_nom: 'Samsung Benelux', total_ht: '677966', tva_montant: '122034', total_ttc: '800000', montant_paye: '500000', solde_restant: '300000', statut_paiement: 'partiel', magasin_id: 1, magasin_nom: 'Magasin Principal' },
      ];
      const allAchats = [...staticAchats, ...dynamicAchats];
      return { rows: allAchats, rowCount: allAchats.length, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock produits (products) - with brand and category info
    if (text.includes('FROM produits')) {
      const staticProduits = [
        { id: 1, reference: 'APL-IP15P', designation: 'iPhone 15 Pro', marque: 'Apple', marque_id: 1, marque_id_sel: 1, categorie: 'TÃ©lÃ©phones', categorie_id: 1, categorie_id_sel: 1, prix_achat: '450000', prix_gros: '550000', prix_detail: '650000', stock: 25, stock_alerte: 5, qte_min_gros: 5, stock_max: 500, actif: true, magasin_id: 1 },
        { id: 2, reference: 'SAM-S24', designation: 'Samsung Galaxy S24', marque: 'Samsung', marque_id: 2, marque_id_sel: 2, categorie: 'TÃ©lÃ©phones', categorie_id: 1, categorie_id_sel: 1, prix_achat: '400000', prix_gros: '480000', prix_detail: '580000', stock: 18, stock_alerte: 5, qte_min_gros: 5, stock_max: 500, actif: true, magasin_id: 1 },
        { id: 3, reference: 'XIA-14', designation: 'Xiaomi 14', marque: 'Xiaomi', marque_id: 3, marque_id_sel: 3, categorie: 'TÃ©lÃ©phones', categorie_id: 1, categorie_id_sel: 1, prix_achat: '250000', prix_gros: '320000', prix_detail: '400000', stock: 40, stock_alerte: 10, qte_min_gros: 5, stock_max: 500, actif: true, magasin_id: 1 },
        { id: 4, reference: 'APL-AP3', designation: 'AirPods Pro', marque: 'Apple', marque_id: 1, marque_id_sel: 1, categorie: 'Accessoires', categorie_id: 2, categorie_id_sel: 2, prix_achat: '80000', prix_gros: '95000', prix_detail: '120000', stock: 60, stock_alerte: 20, qte_min_gros: 1, stock_max: 500, actif: true, magasin_id: 1 },
      ];
      const allProduits = [...staticProduits, ...dynamicProduits];
      return {
        rows: allProduits,
        rowCount: allProduits.length,
        command: 'SELECT',
        fields: [],
        oid: 0,
      } as QueryResult<T>;
    }

    // â”€â”€â”€ TRANSACTION STUBS (BEGIN / COMMIT / ROLLBACK) â”€â”€â”€â”€â”€â”€
    if (/^\s*(BEGIN|COMMIT|ROLLBACK)\s*$/i.test(text)) {
      return { rows: [], rowCount: 0, command: text.trim().toUpperCase(), fields: [], oid: 0 } as QueryResult<T>;
    }

    // â”€â”€â”€ MAX ID helpers (used to generate sequential numbers) â”€â”€
    if (text.includes('COALESCE(MAX(id)') && text.includes('FROM ventes')) {
      return { rows: [{ max_id: String(nextVenteId - 1) }], rowCount: 1, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }
    if (text.includes('COALESCE(MAX(id)') && text.includes('FROM achats')) {
      return { rows: [{ max_id: String(nextAchatId - 1) }], rowCount: 1, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }
    if (text.includes('COALESCE(MAX(id)') && text.includes('FROM devis')) {
      return { rows: [{ max_id: String(nextDevisId) }], rowCount: 1, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }
    if (text.includes('COALESCE(MAX(id)') && text.includes('FROM bons_commande')) {
      return { rows: [{ max_id: String(nextBonCommandeId) }], rowCount: 1, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }
    if (text.includes('COALESCE(MAX(id)') && text.includes('FROM retours')) {
      return { rows: [{ max_id: String(nextRetourId) }], rowCount: 1, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // â”€â”€â”€ INSERT PRODUITS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (text.toUpperCase().includes('INSERT') && text.toUpperCase().includes('PRODUITS')) {
      const newProduit: any = {
        id: nextProduitId++,
        reference: String(params?.[0] ?? ''),
        designation: String(params?.[1] ?? ''),
        marque_id: params?.[2] ?? null,
        categorie_id: params?.[3] ?? null,
        marque: 'Marque', categorie: 'CatÃ©gorie',
        prix_achat: String(params?.[4] ?? '0'),
        prix_gros: String(params?.[5] ?? '0'),
        prix_detail: String(params?.[6] ?? '0'),
        qte_min_gros: Number(params?.[7] ?? 5),
        stock: Number(params?.[8] ?? 0),
        stock_alerte: Number(params?.[9] ?? 10),
        stock_max: Number(params?.[10] ?? 500),
        actif: true,
        magasin_id: 1,
        marque_id_sel: params?.[2] ?? null,
        categorie_id_sel: params?.[3] ?? null,
      };
      dynamicProduits.push(newProduit);
      return { rows: [newProduit], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // â”€â”€â”€ INSERT FOURNISSEURS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (text.toUpperCase().includes('INSERT') && text.toUpperCase().includes('FOURNISSEURS')) {
      const newFrn: any = {
        id: nextFournisseurId++,
        code: String(params?.[0] ?? ''),
        raison_sociale: String(params?.[1] ?? ''),
        contact_nom: params?.[2] ?? null,
        telephone: params?.[3] ?? null,
        email: params?.[4] ?? null,
        adresse: params?.[5] ?? null,
        pays: String(params?.[6] ?? "CÃ´te d'Ivoire"),
        delai_paiement: Number(params?.[7] ?? 30),
        conditions: params?.[8] ?? null,
        actif: true,
        total_achats: '0',
        encours_dette: '0',
      };
      dynamicFournisseurs.push(newFrn);
      return { rows: [newFrn], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // â”€â”€â”€ INSERT MAGASINS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (text.toUpperCase().includes('INSERT') && text.toUpperCase().includes('MAGASINS') && !text.toUpperCase().includes('UTILISATEURS_MAGASINS')) {
      const newMag: any = {
        id: nextMagasinId++,
        code: String(params?.[0] ?? ''),
        nom: String(params?.[1] ?? ''),
        adresse: params?.[2] ?? null,
        telephone: params?.[3] ?? null,
        email: params?.[4] ?? null,
        actif: true,
        nb_utilisateurs: 0,
        valeur_stock: '0',
      };
      dynamicMagasins.push(newMag);
      return { rows: [newMag], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // â”€â”€â”€ INSERT UTILISATEURS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (text.toUpperCase().includes('INSERT') && text.toUpperCase().includes('UTILISATEURS') && !text.toUpperCase().includes('UTILISATEURS_MAGASINS')) {
      const newUser: any = {
        id: nextUtilisateurId++,
        code: String(params?.[0] ?? ''),
        nom: String(params?.[1] ?? ''),
        prenom: String(params?.[2] ?? ''),
        email: String(params?.[3] ?? ''),
        telephone: params?.[4] ?? null,
        password_hash: String(params?.[5] ?? ''),
        role_id: Number(params?.[6] ?? 2),
        actif: true,
      };
      dynamicUtilisateurs.push(newUser);
      return { rows: [newUser], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // â”€â”€â”€ INSERT UTILISATEURS_MAGASINS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (text.toUpperCase().includes('INSERT') && text.toUpperCase().includes('UTILISATEURS_MAGASINS')) {
      return { rows: [], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // â”€â”€â”€ INSERT VENTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (text.toUpperCase().includes('INSERT') && text.toUpperCase().includes('VENTES') && !text.toUpperCase().includes('LIGNES')) {
      const id = nextVenteId++;
      const numero = `VNT-${String(id).padStart(4, '0')}`;
      const newVente: any = {
        id,
        numero,
        client_id: params?.[1] ?? null,
        type_vente: String(params?.[2] ?? 'detail'),
        date_vente: new Date().toISOString().split('T')[0],
        sous_total: Number(params?.[3] ?? 0),
        remise_pct: Number(params?.[4] ?? 0),
        remise_montant: Number(params?.[5] ?? 0),
        tva_pct: Number(params?.[6] ?? 18),
        tva_montant: Number(params?.[7] ?? 0),
        total_ttc: Number(params?.[8] ?? 0),
        montant_paye: 0,
        solde_restant: Number(params?.[8] ?? 0),
        statut_paiement: 'non_paye',
        notes: params?.[9] ?? null,
        magasin_id: 1,
      };
      dynamicVentes.push(newVente);
      return { rows: [newVente], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }
    if (text.toUpperCase().includes('INSERT') && text.toUpperCase().includes('VENTES_LIGNES')) {
      return { rows: [], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // â”€â”€â”€ INSERT ACHATS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (text.toUpperCase().includes('INSERT') && text.toUpperCase().includes('ACHATS') && !text.toUpperCase().includes('LIGNES')) {
      const id = nextAchatId++;
      const numero = params?.[0] ? String(params[0]) : `ACH-${String(id).padStart(4, '0')}`;
      const newAchat: any = {
        id,
        numero,
        fournisseur_id: params?.[1] ?? null,
        date_achat: new Date().toISOString().split('T')[0],
        date_echeance: params?.[2] ?? null,
        total_ht: Number(params?.[3] ?? 0),
        tva_montant: Number(params?.[4] ?? 0),
        total_ttc: Number(params?.[5] ?? 0),
        montant_paye: 0,
        solde_restant: Number(params?.[5] ?? 0),
        statut_paiement: 'non_paye',
        magasin_id: 1,
      };
      dynamicAchats.push(newAchat);
      return { rows: [newAchat], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }
    if (text.toUpperCase().includes('INSERT') && text.toUpperCase().includes('ACHATS_LIGNES')) {
      return { rows: [], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // â”€â”€â”€ INSERT PAIEMENTS (y compris dÃ©penses) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (text.toUpperCase().includes('INSERT') && text.toUpperCase().includes('PAIEMENTS')) {
      const id = nextPaiementId++;
      const isPaiement = text.includes('type_paiement,vente_id') || text.includes('type_paiement,achat_id');
      const isDepense = text.includes("'depense'") || text.includes('categorie_depense');
      const newPaiement: any = {
        id,
        type_paiement: isDepense ? 'depense' : String(params?.[0] ?? 'encaissement'),
        montant: isDepense ? Number(params?.[0] ?? 0) : Number(params?.[5] ?? 0),
        date_paiement: new Date().toISOString().split('T')[0],
        categorie_depense: isDepense ? String(params?.[2] ?? '') : null,
        notes: null,
      };
      dynamicDepenses.push(newPaiement);
      return { rows: [newPaiement], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // â”€â”€â”€ INSERT DEVIS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (text.toUpperCase().includes('INSERT') && text.toUpperCase().includes('DEVIS') && !text.toUpperCase().includes('LIGNES')) {
      const id = nextDevisId++;
      const numero = String(params?.[0] ?? `DEV-${String(id).padStart(4, '0')}`);
      const newDevis: any = {
        id,
        numero,
        client_id: params?.[1] ?? null,
        type_vente: String(params?.[2] ?? 'gros'),
        date_devis: new Date().toISOString().split('T')[0],
        date_validite: params?.[4] ?? null,
        sous_total: Number(params?.[5] ?? 0),
        tva_pct: Number(params?.[8] ?? 18),
        tva_montant: Number(params?.[9] ?? 0),
        total_ttc: Number(params?.[10] ?? 0),
        statut: 'brouillon',
        notes: params?.[11] ?? null,
      };
      dynamicDevis.push(newDevis);
      return { rows: [newDevis], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }
    if (text.toUpperCase().includes('INSERT') && text.toUpperCase().includes('DEVIS_LIGNES')) {
      return { rows: [], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // â”€â”€â”€ INSERT BONS_COMMANDE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (text.toUpperCase().includes('INSERT') && text.toUpperCase().includes('BONS_COMMANDE') && !text.toUpperCase().includes('LIGNES')) {
      const id = nextBonCommandeId++;
      const numero = String(params?.[0] ?? `BC-${String(id).padStart(4, '0')}`);
      const newBC: any = {
        id,
        numero,
        fournisseur_id: params?.[1] ?? null,
        date_commande: new Date().toISOString().split('T')[0],
        date_livraison: params?.[3] ?? null,
        total_ht: Number(params?.[4] ?? 0),
        tva_montant: Number(params?.[5] ?? 0),
        total_ttc: Number(params?.[6] ?? 0),
        statut: 'en_cours',
        notes: params?.[7] ?? null,
      };
      dynamicBonsCommande.push(newBC);
      return { rows: [newBC], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }
    if (text.toUpperCase().includes('INSERT') && text.toUpperCase().includes('BONS_COMMANDE_LIGNES')) {
      return { rows: [], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // â”€â”€â”€ INSERT RETOURS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (text.toUpperCase().includes('INSERT') && text.toUpperCase().includes('RETOURS_CLIENT')) {
      const id = nextRetourId++;
      const newRetour: any = {
        id,
        numero: String(params?.[0] ?? `RET-${String(id).padStart(4, '0')}`),
        vente_id: params?.[1] ?? null,
        client_id: params?.[2] ?? null,
        date_retour: new Date().toISOString().split('T')[0],
        motif: params?.[4] ?? null,
        type_avoir: String(params?.[5] ?? 'remboursement'),
        montant_total: Number(params?.[6] ?? 0),
        statut: 'en_attente',
      };
      dynamicRetours.push(newRetour);
      return { rows: [newRetour], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }
    if (text.toUpperCase().includes('INSERT') && text.toUpperCase().includes('RETOURS_LIGNES')) {
      return { rows: [], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // â”€â”€â”€ INSERT TRANSFERTS_STOCK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (text.toUpperCase().includes('INSERT') && text.toUpperCase().includes('TRANSFERTS_STOCK')) {
      const id = nextTransfertId++;
      const newTransfert: any = {
        id,
        produit_id: params?.[0] ?? null,
        magasin_source: params?.[1] ?? null,
        magasin_dest: params?.[2] ?? null,
        quantite: Number(params?.[3] ?? 0),
        notes: params?.[4] ?? null,
        created_by: params?.[5] ?? null,
        date_transfert: new Date().toISOString().split('T')[0],
        statut: 'termine',
      };
      dynamicTransferts.push(newTransfert);
      return { rows: [newTransfert], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // â”€â”€â”€ INSERT CLIENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (text.toUpperCase().includes('INSERT') && text.toUpperCase().includes('CLIENTS')) {
      const code = String(params?.[0] ?? '');
      const type_client = String(params?.[1] ?? '');
      const raison_sociale = String(params?.[2] ?? '');
      const contact_nom = String(params?.[3] ?? '');
      const telephone = String(params?.[4] ?? '');
      const email = String(params?.[5] ?? '');
      const adresse = String(params?.[6] ?? '');
      const ville = String(params?.[7] ?? 'Abidjan');
      const plafond_credit = String(params?.[8] ?? '0');
      const delai_paiement = String(params?.[9] ?? '0');

      const newClient: any = {
        id: nextClientId++,
        code,
        type_client,
        raison_sociale,
        contact_nom: contact_nom === '' ? null : contact_nom,
        telephone: telephone === '' ? null : telephone,
        email: email === '' ? null : email,
        adresse: adresse === '' ? null : adresse,
        ville,
        plafond_credit,
        delai_paiement,
        statut: 'actif',
        ca_total: '0',
        encours_creance: '0',
        magasin_id: 1,
        derniere_vente: null,
      };
      dynamicClients.push(newClient);
      return { rows: [newClient], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // â”€â”€â”€ INSERT RÃ‰FÃ‰RENTIELS et tables secondaires â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Capture tous les INSERT non traitÃ©s spÃ©cifiquement ci-dessus
    if (text.toUpperCase().includes('INSERT')) {
      const id = Math.floor(Math.random() * 10000) + 1000;
      // DÃ©tecter si c'est une table de rÃ©fÃ©rentiel connue pour retourner le bon format
      const isReferentiel = /INSERT INTO (marques|categories|moyens_paiement|types_|statuts_|zones_livraison)/i.test(text);
      if (isReferentiel) {
        const nom = String(params?.[0] ?? '');
        const libelle = String(params?.[1] ?? params?.[0] ?? '');
        return { rows: [{ id, code: nom, nom, libelle, actif: true, ordre: 0 }], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
      }
      // Pour tous les autres INSERT (stocks, mouvements, echeances, etc.)
      return { rows: [{ id, success: true }], rowCount: 1, command: 'INSERT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // â”€â”€â”€ UPDATE handlers universels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (text.toUpperCase().startsWith('UPDATE')) {
      // For single-row updates with RETURNING, return a mock updated row
      if (text.toUpperCase().includes('RETURNING')) {
        const entity: any = { id: Number(params?.[params.length - 1] ?? 1) };
        // Try to fill in the updated values generically
        return { rows: [entity], rowCount: 1, command: 'UPDATE', fields: [], oid: 0 } as QueryResult<T>;
      }
      return { rows: [], rowCount: 1, command: 'UPDATE', fields: [], oid: 0 } as QueryResult<T>;
    }

    // â”€â”€â”€ DELETE handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (text.toUpperCase().startsWith('DELETE')) {
      return { rows: [], rowCount: 1, command: 'DELETE', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock clients - with sales aggregates
    if (text.includes('FROM clients')) {
      const staticClients = [
        { id: 1, code: 'CLT001', raison_sociale: 'Bouticom Abidjan', type_client: 'gros', contact_nom: 'Jean KouamÃ©', telephone: '+22507001111', email: 'contact@bouticom.ci', adresse: 'Abidjan', ville: 'Abidjan', plafond_credit: '5000000', delai_paiement: '30', statut: 'actif', ca_total: '2500000', encours_creance: '0', derniere_vente: '2026-05-01', magasin_id: 1 },
        { id: 2, code: 'CLT002', raison_sociale: 'Telephones Plus', type_client: 'gros', contact_nom: 'Marie Diallo', telephone: '+22507002222', email: 'marie@tphones.ci', adresse: 'Abidjan', ville: 'Abidjan', plafond_credit: '3000000', delai_paiement: '30', statut: 'actif', ca_total: '1800000', encours_creance: '1800000', derniere_vente: '2026-04-25', magasin_id: 1 },
        { id: 3, code: 'CLT003', raison_sociale: 'Boutique du Port', type_client: 'detail', contact_nom: 'Yves Anon', telephone: '+22507003333', email: 'yves@port.ci', adresse: 'Port-Bouet', ville: 'Port-Bouet', plafond_credit: '500000', delai_paiement: '15', statut: 'actif', ca_total: '450000', encours_creance: '150000', derniere_vente: '2026-04-28', magasin_id: 2 },
        { id: 4, code: 'CLT004', raison_sociale: 'Cocody Mobiles', type_client: 'gros', contact_nom: 'Ama Kouassi', telephone: '+22507004444', email: 'info@cocodymobiles.ci', adresse: 'Cocody', ville: 'Cocody', plafond_credit: '2500000', delai_paiement: '30', statut: 'actif', ca_total: '3850000', encours_creance: '0', derniere_vente: '2026-05-02', magasin_id: 3 },
        { id: 5, code: 'CLT005', raison_sociale: 'Express Phones', type_client: 'detail', contact_nom: 'Kofi Mensah', telephone: '+22507005555', email: 'kofi@express.ci', adresse: 'Port-Bouet', ville: 'Port-Bouet', plafond_credit: '400000', delai_paiement: '15', statut: 'actif', ca_total: '520000', encours_creance: '100000', derniere_vente: '2026-04-29', magasin_id: 2 },
      ];
      // Combine static + dynamic clients
      const allClients = [...staticClients, ...dynamicClients];
      return {
        rows: allClients,
        rowCount: allClients.length,
        command: 'SELECT',
        fields: [],
        oid: 0,
      } as QueryResult<T>;
    }

    // Mock magasins (stores) - incluant ceux crÃ©Ã©s dynamiquement (Ã©viter v_utilisateurs_magasins)
    if (text.toLowerCase().includes('from magasins')) {
      const staticMagasins = [
        { id: 1, code: 'MAG001', nom: 'Magasin Principal', ville: 'Abidjan', adresse: '123 Rue du Commerce', actif: true, nb_utilisateurs: 3, valeur_stock: '2640000' },
        { id: 2, code: 'MAG002', nom: 'Magasin Port-Bouet', ville: 'Port-Bouet', adresse: '456 Avenue du Port', actif: true, nb_utilisateurs: 2, valeur_stock: '2310000' },
        { id: 3, code: 'MAG003', nom: 'Magasin Cocody', ville: 'Cocody', adresse: '789 Boulevard de Cocody', actif: true, nb_utilisateurs: 1, valeur_stock: '1686000' },
      ];
      const allMagasins = [...staticMagasins, ...dynamicMagasins];
      return {
        rows: allMagasins,
        rowCount: allMagasins.length,
        command: 'SELECT',
        fields: [],
        oid: 0,
      } as QueryResult<T>;
    }

    // Mock fournisseurs (suppliers)
    if (text.includes('FROM fournisseurs') || (text.includes('fournisseurs') && text.includes('raison_sociale'))) {
      const staticFournisseurs = [
        { id: 1, code: 'FRN001', raison_sociale: 'Apple Distribution CI', contact_nom: 'Pierre Martin', telephone: '+22507004444', email: 'sales@appledist.ci', ville: 'Abidjan', solde_restant: '500000', total_achats: '1200000', encours_dette: '500000', actif: true },
        { id: 2, code: 'FRN002', raison_sociale: 'Samsung Benelux', contact_nom: 'Isabelle Dupont', telephone: '+22507005555', email: 'contact@sambenelux.ci', ville: 'Port-Bouet', solde_restant: '300000', total_achats: '800000', encours_dette: '300000', actif: true },
      ];
      const allFournisseurs = [...staticFournisseurs, ...dynamicFournisseurs];
      return {
        rows: allFournisseurs,
        rowCount: allFournisseurs.length,
        command: 'SELECT',
        fields: [],
        oid: 0,
      } as QueryResult<T>;
    }

    // Mock ventes detail (GET /ventes/:id)
    if (text.toUpperCase().includes('FROM VENTES') && text.includes('WHERE') && text.includes('v.id')) {
      const id = Number(params?.[0]);
      const vente = [...mockVentesDetailles, ...dynamicVentes].find(v => v.id === id);
      return { rows: vente ? [vente] : [], rowCount: vente ? 1 : 0, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock achats (purchases) list + dynamics
    if (text.includes('FROM achats')) {
      const staticAchats = [
        { id: 1, numero: 'ACH-0001', date_achat: '2026-04-20', fournisseur_id: 1, fournisseur_nom: 'Apple Distribution CI', total_ht: '1016949', tva_montant: '183051', total_ttc: '1200000', montant_paye: '1200000', solde_restant: '0', statut_paiement: 'paye', magasin_id: 1, magasin_nom: 'Magasin Principal' },
        { id: 2, numero: 'ACH-0002', date_achat: '2026-04-15', fournisseur_id: 2, fournisseur_nom: 'Samsung Benelux', total_ht: '677966', tva_montant: '122034', total_ttc: '800000', montant_paye: '500000', solde_restant: '300000', statut_paiement: 'partiel', magasin_id: 1, magasin_nom: 'Magasin Principal' },
      ];
      const allAchats = [...staticAchats, ...dynamicAchats];
      return { rows: allAchats, rowCount: allAchats.length, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock dÃ©penses (stored as paiements with type='depense')
    if (text.includes("type_paiement") && (text.includes("'depense'") || text.includes('categorie_depense'))) {
      const staticDepenses = [
        { id: 1, type_paiement: 'depense', montant: '85000', date_paiement: '2026-04-30', categorie_depense: 'Loyer', moyen_paiement_id: null, reference: null, notes: 'Loyer mensuel', recurrence: 'mensuel' },
        { id: 2, type_paiement: 'depense', montant: '25000', date_paiement: '2026-04-28', categorie_depense: 'Ã‰lectricitÃ©', moyen_paiement_id: null, reference: 'SODECI-2604', notes: null, recurrence: 'mensuel' },
        { id: 3, type_paiement: 'depense', montant: '45000', date_paiement: '2026-04-25', categorie_depense: 'Transport', moyen_paiement_id: null, reference: null, notes: 'Transport livraisons', recurrence: null },
      ];
      const allDepenses = [...staticDepenses, ...dynamicDepenses];
      return { rows: allDepenses, rowCount: allDepenses.length, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock catÃ©gories dÃ©penses
    if (text.includes('categories_depenses')) {
      return {
        rows: [
          { id: 1, libelle: 'Loyer', actif: true },
          { id: 2, libelle: 'Ã‰lectricitÃ©', actif: true },
          { id: 3, libelle: 'Transport', actif: true },
          { id: 4, libelle: 'Salaires', actif: true },
          { id: 5, libelle: 'Fournitures', actif: true },
          { id: 6, libelle: 'Communication', actif: true },
          { id: 7, libelle: 'Maintenance', actif: true },
        ],
        rowCount: 7, command: 'SELECT', fields: [], oid: 0,
      } as QueryResult<T>;
    }

    // Mock devis (exact table match, not statuts_devis etc., not MAX queries)
    if (text.toUpperCase().includes('FROM DEVIS') && !text.toUpperCase().includes('STATUTS_DEVIS') && !text.toUpperCase().includes('DEVIS_LIGNES') && !text.includes('COALESCE(MAX')) {
      return { rows: dynamicDevis, rowCount: dynamicDevis.length, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock bons de commande (exclude MAX queries)
    if ((text.includes('FROM bons_commande') || text.includes('bons_commande')) && !text.includes('COALESCE(MAX')) {
      return { rows: dynamicBonsCommande, rowCount: dynamicBonsCommande.length, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock retours (exclude MAX queries)
    if ((text.includes('retours_client') || text.includes('retours_lignes') || text.includes('FROM retours')) && !text.includes('COALESCE(MAX')) {
      return { rows: dynamicRetours, rowCount: dynamicRetours.length, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock transferts stock
    if (text.includes('transferts_stock')) {
      return { rows: dynamicTransferts, rowCount: dynamicTransferts.length, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock utilisateurs (admin panel) â€” listing without WHERE clause
    if (text.includes('FROM utilisateurs') || (text.includes('utilisateurs') && text.includes('v_utilisateurs_magasins'))) {
      const staticUsersArr = Object.values(mockUsers).map(u => ({
        id: u.id,
        code: u.code,
        nom: u.nom,
        prenom: u.prenom,
        email: u.email,
        telephone: u.telephone,
        role: u.role_code,
        role_id: u.id,
        role_nom: u.role_libelle,
        role_libelle: u.role_libelle,
        actif: u.actif,
        magasin_ids: u.magasin_ids,
        magasin_noms: u.magasin_noms,
        derniere_cnx: null,
      }));
      const allUsers = [...staticUsersArr, ...dynamicUtilisateurs];
      return { rows: allUsers, rowCount: allUsers.length, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock paiements
    if (text.includes('FROM paiements') || (text.includes('paiements') && text.includes('WHERE'))) {
      return { rows: dynamicPaiements, rowCount: dynamicPaiements.length, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock stocks mouvements
    if (text.includes('v_mouvements_stock') || text.includes('mouvements_stock')) {
      return { rows: [], rowCount: 0, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock stocks
    if (text.includes('v_stocks') || text.includes('FROM stocks')) {
      const rows = mockProduitsDetailles.map(p => ({
        produit_id: p.id,
        reference: p.reference,
        designation: p.designation,
        marque: p.marque,
        categorie: p.categorie,
        magasin_id: p.magasin_id,
        quantite: p.quantite,
        quantite_totale: p.quantite,
        alerte_stock: p.alerte_stock <= p.quantite,
        stock_alerte: p.alerte_stock,
        prix_achat: p.prix_achat,
        actif: true,
      }));
      return { rows, rowCount: rows.length, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock roles
    if (text.includes('FROM roles') || text.includes('roles')) {
      return {
        rows: [
          { id: 1, code: 'admin', libelle: 'Administrateur', permissions: JSON.stringify({ all: true }) },
          { id: 2, code: 'commercial', libelle: 'Commercial', permissions: JSON.stringify({ ventes: true, clients: true }) },
          { id: 3, code: 'caissier', libelle: 'Caissier', permissions: JSON.stringify({ ventes: 'read', paiements: true }) },
          { id: 4, code: 'comptable', libelle: 'Comptable', permissions: JSON.stringify({ ventes: 'read', rapports: 'read' }) },
          { id: 5, code: 'magasinier', libelle: 'Magasinier', permissions: JSON.stringify({ produits: 'read' }) },
        ],
        rowCount: 5, command: 'SELECT', fields: [], oid: 0,
      } as QueryResult<T>;
    }

    // Mock rÃ©fÃ©rentiels gÃ©nÃ©riques (marques, catÃ©gories, moyens de paiement, etc.)
    if (text.includes('FROM marques')) {
      return { rows: [
        { id: 1, code: 'APPLE', nom: 'Apple', libelle: 'Apple', actif: true, ordre: 1 },
        { id: 2, code: 'SAMSUNG', nom: 'Samsung', libelle: 'Samsung', actif: true, ordre: 2 },
        { id: 3, code: 'XIAOMI', nom: 'Xiaomi', libelle: 'Xiaomi', actif: true, ordre: 3 },
        { id: 4, code: 'HUAWEI', nom: 'Huawei', libelle: 'Huawei', actif: true, ordre: 4 },
        { id: 5, code: 'OPPO', nom: 'Oppo', libelle: 'Oppo', actif: true, ordre: 5 },
      ], rowCount: 5, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }
    if (text.includes('FROM categories') && !text.includes('categories_depenses')) {
      return { rows: [
        { id: 1, code: 'PHONE', libelle: 'TÃ©lÃ©phones', nom: 'TÃ©lÃ©phones', actif: true, ordre: 1 },
        { id: 2, code: 'ACCESS', libelle: 'Accessoires', nom: 'Accessoires', actif: true, ordre: 2 },
        { id: 3, code: 'TABLET', libelle: 'Tablettes', nom: 'Tablettes', actif: true, ordre: 3 },
        { id: 4, code: 'COMP', libelle: 'Ordinateurs', nom: 'Ordinateurs', actif: true, ordre: 4 },
      ], rowCount: 4, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }
    if (text.includes('FROM moyens_paiement')) {
      return { rows: [
        { id: 1, code: 'CASH', nom: 'EspÃ¨ces', libelle: 'EspÃ¨ces', actif: true, ordre: 1 },
        { id: 2, code: 'VIRT', nom: 'Virement', libelle: 'Virement', actif: true, ordre: 2 },
        { id: 3, code: 'MOBM', nom: 'Mobile Money', libelle: 'Mobile Money', actif: true, ordre: 3 },
        { id: 4, code: 'CHEK', nom: 'ChÃ¨que', libelle: 'ChÃ¨que', actif: true, ordre: 4 },
      ], rowCount: 4, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }
    // Toutes les autres tables de rÃ©fÃ©rentiels (types_, statuts_, canaux_, etc.)
    if (/FROM (types_|statuts_|canaux_|zones_|types_avoir|statuts_avoir|statuts_reception)/i.test(text)) {
      return { rows: [], rowCount: 0, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Mock rapport rentabilitÃ© produits
    if (text.includes('v_rentabilite_produits')) {
      return {
        rows: [
          { reference: 'APL-IP15P', designation: 'iPhone 15 Pro', marque: 'Apple', qte_vendue: 12, ca: '7800000', cout: '5400000', marge_brute: '2400000', taux_marge: 30.8 },
          { reference: 'SAM-S24', designation: 'Samsung Galaxy S24', marque: 'Samsung', qte_vendue: 8, ca: '4640000', cout: '3200000', marge_brute: '1440000', taux_marge: 31.0 },
          { reference: 'XIA-14', designation: 'Xiaomi 14', marque: 'Xiaomi', qte_vendue: 15, ca: '6000000', cout: '3750000', marge_brute: '2250000', taux_marge: 37.5 },
          { reference: 'APL-AP3', designation: 'AirPods Pro', marque: 'Apple', qte_vendue: 25, ca: '3000000', cout: '2000000', marge_brute: '1000000', taux_marge: 33.3 },
        ],
        rowCount: 4, command: 'SELECT', fields: [], oid: 0,
      } as QueryResult<T>;
    }

    // Mock rapport global
    if (text.includes('rapport') || text.includes('cumul') || (text.includes('ca_total') && text.includes('nb_ventes'))) {
      return { rows: [{ ca_total: '9120000', nb_ventes: '6', marge_totale: '2736000', taux_marge: '30' }], rowCount: 1, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
    }

    // Default mock response
    return { rows: [], rowCount: 0, command: 'SELECT', fields: [], oid: 0 } as QueryResult<T>;
  },

  connect: async () => ({
    query: async (text: string, params?: unknown[]) => mockDb.query(text, params),
    release: async () => {},
  }),
};

