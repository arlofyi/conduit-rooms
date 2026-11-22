import { PRODUCT_NAME_MAX_LENGTH, slugifyHandle, uniqueHandle, type Project } from "@rooms/shared";
import { useMemo, useState, type FormEvent } from "react";
import { useRemoveProduct, useSaveProduct } from "@/api/mutations";
import { Badge, Button, Modal, Notice, TextField } from "@/components/ui";
import { ParticipantChecklist, toggleId } from "@/features/workspace/ParticipantChecklist";
import { useKnownHandles } from "@/features/workspace/useKnownHandles";
import { useWorkspace } from "@/features/workspace/useWorkspace";

interface ProductDialogProps {
  open: boolean;
  onClose: () => void;
  /** The product to change. Leave out to make a new one. */
  product?: Project;
  /** Called with the saved product, after the dialog has closed. */
  onSaved?: (product: Project) => void;
}

/**
 * Makes a product, or changes one: its name and which repos are under it.
 * A product is how several repos get one lead that speaks for all of them.
 */
export function ProductDialog({ open, onClose, product, onSaved }: ProductDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={product ? product.displayName : "New product"}>
      {/* Mounted only while open, so every opening starts from the product as it is now. */}
      {open && <ProductForm product={product} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function ProductForm({ product, onClose, onSaved }: Omit<ProductDialogProps, "open">) {
  const { contacts } = useWorkspace();
  const knownHandles = useKnownHandles();
  const { trigger: save, isMutating: isSaving, error, reset } = useSaveProduct(product?.id ?? null);

  const repos = useMemo(
    () => contacts.map((contact) => contact.project).filter((project) => project.kind === "project"),
    [contacts],
  );
  const productNames = useMemo(
    () => new Map(contacts.map(({ project }) => [project.id, project.displayName])),
    [contacts],
  );

  const [name, setName] = useState(product?.displayName ?? "");
  /** Null until you type a handle yourself. Until then it follows the name. */
  const [typedHandle, setTypedHandle] = useState<string | null>(null);
  const [repoIds, setRepoIds] = useState<string[]>(() =>
    product ? repos.filter((repo) => repo.productId === product.id).map((repo) => repo.id) : [],
  );

  const hasName = name.trim().length >= 2;
  const handle = typedHandle ?? (hasName ? uniqueHandle(slugifyHandle(name), knownHandles) : "");
  const canSave = hasName && (product !== undefined || handle.length >= 2) && !isSaving;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;

    try {
      const saved = await save({ name: name.trim(), handle: product ? undefined : handle, repoIds });
      onClose();
      onSaved?.(saved);
    } catch {
      // The sidecar's reason is on screen above the buttons, and the form is as you left it.
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-col">
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-[22px] pb-1">
        <TextField
          label="Name"
          autoFocus={!product}
          value={name}
          placeholder="Arlo"
          maxLength={PRODUCT_NAME_MAX_LENGTH}
          onChange={(event) => {
            setName(event.target.value);
            if (error) reset();
          }}
        />

        {!product && (
          <TextField
            label="Handle"
            prefix="@"
            value={handle}
            placeholder="arlo"
            maxLength={32}
            hint="What you type to tag its lead. It cannot be changed later."
            onChange={(event) => {
              setTypedHandle(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              if (error) reset();
            }}
          />
        )}

        <ParticipantChecklist
          label="Repos under this product"
          options={repos}
          chosenIds={repoIds}
          onToggle={(repoId) => setRepoIds((current) => toggleId(current, repoId))}
          filterPlaceholder="Find a project"
          note={(repo) => {
            const elsewhere = repo.productId && repo.productId !== product?.id ? productNames.get(repo.productId) : null;
            return elsewhere && <Badge>in {elsewhere}</Badge>;
          }}
        />

        <p className="text-note leading-normal text-dim">
          A product gets a lead that speaks for all of its repos and can read every one of them. Each repo keeps its own
          lead, which you can tag in the product's room. A repo is under one product at a time.
        </p>

        {error && <Notice tone="error">{error.message}</Notice>}
        {product && <TakeApart product={product} onDone={onClose} />}
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-2 px-[22px] py-4">
        <Button size="md" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button size="md" variant="primary" type="submit" disabled={!canSave} loading={isSaving}>
          {product ? "Save" : "Create product"}
        </Button>
      </footer>
    </form>
  );
}

/** Taking a product apart takes two clicks, because its room leaves the sidebar with it. */
function TakeApart({ product, onDone }: { product: Project; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const { trigger: remove, isMutating, error } = useRemoveProduct(product.id);

  async function takeApart() {
    try {
      await remove();
      onDone();
    } catch {
      // The reason is shown below.
    }
  }

  if (!confirming) {
    return (
      <Button variant="danger" className="self-start" onClick={() => setConfirming(true)}>
        Take {product.displayName} apart
      </Button>
    );
  }

  return (
    <Notice
      tone={error ? "error" : "warn"}
      actions={
        <>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Keep
          </Button>
          <Button variant="danger" loading={isMutating} onClick={() => void takeApart()}>
            Take apart
          </Button>
        </>
      }
    >
      {error?.message ??
        `${product.displayName} and its room leave the sidebar. Its repos stay, each with its own lead. What was said stays.`}
    </Notice>
  );
}
