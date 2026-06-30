// ============================================================
// StoreBox — Types TypeScript partagés (API ↔ Web)
// packages/shared/src/index.ts
// ============================================================

// ─── RÉPONSE API STANDARD ────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?:   T;
  error?:  string;
}

// ─── AUTH ────────────────────────────────────────────────────
export interface Utilisateur {
  id:           number;
  code:         string;
  nom:          string;
  prenom:       string;
  email:        string;
  telephone?:   string;
  role:         RoleCode;
  roleLabel:    string;
  permissions:  Permissions;
  derniere_cnx?: string;
  magasin_ids:  number[];        // [] = admin (tous magasins)
  magasin_noms: string[];        // noms correspondants
}

export type RoleCode = 'admin' | 'commercial' | 'caissier' | 'comptable' | 'magasinier';

export interface Permissions {
  all?:       boolean;
  ventes?:    boolean | 'read';
  clients?:   boolean | 'read';
  produits?:  boolean | 'read';
  creances?:  boolean | 'read';
  dettes?:    boolean | 'read';
  rapports?:  boolean | 'read';
  paiements?: boolean | 'read';
  admin?:     boolean;
  dashboard?: boolean | 'read';
}

export interface LoginPayload  { email: string; password: string; }
export interface LoginResponse {
  token:        string;
  refreshToken: string;
  expiresIn:    string;
  user:         Utilisateur;
}

// ─── PRODUITS ────────────────────────────────────────────────
// ─── PALIERS DE PRIX ─────────────────────────────────────────
export interface PrixPalier {
  id?:        number;
  produit_id?: number;
  libelle:    string;
  qte_min:    number;
  qte_max?:   number | null;
  prix:       number;
  type_vente: 'gros' | 'detail' | 'tous';
  actif?:     boolean;
  ordre?:     number;
}

export interface Produit {
  id:           number;
  reference:    string;
  designation:  string;
  marque?:      string;
  categorie?:   string;
  prix_achat:   number;
  prix_gros:    number;
  prix_detail:  number;
  qte_min_gros: number;
  stock:        number;       // héritage — préférer StockMagasin.quantite
  stock_alerte: number;
  stock_max:    number;
  actif:        boolean;
  // ─── Produits universels (migration 021) ───
  unite_id?:        number;
  unite_code?:      string;   // 'pcs','kg','l'…
  unite_libelle?:   string;
  unite_decimales?: number;   // nb de décimales autorisées à la saisie
  vendu_au_poids?:  boolean;  // quantité décimale (kg, litre…)
  prix_modifiable?: boolean;  // prix saisi à la caisse (pesée)
  gere_peremption?: boolean;
  gere_lot?:        boolean;
  facteur_gros?:    number;   // unités de base par conditionnement gros
  paliers?:         PrixPalier[];
}

// ─── Unité de mesure (référentiel) ────────────────────────────
export interface UniteMesure {
  id:        number;
  code:      string;
  libelle:   string;
  decimales: number;
  actif:     boolean;
  ordre:     number;
}

// ─── Lot / péremption ─────────────────────────────────────────
export interface Lot {
  id:              number;
  produit_id:      number;
  magasin_id:      number;
  numero_lot?:     string;
  date_entree:     string;
  date_peremption?: string;
  quantite:        number;
  prix_achat:      number;
  designation?:    string;
  magasin_nom?:    string;
  jours_restants?: number;
}

// ─── MULTI-MAGASIN ────────────────────────────────────────────
export interface Magasin {
  id:           number;
  code:         string;
  nom:          string;
  adresse?:     string;
  telephone?:   string;
  email?:       string;
  actif:        boolean;
  created_at?:  string;
  nb_utilisateurs?: number;
  valeur_stock?:    number;
}

export interface StockMagasin {
  produit_id:   number;
  magasin_id:   number;
  magasin_nom?: string;
  reference?:   string;
  designation?: string;
  prix_achat?:  number;
  prix_gros?:   number;
  prix_detail?: number;
  actif?:       boolean;
  quantite:     number;
  stock_alerte: number;
  stock_max?:   number;
  alerte_stock: boolean;
}

export interface StockConsolide {
  produit_id:      number;
  reference:       string;
  designation:     string;
  prix_achat:      number;
  prix_gros:       number;
  prix_detail:     number;
  actif:           boolean;
  stock_max:       number;
  quantite_totale: number;
  stock_alerte_min: number;
  alerte_stock:    boolean;
}

