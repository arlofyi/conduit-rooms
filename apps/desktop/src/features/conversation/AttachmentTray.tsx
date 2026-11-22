import { CloseIcon } from "@/components/Icons";
import { ImageIcon } from "@/components/RoomsIcons";
import { cn } from "@/lib/cn";
import type { ImageAttachments } from "./useImageAttachments";

/**
 * The pictures attached to a message, above its text. The tray opens as the
 * first picture lands and closes behind the last one to leave. Each picture
 * pops in, lifts under the pointer, and shrinks away when removed.
 */
export function AttachmentTray({ images }: { images: ImageAttachments }) {
  const open = images.items.length > 0;

  return (
    // Animating a grid row from 0fr to 1fr is how a box of unknown height is opened smoothly.
    <div
      className={cn(
        "grid transition-[grid-template-rows,margin] duration-200 ease-settle",
        open ? "mb-2 grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      {/* The padding gives the remove buttons, which overhang their pictures, room inside the clipped row. */}
      <ul aria-label="Pictures to send" className="-m-2 flex min-h-0 flex-wrap gap-2 overflow-hidden p-2">
        {images.items.map((image) => (
          <li
            key={image.id}
            className={cn("group relative size-16 shrink-0", image.leaving ? "animate-pop-out" : "animate-pop-in")}
          >
            <img
              src={image.previewUrl}
              alt={image.file.name || "Pasted picture"}
              draggable={false}
              className="size-16 rounded-control border border-line object-cover transition-[transform,box-shadow,border-color] duration-200 ease-settle group-hover:-translate-y-0.5 group-hover:scale-[1.04] group-hover:border-accent-line group-hover:shadow-menu"
            />
            <button
              type="button"
              onClick={() => images.remove(image.id)}
              aria-label={`Remove ${image.file.name || "picture"}`}
              className="absolute -right-1.5 -top-1.5 flex size-[18px] scale-50 cursor-pointer items-center justify-center rounded-full border border-line bg-panel text-mid opacity-0 transition-[opacity,scale,color,border-color] duration-150 ease-settle hover:border-bad/60 hover:text-bad focus-visible:scale-100 focus-visible:opacity-100 active:scale-90 group-hover:scale-100 group-hover:opacity-100"
            >
              <CloseIcon size={9} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Covers the composer while pictures are held over it, to say that letting go here attaches them. */
export function DropHint() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 flex animate-rise-in items-center justify-center gap-2 rounded-composer border border-dashed border-accent bg-panel/85 text-ui font-medium text-accent backdrop-blur-[2px]"
    >
      <ImageIcon className="animate-bob" />
      Drop pictures to attach
    </div>
  );
}
