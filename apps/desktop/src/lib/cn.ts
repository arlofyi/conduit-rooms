type ClassValue = string | false | null | undefined;

/** Joins class names, skipping the falsy ones: cn("row", selected && "bg-selection"). */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
