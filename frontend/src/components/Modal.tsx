import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Diálogo nativo (<dialog>): foco preso, Esc fecha, clique fora fecha. Renderize condicionalmente. */
export default function Modal({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <div className="dialog-body">
        <h2 id="dialog-title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
