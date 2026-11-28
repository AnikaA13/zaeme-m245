import { Link, useLocation, useNavigate } from 'react-router';
import { activeScope } from '../../features/auth/session';

const paths = {
  Start: 'M3 11 12 3l9 8M5 10v10h5v-6h4v6h5V10',
  Vorrat: 'M3 4h18v5H3zM5 9v11h14V9M9 13h6',
  Hinzufügen: 'M12 5v14M5 12h14',
  Einkauf: 'm3 4 2 1 3 11h10l3-8H6M9 20h.01M17 20h.01',
  Haushalt:
    'M14 20v-2a5 5 0 0 0-10 0v2M20 20v-2a5 5 0 0 0-4-5M12 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M16 4a3 3 0 0 1 0 6',
};
export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
const origins = new WeakMap<AbortSignal, { path: string; id: string }>();
export function useCapture() {
  const { pathname, search } = useLocation(),
    navigate = useNavigate(),
    signal = activeScope().signal;
  return {
    open(
      id: string,
      to: '/capture' | '/capture/scan' | '/capture/manual' = '/capture',
    ) {
      if (!pathname.startsWith('/capture'))
        origins.set(signal, { path: pathname + search, id });
      void navigate(to);
    },
    cancel() {
      const previous = origins.get(signal);
      void navigate(previous?.path ?? '/', {
        state: { captureFocus: previous?.id ?? 'nav-add' },
      });
    },
  };
}
export function Navigation() {
  const { pathname } = useLocation(),
    capture = useCapture();
  const entries = [
    ['Start', '/'],
    ['Vorrat', '/inventory'],
    ['Hinzufügen', ''],
    ['Einkauf', '/shopping'],
    ['Haushalt', '/household'],
  ] as const;
  return (
    <nav className="bottom-nav" aria-label="Hauptnavigation">
      {entries.map(([label, url]) =>
        url ? (
          <Link
            key={label}
            to={url}
            aria-current={
              pathname === url ||
              (url === '/inventory' && pathname.startsWith(url + '/'))
                ? 'page'
                : undefined
            }
          >
            <Icon name={label} />
            <span>{label}</span>
          </Link>
        ) : (
          <button
            type="button"
            key={label}
            id="nav-add"
            onClick={() => capture.open('nav-add')}
          >
            <Icon name={label} />
            <span>{label}</span>
          </button>
        ),
      )}
    </nav>
  );
}
