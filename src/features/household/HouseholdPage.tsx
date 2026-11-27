import { useState } from 'react';
import { Link } from 'react-router';
import { useAction } from '../../components/ui/Forms';
import { mutate } from '../../lib/operations/rpc';
import { ProfileForm } from './Onboarding';
import { Invites } from './Invites';
import type { Account } from './load';
export function HouseholdPage({
  account,
  user,
}: {
  account: Account;
  user: string;
}) {
  const home = account.home!;
  const owner = home.owner_id === user;
  const action = useAction(),
    [edit, setEdit] = useState(false);
  const context = { h: home.id, g: home.g };
  return (
    <>
      <Link to="/">Zur Startseite</Link>
      <h1>{home.name}</h1>
      <section>
        <h2>Mitglieder</h2>
        <ul>
          {home.household_members.map((m) => (
            <li key={m.generation}>
              <strong>{m.profiles.display_name}</strong>
              <span>
                {[
                  m.user_id === user ? 'Du' : '',
                  m.user_id === home.owner_id ? 'Eigentümer:in' : 'Mitglied',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              {owner && m.user_id !== user && (
                <button
                  className="secondary"
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(async () => {
                      if (
                        window.confirm(
                          m.profiles.display_name +
                            ' aus diesem Haushalt entfernen?',
                        )
                      )
                        await mutate('remove_member', {
                          ...context,
                          target: m.user_id,
                          target_g: m.generation,
                        });
                    })
                  }
                >
                  {m.profiles.display_name} entfernen
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <button className="secondary" onClick={() => setEdit(!edit)}>
        {edit ? 'Profil schliessen' : 'Anzeigenamen bearbeiten'}
      </button>
      {edit && <ProfileForm key={account.profile?.version} account={account} />}
      <p>Warnfrist für Ablaufdaten: {home.warning_days} Tage</p>
      {owner && <Invites {...context} />}
      {(!owner || home.household_members.length === 1) && (
        <button
          className="danger"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              const prompt = owner
                ? 'Haushalt «' +
                  home.name +
                  '» endgültig auflösen? Dein Konto bleibt bestehen.'
                : 'Haushalt «' +
                  home.name +
                  '» verlassen? Du verlierst den Zugriff.';
              if (window.confirm(prompt))
                await mutate(owner ? 'dissolve_household' : 'leave_household', {
                  ...context,
                  confirm: true,
                });
            })
          }
        >
          {owner ? 'Haushalt auflösen' : 'Haushalt verlassen'}
        </button>
      )}
      {action.feedback}
    </>
  );
}
