import { useSendMessage } from "@/api/mutations";
import { ComposerBox } from "./ComposerBox";
import type { MentionOption } from "./mentionQuery";
import { useDraft } from "./useDraft";

interface ComposerProps {
  conversationId: string;
  placeholder: string;
  /** Who can be tagged with "@" here. Leave out where tagging does nothing. */
  mentionable?: readonly MentionOption[];
}

/**
 * The composer of a room: a ComposerBox whose text is that room's saved
 * draft (R-UI-37) and whose send goes to that room. You can send while a
 * lead is still replying. The sidecar queues the turn.
 */
export function Composer({ conversationId, placeholder, mentionable }: ComposerProps) {
  const { text, setText, clear } = useDraft(conversationId);
  const { trigger: send, isMutating, error, reset } = useSendMessage(conversationId);

  return (
    <ComposerBox
      text={text}
      onTextChange={setText}
      onSend={async (message) => {
        await send(message);
        clear();
      }}
      isSending={isMutating}
      error={error}
      onClearError={reset}
      placeholder={placeholder}
      mentionable={mentionable}
      focusKey={conversationId}
    />
  );
}
