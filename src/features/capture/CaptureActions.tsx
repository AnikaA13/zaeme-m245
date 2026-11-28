import { useCapture } from '../../components/navigation/Navigation';

export function CaptureActions() {
  const capture = useCapture();
  return (
    <div className="choices">
      <button
        id="scan-add"
        onClick={() => capture.open('scan-add', '/capture/scan')}
      >
        Lebensmittel scannen
      </button>
      <button
        className="secondary"
        id="manual-add"
        onClick={() => capture.open('manual-add', '/capture/manual')}
      >
        Manuell hinzufügen
      </button>
    </div>
  );
}

export function CaptureSelection() {
  const capture = useCapture();
  return (
    <>
      <h1>Lebensmittel hinzufügen</h1>
      <CaptureActions />
      <button className="text-button" onClick={capture.cancel}>
        Abbrechen
      </button>
    </>
  );
}

export function ScannerLoading({ failed = false }: { failed?: boolean }) {
  const capture = useCapture();
  return (
    <>
      <h1>Lebensmittel scannen</h1>
      <p role="status">
        {failed
          ? 'Der Scanner konnte nicht geladen werden. Prüfe die Verbindung oder erfasse das Lebensmittel manuell.'
          : 'Scanner wird geladen …'}
      </p>
      <button
        className="secondary"
        onClick={() => capture.open('manual-add', '/capture/manual')}
      >
        Manuell hinzufügen
      </button>
      <button className="text-button" onClick={capture.cancel}>
        Abbrechen
      </button>
    </>
  );
}
