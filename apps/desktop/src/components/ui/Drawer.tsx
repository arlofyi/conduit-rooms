import { CloseButton, Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CloseIcon } from "../Icons";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** A second line under the title. */
  subtitle?: ReactNode;
  /** Takes most of the window, for something that needs room: a whole page. */
  wide?: boolean;
  children: ReactNode;
}

/**
 * A panel that slides in from the right edge (Conduit's .session-drawer).
 * Escape and a click outside both close it, and focus is held inside while
 * it is open.
 */
export function Drawer({ open, onClose, title, subtitle, wide = false, children }: DrawerProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-panel/40 transition-opacity duration-150 ease-out data-closed:opacity-0"
      />

      <div className={cn("fixed inset-y-0 right-0 flex max-w-[92%]", wide ? "w-[min(1040px,78vw)]" : "w-(--drawer-w)")}>
        <DialogPanel
          transition
          className="flex w-full flex-col border-l border-line bg-sidebar text-bright shadow-drawer transition duration-200 ease-settle data-closed:translate-x-4 data-closed:opacity-0"
        >
          <header className="flex items-center gap-2.5 border-b border-line px-3 py-2.5 pt-[calc(var(--titlebar-h)+2px)]">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-title font-medium">{title}</DialogTitle>
              {subtitle && <p className="truncate text-badge text-mid">{subtitle}</p>}
            </div>
            <CloseButton
              aria-label="Close"
              title="Close"
              className="inline-flex size-6 cursor-pointer items-center justify-center rounded-row text-mid data-hover:bg-selection data-hover:text-bright"
            >
              <CloseIcon size={13} />
            </CloseButton>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
