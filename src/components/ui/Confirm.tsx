import { useEffect, useRef } from 'react';
export function Confirm({
  title,
  description,
  action,
  cancel,
  confirm,
}: {
  title: string;
  description: string;
  action: string;
  cancel: () => void;
  confirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current,
      origin = document.activeElement;
    el?.showModal();
    return () => {
      el?.close();
      if (origin instanceof HTMLElement && origin.isConnected) origin.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-description"
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
    >
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-description">{description}</p>
      <div className="choices">
        <button autoFocus className="secondary" onClick={cancel}>
          Abbrechen
        </button>
        <button onClick={confirm}>{action}</button>
      </div>
    </dialog>
  );
}
