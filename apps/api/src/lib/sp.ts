/**
 * StoredProcedure Helper — Wrapper pour appels aux procédures stockées PostgreSQL
 * Centralise tous les appels SP avec un pattern unifié
 */

import { db } from './db';

export interface SPParams {
  [key: string]: unknown;
}

/**
 * Appeler une procédure stockée avec paramètres nommés (pour clarté)
 */
export async function callSP(spName: string, params: SPParams = {}) {
  try {
    const paramNames = Object.keys(params);
    const paramValues = Object.values(params);
    const argList = paramNames.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `SELECT * FROM ${spName}(${argList})`;

    const { rows } = await db.query(sql, paramValues);
    return rows;
  } catch (e: any) {
    console.error(`❌ SP Error: ${spName}`, e.message);
    throw e;
  }
}

/**
 * Appeler une SP et retourner un seul résultat
 */
export async function callSPScalar<T = Record<string, any>>(spName: string, params: SPParams = {}): Promise<T | null> {
  const rows = await callSP(spName, params);
  return (rows[0] as T) || null;
}

// ─── AUTH ────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  code: string;
  email: string;
  nom: string;
  prenom: string;
  telephone: string;
  password_hash: string;
  role_code: string;
  role_libelle: string;
  permissions: Record<string, any>;
  actif: boolean;
  is_super_admin: boolean;
  tentatives_echec: number;
  bloque_jusqu: string | null;
  magasin_ids: number[];
  magasin_noms: string[];
}

export async function spAuthLogin(email: string): Promise<AuthUser | null> {
  return callSPScalar<AuthUser>('sp_auth_login', { p_email: email });
}

// ─── VENTES ──────────────────────────────────────────────

export async function spVentesList(magasinId?: number, limit = 100, offset = 0) {
  return callSP('sp_ventes_list', { p_magasin_id: magasinId || null, p_limit: limit, p_offset: offset });
}

export async function spVentesListFilters(params: {
  magasinId?: number;
  typeVente?: string;
  statut?: string;
  clientId?: number;
  dateDebut?: string;
  dateFin?: string;
  limit?: number;
  offset?: number;
}) {
  return callSP('sp_ventes_list_filters', {
    p_magasin_id: params.magasinId || null,
    p_type_vente: params.typeVente || null,
    p_statut: params.statut || null,
    p_client_id: params.clientId || null,
    p_date_debut: params.dateDebut || null,
    p_date_fin: params.dateFin || null,
    p_limit: params.limit || 100,
    p_offset: params.offset || 0,
  });
}

export async function spVentesGet(id: number) {
  return callSPScalar('sp_ventes_get', { p_id: id });
}

export async function spVentesLignesList(venteId: number) {
  return callSP('sp_ventes_lignes_list', { p_vente_id: venteId });
}

export async function spVentesPaiementsList(venteId: number) {
  return callSP('sp_ventes_paiements_list', { p_vente_id: venteId });
}

export async function spVentesCreateComplete(params: {
  magasinId: number;
  clientId: number;
  typeVente: string;
  dateVente: string;
  dateEcheance?: string;
  sousTotal: number;
  remisePct: number;
  remiseMontant: number;
  tvaPct: number;
  tvaMontant: number;
  totalTtc: number;
  moyenPaiementId?: number;
  notes?: string;
  montantPaye?: number;
  lignesJson?: any;
  createdBy?: number;
}) {
  return callSPScalar('sp_ventes_create_complete', {
    p_magasin_id: params.magasinId,
    p_client_id: params.clientId,
    p_type_vente: params.typeVente,
    p_date_vente: params.dateVente,
    p_date_echeance: params.dateEcheance || null,
    p_sous_total: params.sousTotal,
    p_remise_pct: params.remisePct,
    p_remise_montant: params.remiseMontant,
    p_tva_pct: params.tvaPct,
    p_tva_montant: params.tvaMontant,
    p_total_ttc: params.totalTtc,
    p_moyen_paiement_id: params.moyenPaiementId || null,
    p_notes: params.notes || null,
    p_montant_paye: params.montantPaye || 0,
    p_lignes_json: params.lignesJson ? JSON.stringify(params.lignesJson) : null,
    p_created_by: params.createdBy || null,
  });
}

