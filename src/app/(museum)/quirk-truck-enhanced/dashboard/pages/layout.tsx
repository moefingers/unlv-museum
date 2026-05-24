import PagesNav from './pages-nav';
// import { getPageKeys } from '../../lib/data';
import { CustomSession } from '../../lib/definitions';
import { auth } from '../../lib/auth-stub';

export const experimental_ppr = true;

export default async function PagesLayout({ children }: { children: React.ReactNode }) {
  const session: any | CustomSession = await auth();
  return (
    <div className="flex flex-col">
      <div className="w-full flex-none">
        {(session.user?.role.includes('page-manager') || session.user?.admin) && 
          <PagesNav session={session} />
        }
      </div>
      <div className="grow overflow-y-auto p-2">{children}</div>
    </div>
  );
}
