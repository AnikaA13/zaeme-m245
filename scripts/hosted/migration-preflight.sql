-- Nur Kataloge lesen. Im selben Zugang wie für den Migrationslauf ausführen.
-- Projekt-Ref und Organisation vor der Verbindung separat kontrollieren.
select current_database() as datenbank, session_user as anmeldung,
       current_user as wirksame_rolle, current_setting('server_version') as pg_version,
       r.rolsuper, r.rolcreaterole,
       has_database_privilege(current_database(), 'CREATE') as schema_anlegen,
       has_schema_privilege('public', 'CREATE') as public_anlegen,
       has_schema_privilege('auth', 'USAGE WITH GRANT OPTION') as auth_usage_weitergeben,
       has_column_privilege('auth.users', 'id', 'SELECT') as auth_id_lesen,
       has_column_privilege('auth.users', 'email_confirmed_at', 'SELECT') as bestaetigung_lesen,
       has_column_privilege('auth.users', 'id', 'REFERENCES') as auth_fremdschluessel,
       has_column_privilege('auth.users', 'id', 'SELECT WITH GRANT OPTION') as id_weitergebbar,
       has_column_privilege('auth.users', 'email_confirmed_at', 'SELECT WITH GRANT OPTION') as bestaetigung_weitergebbar,
       has_table_privilege('auth.users', 'SELECT WITH GRANT OPTION') as tabelle_weitergebbar,
       to_regprocedure('pg_catalog.sha256(bytea)') is not null as sha256,
       to_regprocedure('pg_catalog.gen_random_uuid()') is not null as zufalls_uuid,
       to_regnamespace('private') is not null as private_vorhanden,
       to_regrole('zaeme_reader') is not null as leser_vorhanden,
       to_regrole('zaeme_writer') is not null as schreiber_vorhanden,
       to_regclass('supabase_migrations.schema_migrations') is not null as journal_vorhanden
from pg_roles r where r.rolname = current_user;
