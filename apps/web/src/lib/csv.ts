// ─── CSV Export Utility ───────────────────────────────────────
// Usage: exportCsv(rows, columns, filename)

export interface CsvColumn<T> {
  header: string;
  value:  (row: T) => string | number | null | undefined;
}

export function exportCsv<T>(
  rows:     T[],
  columns:  CsvColumn<T>[],
  filename: string,
): void {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility

  const escape = (val: string | number | null | undefined): string => {
    if (val == null) return '';
    const str = String(val);
    // Wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const header = columns.map(c => escape(c.header)).join(',');
  const body   = rows.map(row =>
    columns.map(c => escape(c.value(row))).join(',')
  ).join('\n');

  const csv  = BOM + header + '\n' + body;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Colonnes prédéfinies par entité ──────────────────────────

export const CSV_VENTES: CsvColumn<Record<string, unknown>>[] = [
  { header: 'Numéro',    value: r => String(r.numero ?? '') },
  { header: 'Client',    value: r => String(r.client_nom ?? '') },
  { header: 'Type',      value: r => r.type_vente === 'gros' ? 'Gros' : 'Détail' },
  { header: 'Date',      value: r => r.date_vente ? new Date(String(r.date_vente)).toLocaleDateString('fr-FR') : '' },
  { header: 'Total TTC', value: r => Number(r.total_ttc ?? 0) },
  { header: 'Payé',      value: r => Number(r.montant_paye ?? 0) },
  { header: 'Solde',     value: r => Number(r.solde_restant ?? 0) },
  { header: 'Statut',    value: r => String(r.statut_paiement ?? '') },
];

export const CSV_CLIENTS: CsvColumn<Record<string, unknown>>[] = [
  { header: 'Code',           value: r => String(r.code ?? '') },
  { header: 'Raison sociale', value: r => String(r.raison_sociale ?? '') },
  { header: 'Type',           value: r => String(r.type_client ?? '') },
  { header: 'Téléphone',      value: r => String(r.telephone ?? '') },
  { header: 'Email',          value: r => String(r.email ?? '') },
  { header: 'Ville',          value: r => String(r.ville ?? '') },
  { header: 'Statut',         value: r => String(r.statut ?? '') },
  { header: 'CA Total',       value: r => Number(r.ca_total ?? 0) },
  { header: 'Encours',        value: r => Number(r.encours_creance ?? 0) },
];

export const CSV_PRODUITS: CsvColumn<Record<string, unknown>>[] = [
  { header: 'Référence',    value: r => String(r.reference ?? '') },
  { header: 'Désignation',  value: r => String(r.designation ?? '') },
  { header: 'Marque',       value: r => String(r.marque ?? '') },
  { header: 'Catégorie',    value: r => String(r.categorie ?? '') },
  { header: 'Stock',        value: r => Number(r.stock ?? 0) },
  { header: 'Stock alerte', value: r => Number(r.stock_alerte ?? 0) },
  { header: 'Prix achat',   value: r => Number(r.prix_achat ?? 0) },
  { header: 'Prix gros',    value: r => Number(r.prix_gros ?? 0) },
  { header: 'Prix détail',  value: r => Number(r.prix_detail ?? 0) },
];

export const CSV_ACHATS: CsvColumn<Record<string, unknown>>[] = [
  { header: 'Numéro',      value: r => String(r.numero ?? '') },
  { header: 'Fournisseur', value: r => String(r.fournisseur_nom ?? '') },
  { header: 'Date',        value: r => r.date_achat ? new Date(String(r.date_achat)).toLocaleDateString('fr-FR') : '' },
  { header: 'Total TTC',   value: r => Number(r.total_ttc ?? 0) },
  { header: 'Payé',        value: r => Number(r.montant_paye ?? 0) },
  { header: 'Solde',       value: r => Number(r.solde_restant ?? 0) },
  { header: 'Échéance',    value: r => r.date_echeance ? new Date(String(r.date_echeance)).toLocaleDateString('fr-FR') : '' },
  { header: 'Statut',      value: r => String(r.statut_paiement ?? '') },
];

export const CSV_DEPENSES: CsvColumn<Record<string, unknown>>[] = [
  { header: 'Date',       value: r => r.date_paiement ? new Date(String(r.date_paiement)).toLocaleDateString('fr-FR') : '' },
  { header: 'Catégorie',  value: r => String(r.categorie_depense ?? '') },
  { header: 'Montant',    value: r => Number(r.montant ?? 0) },
  { header: 'Moyen',      value: r => String(r.moyen_paiement ?? '') },
  { header: 'Référence',  value: r => String(r.reference ?? '') },
  { header: 'Notes',      value: r => String(r.notes ?? '') },
  { header: 'Récurrence', value: r => String(r.recurrence ?? '') },
];

export const CSV_CREANCES: CsvColumn<Record<string, unknown>>[] = [
  { header: 'Numéro',        value: r => String(r.numero ?? '') },
  { header: 'Client',        value: r => String(r.raison_sociale ?? '') },
  { header: 'Type client',   value: r => String(r.type_client ?? '') },
  { header: 'Date vente',    value: r => r.date_vente ? new Date(String(r.date_vente)).toLocaleDateString('fr-FR') : '' },
  { header: 'Échéance',      value: r => r.date_echeance ? new Date(String(r.date_echeance)).toLocaleDateString('fr-FR') : '' },
  { header: 'Total TTC',     value: r => Number(r.total_ttc ?? 0) },
  { header: 'Payé',          value: r => Number(r.montant_paye ?? 0) },
  { header: 'Solde restant', value: r => Number(r.solde_restant ?? 0) },
  { header: 'Jours retard',  value: r => Number(r.jours_retard ?? 0) },
  { header: 'Catégorie',     value: r => String(r.categorie_echeance ?? '') },
];
