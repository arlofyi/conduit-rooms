import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** A roomier dialog, for forms with long text. */
  wide?: boolean;
  children: ReactNode;
}

/**
 * A centred dialog for one focused task (Conduit's .modal). Escape and a
 * click outside close it, and focus stays inside while it is open.
 */
export function Modal({ open, onClose, title, wide = false, children }: ModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-panel/60 transition-opacity duration-150 ease-out data-closed:opacity-0"
      />

      <div className="fixed inset-0 flex items-center justify-center p-6">
        <DialogPanel
          transition
          className={cn(
            "flex max-h-[86vh] w-full flex-col rounded-modal border border-line bg-panel shadow-modal",
            "transition duration-150 ease-settle data-closed:scale-[0.98] data-closed:opacity-0",
            wide ? "max-w-[600px]" : "max-w-[440px]",
          )}
        >
          <DialogTitle className="px-[22px] pb-2 pt-[22px] text-heading font-semibold text-bright">
            {title}
          </DialogTitle>
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
