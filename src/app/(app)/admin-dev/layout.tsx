import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Panel Admin Developer — MineOS',
};

export default function AdminDevLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
