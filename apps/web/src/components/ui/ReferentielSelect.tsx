import React from 'react';
import { Referentiel, AllReferentiels } from '@storebox/shared';
import { useReferentielType } from '../../hooks/useReferentiels';

interface ReferentielSelectProps {
  type: keyof AllReferentiels;
  value?: string | number;
  onChange: (value: string | number) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * Composant pour sélectionner un item d'un référentiel
 * Charge dynamiquement les options depuis l'API
 */
export function ReferentielSelect({
  type,
  value,
  onChange,
  label,
  placeholder = 'Sélectionner...',
  disabled = false,
  required = false,
  className = '',
}: ReferentielSelectProps) {
  const { items, loading, error } = useReferentielType(type);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? (isNaN(+e.target.value) ? e.target.value : +e.target.value) : '')}
        disabled={disabled || loading}
        required={required}
        className={`px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
          disabled ? 'bg-gray-100 text-gray-500' : 'bg-white'
        } ${error ? 'border-red-500' : 'border-gray-300'}`}
      >
        <option value="">{loading ? 'Chargement...' : placeholder}</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.libelle}
          </option>
        ))}
      </select>
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  );
}

interface ReferentielBadgeProps {
  type: keyof AllReferentiels;
  code?: string;
  className?: string;
}

/**
 * Composant pour afficher un badge avec la couleur du référentiel
 */
export function ReferentielBadge({ type, code, className = '' }: ReferentielBadgeProps) {
  const { items } = useReferentielType(type);
  const item = items.find((i) => i.code === code);

  if (!item) return <span className="text-gray-500">—</span>;

  const colorMap: Record<string, string> = {
    green: 'bg-green-100 text-green-800 border-green-300',
    red: 'bg-red-100 text-red-800 border-red-300',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    orange: 'bg-orange-100 text-orange-800 border-orange-300',
    blue: 'bg-blue-100 text-blue-800 border-blue-300',
    purple: 'bg-purple-100 text-purple-800 border-purple-300',
    gray: 'bg-gray-100 text-gray-800 border-gray-300',
  };

  const bgClass = colorMap[item.couleur || 'gray'] || colorMap.gray;

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${bgClass} ${className}`}>
      {item.libelle}
    </span>
  );
}

interface ReferentielFormProps {
  type: keyof AllReferentiels;
  items: Referentiel[];
  onAdd: (code: string, libelle: string) => Promise<void>;
  onEdit: (id: number, updates: Partial<Referentiel>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  loading?: boolean;
}

/**
 * Composant pour gérer les items d'un référentiel (CRUD complet)
 */
export function ReferentielForm({
  items,
  onAdd,
  onEdit,
  onDelete,
  loading = false,
}: ReferentielFormProps) {
  const [newCode, setNewCode] = React.useState('');
  const [newLibelle, setNewLibelle] = React.useState('');
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editingLibelle, setEditingLibelle] = React.useState('');
  const [codeError, setCodeError] = React.useState<string | null>(null);

  // Valider que le code n'existe pas déjà
  const isCodeDuplicate = (code: string) => items.some(i => i.code === code.toLowerCase().trim());

  const handleAdd = async () => {
    const trimmedCode = newCode.toLowerCase().trim();
    const trimmedLibelle = newLibelle.trim();
    
    if (!trimmedCode || !trimmedLibelle) {
      setCodeError('Code et libellé sont requis');
      return;
    }

    if (isCodeDuplicate(trimmedCode)) {
      setCodeError(`Le code "${trimmedCode}" existe déjà`);
      return;
    }

    setCodeError(null);
    await onAdd(trimmedCode, trimmedLibelle);
    setNewCode('');
    setNewLibelle('');
  };

  const handleEdit = async (id: number) => {
    if (editingLibelle.trim()) {
      await onEdit(id, { libelle: editingLibelle.trim() });
      setEditingId(null);
      setEditingLibelle('');
    }
  };

  return (
    <div className="space-y-4">
      {codeError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {codeError}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          type="text"
          placeholder="Code"
          value={newCode}
          onChange={(e) => {
            setNewCode(e.target.value);
            if (codeError) setCodeError(null);
          }}
          disabled={loading}
          className={`px-3 py-2 border rounded-md ${codeError && newCode ? 'border-red-300' : 'border-gray-300'}`}
        />
        <input
          type="text"
          placeholder="Libellé"
          value={newLibelle}
          onChange={(e) => setNewLibelle(e.target.value)}
          disabled={loading}
          className="px-3 py-2 border border-gray-300 rounded-md"
        />
        <button
          onClick={handleAdd}
          disabled={loading || !newCode.trim() || !newLibelle.trim() || isCodeDuplicate(newCode)}
          className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:bg-gray-300"
        >
          Ajouter
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 p-2 border rounded-md">
            {editingId === item.id ? (
              <>
                <input
                  type="text"
                  value={editingLibelle}
                  onChange={(e) => setEditingLibelle(e.target.value)}
                  className="flex-1 px-2 py-1 border rounded"
                />
                <button
                  onClick={() => handleEdit(item.id)}
                  disabled={loading}
                  className="px-3 py-1 text-sm bg-green-500 text-white rounded"
                >
                  Valider
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="px-3 py-1 text-sm bg-gray-400 text-white rounded"
                >
                  Annuler
                </button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <span className="font-medium">{item.code}</span>
                  <span className="mx-2">—</span>
                  <span>{item.libelle}</span>
                </div>
                <button
                  onClick={() => {
                    setEditingId(item.id);
                    setEditingLibelle(item.libelle);
                  }}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded"
                >
                  Éditer
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  disabled={loading}
                  className="px-3 py-1 text-sm bg-red-500 text-white rounded disabled:bg-gray-300"
                >
                  Supprimer
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
