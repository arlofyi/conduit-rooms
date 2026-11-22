import { Description, Field, Input, Label, type InputProps } from "@headlessui/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface TextFieldProps extends Omit<InputProps, "className" | "prefix"> {
  label: string;
  /** Shown inside the box before what you type, such as "#". */
  prefix?: ReactNode;
  /** A line of help under the box. Replaced by the error when there is one. */
  hint?: string;
  error?: string | null;
}

/** A labelled single-line input (Conduit's .ui-input), with room for a hint or an error. */
export function TextField({ label, prefix, hint, error, ...input }: TextFieldProps) {
  return (
    <Field className="flex flex-col gap-1.5">
      <Label className="text-ui font-medium text-bright">{label}</Label>

      <div
        className={cn(
          "flex h-[30px] items-center gap-1 rounded-control border bg-sidebar px-2 transition-colors duration-[120ms]",
          "focus-within:border-accent",
          error ? "border-bad/60" : "border-line hover:border-accent-line",
        )}
      >
        {prefix && <span className="text-ui text-dim">{prefix}</span>}
        <Input
          invalid={Boolean(error)}
          className="min-w-0 flex-1 bg-transparent text-ui text-bright outline-none placeholder:text-dim"
          {...input}
        />
      </div>

      {(error || hint) && (
        <Description className={cn("text-note", error ? "text-bad" : "text-mid")}>{error ?? hint}</Description>
      )}
    </Field>
  );
}