export async function spVentesPaiementAdd(params: {
  venteId: number;
  montant: number;
  datePaiement: string;
  moyenPaiementId?: number;
  reference?: string;
  notes?: string;
}) {
  return callSPScalar('sp_ventes_paiement_add', {
    p_vente_id: params.venteId,
    p_montant: params.montant,
    p_date_paiement: params.datePaiement,
    p_moyen_paiement_id: params.moyenPaiementId || null,
    p_reference: params.reference || null,
    p_notes: params.notes || null,
  });
}

export async function spVentesUpdate(id: number, notes?: string, dateEcheance?: string) {
  return callSPScalar('sp_ventes_update', {
    p_id: id,
    p_notes: notes || null,
    p_date_echeance: dateEcheance || null,
  });
}

export async function spVentesCancel(id: number) {
  return callSP('sp_ventes_cancel', { p_id: id });
}

export async function spVentesKpiCaMois(magasinId?: number, typeVente?: string) {
  return callSPScalar('sp_ventes_kpi_ca_mois', {
    p_magasin_id: magasinId || null,
    p_type_vente: typeVente || null,
  });
}

// ─── CLIENTS ─────────────────────────────────────────────

export async function spClientsList(typeClient?: string, statut?: string, search?: string) {
  return callSP('sp_clients_list', {
    p_type_client: typeClient || null,
    p_statut: statut || null,
    p_search: search || null,
  });
}

export async function spClientsGet(id: number) {
  return callSPScalar('sp_clients_get', { p_id: id });
}

export async function spClientsCreate(params: {
  code: string;
  typeClient: string;
  raisonSociale: string;
  contactNom?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  ville?: string;
  plafondCredit?: number;
  delaiPaiement?: number;
}) {
  return callSPScalar('sp_clients_create', {
    p_code: params.code,
    p_type_client: params.typeClient,
    p_raison_sociale: params.raisonSociale,
    p_contact_nom: params.contactNom || null,
    p_telephone: params.telephone || null,
    p_email: params.email || null,
    p_adresse: params.adresse || null,
    p_ville: params.ville || null,
    p_plafond_credit: params.plafondCredit || 0,
    p_delai_paiement: params.delaiPaiement || 0,
  });
}

// ─── CRÉANCES ────────────────────────────────────────────

export async function spCreancesList(categorie?: string, clientId?: number) {
  return callSP('sp_creances_list', {
    p_categorie: categorie || null,
    p_client_id: clientId || null,
  });
}

export async function spCreancesAgeing() {
  return callSPScalar('sp_creances_ageing', {});
}

// ─── PRODUITS ────────────────────────────────────────────

export async function spProduitsList(limit = 100, offset = 0) {
  return callSP('sp_produits_list', {
    p_limit: limit,
    p_offset: offset,
  });
}

// ─── STOCKS ──────────────────────────────────────────────

export async function spStocksGet(produitId: number, magasinId?: number) {
  return callSPScalar('sp_stocks_get', {
    p_produit_id: produitId,
    p_magasin_id: magasinId || null,
  });
}

// ─── PAIEMENTS ───────────────────────────────────────────

export async function spPaiementsCreate(params: {
  venteId: number;
  montant: number;
  datePaiement: string;
  moyenPaiementId?: number;
}) {
  return callSPScalar('sp_paiements_create', {
    p_vente_id: params.venteId,
    p_montant: params.montant,
    p_date_paiement: params.datePaiement,
    p_moyen_paiement_id: params.moyenPaiementId || null,
  });
}

// ─── DASHBOARD ───────────────────────────────────────────

export async function spDashboardKpis(magasinId?: number) {
  return callSPScalar('sp_dashboard_kpis', {
    p_magasin_id: magasinId || null,
  });
}
