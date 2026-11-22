import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { CheckIcon, PaletteIcon } from "@/components/RoomsIcons";
import { THEMES, type ThemePreference } from "@/theme/themes";
import { useTheme } from "@/theme/ThemeProvider";

const OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: "auto", label: "Match system" },
  ...THEMES.map((theme) => ({ value: theme.id, label: theme.label })),
];

/** Picks one of Conduit's three themes, or follows the system (R-DS-05). */
export function ThemeMenu() {
  const { preference, setPreference } = useTheme();

  return (
    <Menu>
      <MenuButton
        aria-label="Theme"
        title="Theme"
        className="inline-flex size-6 cursor-pointer items-center justify-center rounded-row text-mid data-hover:bg-selection data-hover:text-bright data-open:bg-selection data-open:text-bright"
      >
        <PaletteIcon />
      </MenuButton>

      <MenuItems
        anchor={{ to: "top start", gap: 6 }}
        transition
        className="z-50 min-w-44 origin-bottom-left rounded-card outline-none border border-line bg-panel p-1 shadow-menu transition duration-100 ease-out data-closed:scale-95 data-closed:opacity-0"
      >
        {OPTIONS.map((option) => (
          <MenuItem key={option.value}>
            <button
              type="button"
              onClick={() => setPreference(option.value)}
              className="flex w-full cursor-pointer items-center gap-1.5 rounded-row px-2 py-[5px] text-left text-ui text-mid data-focus:bg-hover data-focus:text-bright"
            >
              <span className="flex w-3 justify-center text-accent">
                {preference === option.value && <CheckIcon size={11} />}
              </span>
              {option.label}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}
