import { GastosSubNav } from './GastosSubNav';

export default function GastosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <GastosSubNav />
      {children}
    </div>
  );
}
