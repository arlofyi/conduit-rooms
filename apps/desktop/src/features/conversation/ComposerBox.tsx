import { Textarea } from "@headlessui/react";
import { MESSAGE_MAX_LENGTH } from "@rooms/shared";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { ArrowUpIcon } from "@/components/Icons";
import { ImageIcon } from "@/components/RoomsIcons";
import { Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";
import { AttachmentTray, DropHint } from "./AttachmentTray";
import { IMAGE_ACCEPT, type ImageAttachments } from "./useImageAttachments";
import { MentionMenu } from "./MentionMenu";
import type { MentionOption } from "./mentionQuery";
import { useMentionPicker } from "./useMentionPicker";

/** The input grows from one line to eight, then scrolls inside itself (R-UI-32). */
const MAX_LINES = 8;
const LINE_HEIGHT_PX = 15 * 1.55;

const NOBODY: readonly MentionOption[] = [];

interface ComposerBoxProps {
  text: string;
  onTextChange: (text: string) => void;
  /**
   * Sends the trimmed text, along with whatever pictures `images` holds.
   * Resolve when it is sent, reject to keep everything in the box.
   */
  onSend: (text: string) => Promise<unknown>;
  isSending: boolean;
  /** Why the last send failed, shown beneath the box (R-UI-31). */
  error?: Error | null;
  /** Called when you start typing again after a failed send. */
  onClearError?: () => void;
  placeholder: string;
  disabled?: boolean;
  /** Who can be tagged with "@" here. Leave out where tagging does nothing. */
  mentionable?: readonly MentionOption[];
  /**
   * The pictures attached to this message. Pass it where pictures can be
   * sent, and the box takes them by button, by paste and by drop. Leave it
   * out where they cannot.
   */
  images?: ImageAttachments;
  /** Changes when the box should take focus again, such as on switching conversation. */
  focusKey: string;
}

/**
 * The text box you write in, wherever that is: a room, or a session. It owns
 * the keys (Enter sends, Shift+Enter starts a new line, R-UI-34), the growing
 * height, the "@" picker, and the taking in of pictures. What sending means
 * is the caller's business.
 */
export function ComposerBox({
  text,
  onTextChange,
  onSend,
  isSending,
  error = null,
  onClearError,
  placeholder,
  disabled = false,
  mentionable = NOBODY,
  images,
  focusKey,
}: ComposerBoxProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const [caret, setCaret] = useState(0);
  /** Where to put the caret after the next render, once inserted text is in the box. */
  const pendingCaret = useRef<number | null>(null);
  const menuId = useId();

  const picker = useMentionPicker({
    text,
    caret,
    options: mentionable,
    onInsert: (nextText, nextCaret) => {
      pendingCaret.current = nextCaret;
      onTextChange(nextText);
      setCaret(nextCaret);
    },
  });

  const attached = images?.items ?? [];
  const canSend = (text.trim().length > 0 || attached.length > 0) && !isSending && !disabled;
  const canAttach = images !== undefined && !disabled;

  useAutoGrow(inputRef, text);
  useEffect(() => inputRef.current?.focus(), [focusKey]);

  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    inputRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [text]);

  async function submit() {
    if (!canSend) return;

    try {
      await onSend(text.trim());
    } catch {
      // The caller shows why through `error`, and the text is still in the box.
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter while an input method is composing picks a candidate. It must do nothing else.
    if (event.nativeEvent.isComposing) return;

    if (picker.handleKey(event)) {
      event.preventDefault();
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  /** A paste that carries pictures attaches them. Any other paste is left to the text box. */
  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files);
    if (!canAttach || files.length === 0) return;

    event.preventDefault();
    images.add(files);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    if (!canAttach) return;

    event.preventDefault();
    setDraggingOver(false);
    images.add(Array.from(event.dataTransfer.files));
  }

  const activeOption = picker.matches?.[picker.highlighted];

  return (
    <div className="shrink-0 px-5 pb-4 pt-3">
      <div className="relative mx-auto w-full max-w-[720px]">
        {picker.matches && (
          <MentionMenu
            id={menuId}
            options={picker.matches}
            highlighted={picker.highlighted}
            onPick={picker.pick}
          />
        )}

        <div
          onDragOver={(event) => {
            if (!canAttach) return;
            event.preventDefault();
            setDraggingOver(true);
          }}
          onDragLeave={() => setDraggingOver(false)}
          onDrop={onDrop}
          className={cn(
            "rounded-composer border bg-selection/40 py-2 pl-3.5 pr-2",
            "transition-[border-color,background-color,box-shadow] duration-300",
            "focus-within:border-accent focus-within:bg-selection/60 focus-within:shadow-composer",
            draggingOver ? "border-accent bg-accent-wash" : error ? "border-bad/50" : "border-line/60",
          )}
        >
          {images && <AttachmentTray images={images} />}
          {draggingOver && <DropHint />}

          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              rows={1}
              value={text}
              maxLength={MESSAGE_MAX_LENGTH}
              placeholder={placeholder}
              disabled={disabled}
              aria-label={placeholder}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "composer-error" : undefined}
              aria-controls={picker.matches ? menuId : undefined}
              aria-activedescendant={activeOption ? `${menuId}-${activeOption.handle}` : undefined}
              onChange={(event) => {
                onTextChange(event.target.value);
                setCaret(event.target.selectionStart);
                if (error) onClearError?.();
              }}
              onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              className="min-w-0 flex-1 resize-none bg-transparent py-[5px] text-composer leading-[1.55] text-bright outline-none placeholder:text-mid disabled:cursor-not-allowed"
            />

            {images && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  multiple
                  hidden
                  onChange={(event) => {
                    images.add(Array.from(event.target.files ?? []));
                    // Cleared, so choosing the same file again is still a change.
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={!canAttach}
                  aria-label="Attach pictures"
                  title="Attach pictures. You can also paste or drop them."
                  className="group/attach flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full text-mid transition-[color,background-color,scale] duration-150 hover:bg-selection hover:text-bright active:scale-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ImageIcon className="transition-transform duration-200 ease-settle group-hover/attach:-rotate-6 group-hover/attach:scale-110" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSend}
              aria-label="Send"
              title="Send"
              className={cn(
                // The button grows into place when there is something to send, and gives under a press.
                "flex size-[34px] shrink-0 items-center justify-center rounded-full transition-[color,background-color,box-shadow,scale] duration-200 ease-settle",
                canSend
                  ? "cursor-pointer bg-accent text-panel shadow-send hover:scale-105 hover:bg-accent-pressed active:scale-90"
                  : "scale-90 bg-selection text-mid",
              )}
            >
              {isSending ? <Spinner size={14} className="text-mid" /> : <ArrowUpIcon size={15} />}
            </button>
          </div>
        </div>

        {images?.problem && (
          // Keyed by what it says, so a second refusal shakes its head again.
          <p key={images.problem} role="alert" className="mt-1.5 animate-nudge select-text px-3.5 text-note text-warn">
            {images.problem}
          </p>
        )}

        {error && (
          <p id="composer-error" role="alert" className="mt-1.5 select-text px-3.5 text-note text-bad">
            Your message was not sent. {error.message}
          </p>
        )}
      </div>
    </div>
  );
}

/** Sizes the textarea to its content, up to MAX_LINES. */
function useAutoGrow(ref: React.RefObject<HTMLTextAreaElement | null>, text: string) {
  useLayoutEffect(() => {
    const input = ref.current;
    if (!input) return;

    const maxHeight = Math.round(MAX_LINES * LINE_HEIGHT_PX) + 10;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
    input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [ref, text]);
}