export interface TransfertStock {
  id:               number;
  produit_id:       number;
  designation?:     string;
  reference?:       string;
  magasin_source:   number;
  magasin_source_nom?: string;
  magasin_dest:     number;
  magasin_dest_nom?: string;
  quantite:         number;
  notes?:           string;
  created_by?:      number;
  created_at:       string;
}

// ─── CLIENTS ─────────────────────────────────────────────────
export type TypeClient = 'grossiste' | 'detaillant' | 'particulier';
export type StatutClient = 'actif' | 'inactif' | 'bloque' | 'contentieux';

export interface Client {
  id:               number;
  code:             string;
  type_client:      TypeClient;
  raison_sociale:   string;
  contact_nom?:     string;
  telephone?:       string;
  email?:           string;
  adresse?:         string;
  ville?:           string;
  plafond_credit:   number;
  delai_paiement:   number;
  solde_initial:    number;
  statut:           StatutClient;
  note_risque:      number;
  ca_total?:        number;
  encours_creance?: number;
  derniere_vente?:  string;
}

// ─── FOURNISSEURS ────────────────────────────────────────────
export interface Fournisseur {
  id:              number;
  code:            string;
  raison_sociale:  string;
  contact_nom?:    string;
  telephone?:      string;
  email?:          string;
  pays?:           string;
  delai_paiement:  number;
  solde_initial:   number;
  total_achats?:   number;
  encours_dette?:  number;
}

// ─── VENTES ──────────────────────────────────────────────────
export type TypeVente = 'gros' | 'detail';
export type StatutPaiement =
  | 'non_paye' | 'partiel' | 'paye' | 'en_retard' | 'contentieux';

export interface Vente {
  id:               number;
  numero:           string;
  client_id:        number;
  client_nom?:      string;
  type_vente:       TypeVente;
  date_vente:       string;
  date_echeance?:   string;
  sous_total:       number;
  remise_pct:       number;
  remise_montant:   number;
  tva_pct:          number;
  tva_montant:      number;
  total_ttc:        number;
  montant_paye:     number;
  solde_restant:    number;
  statut_paiement:  StatutPaiement;
  moyen_paiement?:  string;
  notes?:           string;
  magasin_id?:      number;
  magasin_nom?:     string;
}

export interface VenteLigne {
  produit_id:    number;
  designation?:  string;
  reference?:    string;
  quantite:      number;
  prix_unitaire: number;
  remise_pct?:   number;
  total_ligne:   number;
}

export interface NouvelleVente {
  client_id:              number;
  type_vente:             TypeVente;
  date_vente?:            string;
  date_echeance?:         string;
  lignes:                 VenteLigne[];
  remise_pct?:            number;
  tva_pct?:               number;
  moyen_paiement_id?:     number;
  notes?:                 string;
  montant_paye_immediat?: number;
  envoyer_confirmation?:  boolean;
}

// ─── CRÉANCES ────────────────────────────────────────────────
export type CategorieEcheance =
  | 'non_echu' | 'echu_30j' | 'echu_60j' | 'contentieux' | 'paye';

export interface Creance {
  id:                  number;
  numero:              string;
  client_id:           number;
  raison_sociale:      string;
  type_client:         TypeClient;
  telephone?:          string;
  date_vente:          string;
  date_echeance?:      string;
  total_ttc:           number;
  montant_paye:        number;
  solde_restant:       number;
  statut_paiement:     StatutPaiement;
  jours_retard?:       number;
  categorie_echeance:  CategorieEcheance;
}

export interface AgeingCreances {
  total:       number;
  non_echu:    number;
  echu_30j:    number;
  echu_60j:    number;
  contentieux: number;
}

// ─── DETTES FOURNISSEURS ──────────────────────────────────────
export interface Dette {
  id:                 number;
  numero:             string;
  fournisseur_id:     number;
  raison_sociale:     string;
  date_achat:         string;
  date_echeance?:     string;
  total_ttc:          number;
  montant_paye:       number;
  solde_restant:      number;
  statut_paiement:    StatutPaiement;
  jours_retard?:      number;
  categorie_echeance: string;
}

// ─── PAIEMENT ────────────────────────────────────────────────
export interface NouveauPaiement {
  type_paiement:          'encaissement' | 'decaissement';
  vente_id?:              number;
  achat_id?:              number;
  montant:                number;
  date_paiement?:         string;
  moyen_paiement_id?:     number;
  reference?:             string;
  notes?:                 string;
  envoyer_confirmation?:  boolean;
}

