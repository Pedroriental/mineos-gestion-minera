'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { isNominaWorkspacePath } from '@/lib/mobile-nav';
import { MobileHotbar } from './MobileHotbar';

type ViewStack = { id: string; title: string }[];

type MobileShellContext = {
  pushView: (id: string, title: string) => void;
  popView: () => void;
  viewStack: ViewStack;
};

const Ctx = createContext<MobileShellContext | null>(null);

export function useMobileShell() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMobileShell must be inside MobileShell');
  return ctx;
}

type MobileShellProps = {
  header: ReactNode;
  children: ReactNode;
};

export function MobileShell({ header, children }: MobileShellProps) {
  const pathname = usePathname();
  const hideGlobalHotbar = isNominaWorkspacePath(pathname);
  const [viewStack, setViewStack] = useState<ViewStack>([]);

  const pushView = useCallback((id: string, title: string) => {
    setViewStack((prev) => [...prev, { id, title }]);
  }, []);

  const popView = useCallback(() => {
    setViewStack((prev) => prev.slice(0, -1));
  }, []);

  return (
    <Ctx.Provider value={{ pushView, popView, viewStack }}>
      <div className="mobile-shell flex h-[100dvh] max-w-full flex-col overflow-hidden overflow-x-clip">
        {header}
        <main
          className="mobile-shell__content min-h-0 min-w-0 max-w-full flex-1 overflow-x-clip overflow-y-auto overscroll-y-auto overscroll-x-none"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </main>
        {!hideGlobalHotbar ? <MobileHotbar /> : null}
      </div>
    </Ctx.Provider>
  );
}
