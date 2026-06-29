import { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { toast } from '../components/ui';
import { useReferentiels, useReferentielType, useReferentielCRUD } from '../hooks/useReferentiels';
import { ReferentielBadge, ReferentielForm } from '../components/ui/ReferentielSelect';
import { AllReferentiels } from '@storebox/shared';

const REFERENTIEL_TYPES = [
  { key: 'types_clients' as const, label: 'Types de clients' },
  { key: 'statuts_clients' as const, label: 'Statuts clients' },
  { key: 'types_ventes' as const, label: 'Types de ventes' },
  { key: 'statuts_paiements_ventes' as const, label: 'Statuts paiement ventes' },
  { key: 'types_mouvements_stock' as const, label: 'Types mouvements stock' },
  { key: 'canaux_notification' as const, label: 'Canaux notification' },
  { key: 'statuts_notification' as const, label: 'Statuts notification' },
  { key: 'statuts_devis' as const, label: 'Statuts devis' },
  { key: 'types_avoir' as const, label: 'Types avoir' },
  { key: 'statuts_avoir' as const, label: 'Statuts avoir' },
  { key: 'statuts_reception' as const, label: 'Statuts réception' },
  { key: 'types_paiement' as const, label: 'Types paiement' },
];

export default function AdminReferentielsPage() {
  const { data: allReferentiels, loading: loadingAll } = useReferentiels();
  const [selectedType, setSelectedType] = useState<keyof AllReferentiels>('types_clients');
  const [reloadVersion, setReloadVersion] = useState(0);
  const { items, loading: loadingItems, error } = useReferentielType(selectedType, reloadVersion);
  const { create, update, delete: delete_, loading: loadingCRUD, error: errorCRUD } = useReferentielCRUD(selectedType, () => {
    setReloadVersion(v => v + 1);
  });

  const handleAdd = async (code: string, libelle: string) => {
    const result = await create(code, libelle);
    if (result) {
      toast('Référentiel créé', 'success');
    } else {
      toast(errorCRUD || 'Erreur création', 'error');
    }
  };

  const handleEdit = async (id: number, updates: any) => {
    const result = await update(id, updates);
    if (result) {
      toast('Référentiel modifié', 'success');
    } else {
      toast(errorCRUD || 'Erreur modification', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce référentiel ?')) return;
    const result = await delete_(id);
    if (result) {
      toast('Référentiel supprimé', 'success');
    } else {
      toast(errorCRUD || 'Erreur suppression', 'error');
    }
  };

  return (
    <div>
      <PageHeader 
        title="Gestion des Référentiels"
        subtitle="Gérez les listes de référence utilisées dans l'application"
      />

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        
        {/* Vue d'ensemble */}
        {allReferentiels && !loadingAll && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4">Vue d'ensemble</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {REFERENTIEL_TYPES.map((ref) => {
                const count = (allReferentiels[ref.key] || []).length;
                return (
                  <div key={ref.key} className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedType(ref.key)}>
                    <h3 className="font-medium text-sm">{ref.label}</h3>
                    <p className="text-2xl font-bold text-blue-600">{count}</p>
                    <p className="text-xs text-gray-500">référentiels</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Gestion détaillée */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Gestion détaillée</h2>
          
          {/* Sélecteur de type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sélectionner un référentiel
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as keyof AllReferentiels)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {REFERENTIEL_TYPES.map((ref) => (
                <option key={ref.key} value={ref.key}>
                  {ref.label}
                </option>
              ))}
            </select>
          </div>

          {/* Gestion des items */}
          {loadingItems ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Chargement...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
              {error}
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-4 text-gray-700">
                  {items.length} élément(s)
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200">
                      <div className="flex-1">
                        <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded mr-2">{item.code}</span>
                        <span className="text-gray-700">{item.libelle}</span>
                        {item.couleur && (
                          <span className="ml-3">
                            <ReferentielBadge type={selectedType} code={item.code} />
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={loadingCRUD}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                      >
                        ✕ Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formulaire d'ajout */}
              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4">Ajouter un nouvel élément</h3>
                <ReferentielForm
                  type={selectedType}
                  items={items}
                  onAdd={handleAdd}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  loading={loadingCRUD}
                />
              </div>
            </>
          )}
        </div>

        {/* Exemples d'utilisation */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-bold mb-4 text-blue-900">Comment utiliser</h2>
          <div className="space-y-3 text-sm text-blue-800">
            <p>
              <strong>Dans vos composants :</strong>
            </p>
            <pre className="bg-white p-3 rounded border border-blue-200 text-xs overflow-x-auto">
{`import { ReferentielSelect } from '../components/ui/ReferentielSelect';

<ReferentielSelect
  type="types_clients"
  value={clientType}
  onChange={setClientType}
  label="Type de client"
  required
/>`}
            </pre>
            <p className="mt-4">
              <strong>Pour charger les données programmatiquement :</strong>
            </p>
            <pre className="bg-white p-3 rounded border border-blue-200 text-xs overflow-x-auto">
{`import { useReferentielType } from '../hooks/useReferentiels';

const { items } = useReferentielType('types_clients');
// items = [{ id, code, libelle, ... }]`}
            </pre>
          </div>
        </div>

      </div>
    </div>
  );
}
