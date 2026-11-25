import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { FlowError, FormError } from '../../lib/operations/protocol';
export function useAction() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [until, setUntil] = useState(0);
  const lock = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (until) {
      const timer = setTimeout(
        () => setUntil(0),
        Math.max(0, until - Date.now()),
      );
      return () => clearTimeout(timer);
    }
  }, [until]);
  async function run(fn: () => Promise<void>) {
    if (lock.current || until > Date.now()) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      await fn();
    } catch (e) {
      if (mounted.current) {
        setMessage(
          e instanceof FormError
            ? e.message
            : 'Die Verbindung ist unterbrochen. Versuche es erneut.',
        );
        if (e instanceof FlowError && e.seconds)
          setUntil(Date.now() + 1000 * e.seconds);
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return {
    busy: busy || until > Date.now(),
    run,
    feedback: (
      <>
        {busy && <p role="status">Wird verarbeitet …</p>}
        {message && <p role="alert">{message}</p>}
      </>
    ),
  };
}
export function Form({
  submit,
  children,
}: {
  submit: () => void;
  children: ReactNode;
}) {
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        submit();
      }}
    >
      {children}
    </form>
  );
}
export function Password({
  value,
  onChange,
  fresh = false,
  label = 'Passwort',
}: {
  value: string;
  onChange: (v: string) => void;
  fresh?: boolean;
  label?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label>
        {label}
        <input
          required
          type={show ? 'text' : 'password'}
          autoComplete={fresh ? 'new-password' : 'current-password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <button
        className="text-button"
        type="button"
        aria-pressed={show}
        onClick={() => setShow(!show)}
      >
        {label} {show ? 'verbergen' : 'anzeigen'}
      </button>
    </div>
  );
}
