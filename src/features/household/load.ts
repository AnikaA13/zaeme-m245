import { backend } from '../../lib/supabase/client';
export async function loadAccount(user: string, signal: AbortSignal) {
  const db = backend();
  const [profile, member] = await Promise.all([
    db
      .from('profiles')
      .select('display_name,version')
      .eq('id', user)
      .abortSignal(signal)
      .maybeSingle(),
    db
      .from('household_members')
      .select('household_id,generation')
      .eq('user_id', user)
      .abortSignal(signal)
      .maybeSingle(),
  ]);
  if (profile.error || member.error)
    throw new Error('Profil oder Mitgliedschaft konnte nicht geladen werden.');
  if (!member.data) return { profile: profile.data, home: null };
  const h = member.data.household_id;
  // Ein SELECT mit eingebetteten Mitgliedern liefert eine konsistente Haushaltssicht.
  const response = await db
    .from('households')
    .select(
      'id,name,owner_id,version,warning_days,household_members!household_members_household_id_fkey(user_id,generation,profiles!household_members_user_id_fkey(display_name))',
    )
    .eq('id', h)
    .abortSignal(signal)
    .maybeSingle();
  if (response.error)
    throw new Error('Der Haushalt konnte nicht geladen werden.');
  const row = response.data;
  const own = row?.household_members.find((m) => m.user_id === user);
  if (!row || !own || own.generation !== member.data.generation)
    throw new Error(
      'Die Mitgliedschaft hat sich geändert. Lade den aktuellen Stand.',
    );
  return { profile: profile.data, home: { ...row, g: own.generation } };
}
export type Account = Awaited<ReturnType<typeof loadAccount>>;