// ─── DASHBOARD ───────────────────────────────────────────────
export interface DashboardData {
  ca: {
    ca_mois:    number;
    nb_ventes:  number;
  };
  creances: {
    total:      number;
    en_retard:  number;
  };
  dettes: {
    total:      number;
    urgent:     number;
  };
  tresorerie: {
    entrees: number;
    sorties: number;
    net:     number;
  };
  stock: {
    ruptures: number;
    alertes:  number;
  };
  topProduits: Array<{
    designation:  string;
    reference:    string;
    qte_vendue:   number;
    ca_genere:    number;
  }>;
  caChart: Array<{
    mois:   string;
    gros:   number;
    detail: number;
  }>;
}

// ─── ACHATS ──────────────────────────────────────────────────
export interface Achat {
  id:               number;
  numero:           string;
  fournisseur_id:   number;
  fournisseur_nom?: string;
  date_achat:       string;
  date_echeance?:   string;
  sous_total:       number;
  tva_pct:          number;
  tva_montant:      number;
  total_ttc:        number;
  montant_paye:     number;
  solde_restant:    number;
  statut_paiement:  StatutPaiement;
  notes?:           string;
}

export interface AchatLigne {
  produit_id:    number;
  designation?:  string;
  reference?:    string;
  quantite:      number;
  prix_unitaire: number;
  total_ligne:   number;
}

export interface UtilisateurAdmin {
  id:            number;
  code:          string;
  nom:           string;
  prenom:        string;
  email:         string;
  telephone?:    string;
  role_id:       number;
  role:          RoleCode;
  role_nom:      string;
  actif:         boolean;
  derniere_cnx?: string;
  magasin_ids:   number[];
  magasin_noms?: string[];
}

export interface Role {
  id:    number;
  code:  RoleCode;
  nom:   string;
}

// ─── DEVIS ───────────────────────────────────────────────────
export type StatutDevis = 'brouillon' | 'envoye' | 'accepte' | 'refuse' | 'expire' | 'converti';

export interface Devis {
  id:               number;
  numero:           string;
  client_id:        number;
  client_nom?:      string;
  statut:           StatutDevis;
  date_devis:       string;
  date_validite?:   string;
  total_ht:         number;
  tva_pct:          number;
  tva_montant:      number;
  total_ttc:        number;
  notes?:           string;
}

export interface DevisLigne {
  produit_id?:   number;
  designation:   string;
  quantite:      number;
  prix_unitaire: number;
  remise_pct?:   number;
  total_ligne:   number;
}

// ─── RETOURS ─────────────────────────────────────────────────
export type StatutRetour = 'en_attente' | 'traite' | 'annule';

export interface Retour {
  id:             number;
  numero:         string;
  vente_id:       number;
  client_nom?:    string;
  raison:         string;
  statut:         StatutRetour;
  date_retour:    string;
  montant_total:  number;
  notes?:         string;
}

// ─── BONS DE COMMANDE ─────────────────────────────────────────
export type StatutBC = 'brouillon' | 'envoye' | 'confirme' | 'receptionne_partiel' | 'receptionne' | 'annule';

export interface BonCommande {
  id:                number;
  numero:            string;
  fournisseur_id:    number;
  fournisseur_nom?:  string;
  statut:            StatutBC;
  date_commande:     string;
  date_livraison_prevue?: string;
  total_ht:          number;
  tva_pct:           number;
  total_ttc:         number;
  notes?:            string;
}

// ─── STOCK ────────────────────────────────────────────────────
export type TypeMouvement = 'entree' | 'sortie' | 'ajustement' | 'retour';

export interface MouvementStock {
  id:           number;
  produit_id:   number;
  designation?: string;
  reference?:   string;
  type_mouvement: TypeMouvement;
  quantite:     number;
  stock_avant:  number;
  stock_apres:  number;
  motif?:       string;
  created_at:   string;
}

// ─── OBJECTIFS ────────────────────────────────────────────────
export interface Objectif {
  annee:        number;
  mois:         number;
  commercial_id?: number;
  ca_cible:     number;
  nb_ventes_cible?: number;
}

// ─── NOTIFICATIONS ────────────────────────────────────────────
export type CanalNotif = 'sms' | 'whatsapp' | 'email';

export interface NotificationLog {
  id:           number;
  type:         string;
  canal:        CanalNotif;
  destinataire: string;
  message:      string;
  statut:       'envoye' | 'echec' | 'en_attente';
  ref_doc?:     string;
  created_at:   string;
}

// ─── FORMATTERS (helpers partagés) ───────────────────────────
export const formatFCFA = (n: number | null | undefined): string => {
  if (n == null) return '—';
  return Math.round(n).toLocaleString('fr-CI') + ' F';
};

