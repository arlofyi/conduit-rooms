import type { ReactNode } from "react";

/**
 * The window: a fixed sidebar and the centre column (specs/04-interface.md).
 * The participants rail joins on the right when rooms arrive in M2.
 * Each column begins with a strip that drags the window, because the title
 * bar is drawn over the content as it is in Conduit.
 */
export function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-screen w-screen">
      <aside className="flex w-(--sidebar-w) min-w-[200px] shrink-0 flex-col border-r border-line bg-sidebar">
        <div className="drag-region" data-tauri-drag-region />
        {sidebar}
      </aside>

      <main className="flex min-w-[480px] flex-1 flex-col bg-panel">{children}</main>
    </div>
  );
}
