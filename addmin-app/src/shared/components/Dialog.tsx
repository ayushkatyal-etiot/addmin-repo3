import { MouseEvent, ReactNode, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { twJoin } from "tailwind-merge";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  closeOnClickOutside?: boolean;
  /** `center` = viewport-centered overlay; `top` = upper third (legacy default). */
  placement?: "center" | "top";
  /** Extra classes on the native `<dialog>` element. */
  dialogClassName?: string;
  children?: ReactNode;
}

export function Dialog({
  open,
  onClose,
  children,
  closeOnClickOutside = true,
  placement = "top",
  dialogClassName,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(
    function handleShowOrCloseDialog() {
      const dialog = dialogRef.current;
      if (!dialog) return;

      if (open && !dialog.open) {
        dialog.showModal();
      } else if (!open && dialog.open) {
        dialog.close();
      }
    },
    [open],
  );

  const handleClick = useCallback(
    (e: MouseEvent) => {
      const dialog = dialogRef.current;
      if (!closeOnClickOutside || !dialog) return;

      const rect = dialog.getBoundingClientRect();
      const clickedOutside =
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom;

      if (clickedOutside) {
        onClose();
      }
    },
    [closeOnClickOutside, onClose],
  );

  return createPortal(
    <dialog
      ref={dialogRef}
      className={twJoin(
        // Without this, Tailwind `display:flex` keeps a closed <dialog> visible on screen.
        "hidden open:flex",
        placement === "center"
          ? "fixed inset-0 m-0 h-full max-h-none w-full max-w-none items-center justify-center p-0"
          : "top-[20vh] my-0 max-h-[55vh]",
        "bg-transparent backdrop:bg-black/50 backdrop:backdrop-blur-xs",
        dialogClassName,
      )}
      onClose={onClose}
      onClick={handleClick}
    >
      {children}
    </dialog>,
    document.body,
  );
}
