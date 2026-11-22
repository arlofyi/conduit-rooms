import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { PlusIcon } from "@/components/Icons";

interface AddMenuProps {
  onNewRoom: () => void;
  onHireAgent: () => void;
  onNewProduct: () => void;
}

/** The sidebar's one "+": everything you can make, in one place. */
export function AddMenu({ onNewRoom, onHireAgent, onNewProduct }: AddMenuProps) {
  const choices = [
    { label: "New room", hint: "A channel with the leads you choose", run: onNewRoom },
    { label: "Hire agent", hint: "A CTO, a strategist, a researcher", run: onHireAgent },
    { label: "New product", hint: "Several repos under one lead", run: onNewProduct },
  ];

  return (
    <Menu>
      <MenuButton
        aria-label="Add a room, an agent or a product"
        title="Add"
        className="inline-flex size-5 cursor-pointer items-center justify-center rounded-row text-accent transition-[background-color,rotate,scale] duration-200 ease-settle active:scale-90 data-hover:bg-selection data-open:rotate-45 data-open:bg-selection"
      >
        <PlusIcon size={12} />
      </MenuButton>

      <MenuItems
        anchor={{ to: "bottom end", gap: 4 }}
        transition
        className="z-50 w-56 origin-top-right rounded-card border border-line bg-panel p-1 shadow-menu outline-none transition duration-100 ease-out data-closed:scale-95 data-closed:opacity-0"
      >
        {choices.map((choice) => (
          <MenuItem key={choice.label}>
            <button
              type="button"
              onClick={choice.run}
              className="flex w-full cursor-pointer flex-col rounded-row px-2 py-[5px] text-left data-focus:bg-hover"
            >
              <span className="text-ui text-bright">{choice.label}</span>
              <span className="text-label text-dim">{choice.hint}</span>
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}