export const formatFCFAM = (n: number | null | undefined): string => {
  if (n == null) return '—';
  const m = Math.round(n) / 1_000_000;
  return m.toFixed(1) + ' M F';
};

export const formatDate = (d: string | Date | null | undefined): string => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
};

export const formatDateLong = (d: string | Date | null | undefined): string => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
};

// ─── RÉFÉRENTIELS (Tables génériques) ──────────────────────────

export interface Referentiel {
  id:        number;
  code:      string;
  libelle:   string;
  couleur?:  string;
  signe?:    number;
  icone?:    string;
  ordre:     number;
  actif:     boolean;
}

// Collection de tous les référentiels
export interface AllReferentiels {
  types_clients:              Referentiel[];
  statuts_clients:            Referentiel[];
  types_ventes:               Referentiel[];
  statuts_paiements_ventes:   Referentiel[];
  statuts_paiements_achats:   Referentiel[];
  types_mouvements_stock:     Referentiel[];
  canaux_notification:        Referentiel[];
  statuts_notification:       Referentiel[];
  statuts_devis:              Referentiel[];
  types_avoir:                Referentiel[];
  statuts_avoir:              Referentiel[];
  statuts_reception:          Referentiel[];
  types_paiement:             Referentiel[];
}

// ─── PARAMÈTRES SOCIÉTÉ ─────────────────────────────────
export interface SocieteParametres {
  id?:                    number;
  nom:                    string;
  raison_sociale?:        string;
  slogan?:                string;
  description?:           string;
  telephone?:             string;
  telephone2?:            string;
  email?:                 string;
  email_facturation?:     string;
  adresse?:               string;
  adresse2?:              string;
  ville?:                 string;
  code_postal?:           string;
  pays?:                  string;
  rccm?:                  string;
  numero_impot?:          string;
  numero_compte_bancaire?: string;
  iban?:                  string;
  swift?:                 string;
  nom_banque?:            string;
  adresse_banque?:        string;
  telephone_banque?:      string;
  devise:                 string;
  tva_defaut:             number;
  langue:                 string;
  format_date?:           string;
  logo_url?:              string;
  couleur_primaire?:      string;
  couleur_secondaire?:    string;
  signature_dirigeant?:   string;
  signature_comptable?:   string;
  // ─── Notifications SMS / WhatsApp ───
  sms_actif?:             boolean;
  wa_actif?:              boolean;
  sms_provider?:          string;   // twilio | orange_ci | infobip
  wa_provider?:           string;   // twilio | infobip
  gerant_tel?:            string;
  twilio_account_sid?:    string;
  twilio_auth_token?:     string;
  twilio_from?:           string;
  twilio_wa_from?:        string;
  orange_sms_api_key?:    string;
  orange_sender?:         string;
  infobip_api_key?:       string;
  infobip_base_url?:      string;
  infobip_from?:          string;
  infobip_wa_from?:       string;
  created_at?:            string;
  updated_at?:            string;
  updated_by?:            number;
}

// ─── CAISSE & POS ───────────────────────────────────────
export interface Caisse {
  id:         number;
  magasin_id: number;
  nom:        string;
  actif:      boolean;
  // enrichi
  session_active?: SessionCaisse | null;
}

export interface SessionCaisse {
  id:                       number;
  magasin_id:               number;
  caissier_id:              number;
  caisse_id?:               number;
  ouvert_a:                 string;
  ferme_a?:                 string;
  fond_ouverture:           number;
  montant_especes_attendu:  number;
  montant_especes_reel?:    number;
  ecart?:                   number;
  nb_ventes:                number;
  total_ventes:             number;
  notes?:                   string;
  statut:                   'ouverte' | 'fermee';
  // vues enrichies
  caissier_nom?:            string;
  magasin_nom?:             string;
  caisse_nom?:              string;
  duree_heures?:            number;
}

export interface VenteReglement {
  id?:                number;
  vente_id?:          number;
  moyen_paiement_id?: number;
  moyen_paiement?:    string;
  montant:            number;
  reference?:         string;
}

export interface LignePOS {
  produit_id:   number;
  designation:  string;
  reference?:   string;
  prix_unitaire:number;
  quantite:     number;
  remise_pct:   number;
  stock?:       number;
  unite_code?:      string;   // 'kg','l','pcs'…
  unite_decimales?: number;   // pas de saisie (0=entier, 3=kg)
  vendu_au_poids?:  boolean;
  prix_modifiable?: boolean;
}
