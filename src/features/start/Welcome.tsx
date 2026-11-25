import { Link } from 'react-router';
import { intent } from '../auth/intent';
export function Choices({ guest = false }: { guest?: boolean }) {
  return (
    <div className="choices">
      <Link
        className="primary"
        to={guest ? '/auth/register' : '/household/create'}
        onClick={() => intent.set('create')}
      >
        Haushalt erstellen
      </Link>
      <Link className="secondary" to="/join" onClick={() => intent.set('join')}>
        Haushalt beitreten
      </Link>
      {guest && (
        <Link to="/auth/login" onClick={() => intent.clear()}>
          Anmelden
        </Link>
      )}
    </div>
  );
}
export function Welcome() {
  return (
    <>
      <h1>Gemeinsam alles im Blick.</h1>
      <p>
        Wisst, was ihr zu Hause habt, was bald abläuft und was ihr noch
        einkaufen müsst.
      </p>
      <Choices guest />
    </>
  );
}
