import { auth } from '../../lib/auth-stub';
import { getUsers, getUsersPaginated } from '../../lib/data';
import { LockClosedIcon, LockOpenIcon } from '@heroicons/react/24/outline';
import { User } from '../../lib/definitions';
import UserIcon from '../../ui/account/user-icon';
import { Button } from '../../ui/button';
import UserCredentialSingle from '../../ui/user-credential-single';

import { redirect } from 'next/navigation';
import Search from '../../ui/search';
import Pagination from '../../ui/pagination';
import { auditLogActionLookUp } from '../../lib/definitions';
export default async function CredentialsPage({
    searchParams,
  }: {
    searchParams?: Promise<{
      query?: string;
      page?: string;
      perPage?: string;
      actions?: string;
    }>;
  }) {
    const session: any = await auth();
    if(!session.user.admin && !session.user.role.includes('credential-manager')){redirect('/')}

    const sp = (await searchParams) ?? {};
    const query = sp.query || '';
    const currentPage = Number(sp.page) || 1;
    const perPage = Number(sp.perPage) || 15;
    const actionsFilter = sp.actions || '';


    // const users = await getUsers(session);
    const {users, total} = await getUsersPaginated(session, currentPage, query, actionsFilter, perPage);
    // console.log(total)
    return (
        <div>
            <Search placeholder='Search by email or name...'/>
            {Object.values(users).map((user: any, i: number) => {

                return (
                    <UserCredentialSingle key={i} user={user} session={session}/>
                )

            })}
            <Pagination totalPages={Math.ceil(total / perPage)}/>
        </div>
    );
}