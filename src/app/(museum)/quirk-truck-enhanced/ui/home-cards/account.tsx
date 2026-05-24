import Link from 'next/link'

import UserIcon from '../account/user-icon'
import { getUser } from '../../lib/data'
import { User } from '../../lib/definitions'
import { toUserTime } from '../../lib/utils'
import { clickable } from '../button'

import { UserIcon as HeroUserIcon } from '@heroicons/react/24/outline'

import { signOut } from '../../lib/auth-stub'

import { dashboardCardOuter, dashboardCardInner } from '../skeletons'
import SignOutButtonSmall from '../sign-out-button-small'

export default async function AccountCard({session} : {session: any}) {
    const fetchedUser = (await getUser(session.user.email)) as User
    // NOTE(museum-port): the original wrapped the whole card in a
    // <Link> with a <form> nested inside — invalid HTML (forms can't
    // descend from anchors) and triggers a hydration warning under
    // React 19. We instead make the card a relative container, place
    // a transparent <Link> as an absolute-positioned overlay that
    // captures clicks on empty regions, and lift the sign-out form
    // above it with z-index so it remains independently clickable.
    return (
        <div className={`relative overflow-hidden ${dashboardCardOuter} ${clickable}`}>
            <Link
                href='/quirk-truck-enhanced/dashboard/account'
                aria-label='Visit account details'
                className='absolute inset-0 z-0'
            />
            <form
                className='absolute right-2 top-2 z-10'
                action={async () => { 'use server'; await signOut(); }}
            >
                <SignOutButtonSmall />
            </form>
            <div className="relative flex justify-between flex-row p-2 pointer-events-none">
                <div className='font-black'><HeroUserIcon className="w-6 inline" /> Visit account details</div>
            </div>
            <div className={`relative flex truncate ${dashboardCardInner} pointer-events-none`}>
                <UserIcon fetchedUser={fetchedUser} isFor={'self'} />
                <div className='flex flex-col'>
                    <div className="ml-2 truncate text-sm font-bold">{fetchedUser.name}</div>
                    <div className="ml-2 truncate text-sm font-medium">{fetchedUser.email}</div>
                    <div className="ml-2 truncate text-sm font-medium">Last Updated at: {toUserTime(fetchedUser.updatedAt)}</div>
                </div>
            </div>
        </div>
    )
}