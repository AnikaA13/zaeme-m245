import { useState } from 'react';
import type { Account } from './load';
import { useWrite } from '../inventory/writes';

export function WarningDays({
  home,
  owner,
}: {
  home: NonNullable<Account['home']>;
  owner: boolean;
}) {
  const [draft, setDraft] = useState<{ value: string; version: number } | null>(
    null,
  );
  const write = useWrite();
  const valid =
    draft && /^\d{1,2}$/.test(draft.value) && Number(draft.value) <= 30;
  const stale = draft && draft.version !== home.version;
  return (
    <section aria-label="Warnfrist">
      <h2>Warnfrist</h2>
      <p>Warnfrist für Ablaufdaten: {home.warning_days} Tage</p>
      {owner &&
        (draft ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (
                valid &&
                !stale &&
                Number.isSafeInteger(draft.version) &&
                draft.version > 0
              )
                void write.submit(
                  'set_warning_days',
                  {
                    h: home.id,
                    g: home.g,
                    days: Number(draft.value),
                    v: draft.version,
                  },
                  'Warnfrist',
                  'Warnfrist gespeichert.',
                  () => setDraft(null),
                );
            }}
          >
            <label>
              Warnfrist in Tagen
              <input
                inputMode="numeric"
                value={draft.value}
                onChange={(e) => setDraft({ ...draft, value: e.target.value })}
              />
            </label>
            {!valid && (
              <p role="alert">Gib eine ganze Zahl von 0 bis 30 ein.</p>
            )}
            {stale && (
              <p role="alert">
                Der Haushalt hat sich geändert. Prüfe die gespeicherte
                Warnfrist.
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setDraft({ ...draft, version: home.version })}
                >
                  Aktuellen Stand übernehmen
                </button>
              </p>
            )}
            <button
              disabled={
                !valid ||
                !!stale ||
                !Number.isSafeInteger(home.version) ||
                write.blocked('set_warning_days')
              }
            >
              Warnfrist speichern
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setDraft(null)}
            >
              Abbrechen
            </button>
          </form>
        ) : (
          <button
            className="secondary"
            onClick={() =>
              setDraft({
                value: String(home.warning_days),
                version: home.version,
              })
            }
          >
            Warnfrist bearbeiten
          </button>
        ))}
      {write.message && <p role="alert">{write.message}</p>}
    </section>
  );
}
