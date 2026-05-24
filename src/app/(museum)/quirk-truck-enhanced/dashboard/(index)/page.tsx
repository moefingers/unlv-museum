
import { lusitana } from '../../ui/fonts';
import { Suspense } from 'react';

import { auth } from '../../lib/auth-stub';
import { getPages } from '../../lib/data';

import Image from 'next/image'

import { UserCircleIcon } from '@heroicons/react/24/outline';

import AccountCard from '../../ui/home-cards/account';
import AuditLogsCard from '../../ui/home-cards/audit-logs';
import CredentialsCard from '../../ui/home-cards/credentials';
import PagesCard from '../../ui/home-cards/pages';
import WorkOrdersCard from '../../ui/home-cards/work-orders';
import { CardSkeleton } from '../../ui/skeletons';

export default async function Page() {
  const session: any = await auth();
  
  return (
    <main>
      <div className="p-4 grid grid-cols-1 gap-4   md:grid-cols-2 ">
        
        <Suspense fallback={<CardSkeleton/>}>
          <AccountCard  session={session}/>
        </Suspense>

        <Suspense fallback={<CardSkeleton/>}>
          <PagesCard  session={session}/>
        </Suspense>

        {(session?.user.admin || session?.user.role.includes('credential-manager')) && (
        <Suspense fallback={<CardSkeleton/>}>
          <CredentialsCard session={session} />
        </Suspense>)}

        <Suspense fallback={<CardSkeleton/>}>
          <WorkOrdersCard session={session}/>
        </Suspense>

        {(session?.user.admin || session?.user.role.includes('view-audit-logs')) && (
        <Suspense fallback={<CardSkeleton/>}>
          <AuditLogsCard session={session}/>
        </Suspense>)}
      </div>
    </main>
  );
}
