import CredentialsNav from './credentials-nav';
import { auth } from '../../lib/auth-stub';

export const experimental_ppr = true;

export default async function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col">
      <div className="w-full flex-none">
        <CredentialsNav session={await auth()} />
      </div>
      <div className="grow overflow-y-auto p-6">{children}</div>
    </div>
  );
}