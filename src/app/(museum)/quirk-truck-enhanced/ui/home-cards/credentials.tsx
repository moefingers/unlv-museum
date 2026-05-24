import Link from 'next/link'
import { clickable } from '../button'
import { dashboardCardInner, dashboardCardOuter } from '../skeletons'
import { getUsers } from '../../lib/data'

import UserCredentialSingle from '../user-credential-single'
import { KeyIcon } from '@heroicons/react/24/outline'

export default async function CredentialsCard({session} : {session: any}) {

    const usersData:any = await getUsers(session)

    return  (
        <Link href='/quirk-truck-enhanced/dashboard/credentials'>
            <div
            className={`dashboard-credentials-card font-black ${dashboardCardOuter} ${clickable}`}
            >
                <div className="flex p-2">
                    <div><KeyIcon className="w-6 inline" /> {`View and manage ${(session?.user.admin ? usersData : usersData.filter((user: any) => !user.admin)).length  + (!session?.user.admin ? " non-admin" : "") } accounts`}</div>
                </div>
                <div className={`flex truncate items-start justify-start ${dashboardCardInner}`}>
                    <div className='slider-y flex flex-col slider-vert w-full'>
                        {usersData.map((user: any, index: number) => (
                            <UserCredentialSingle key={index} user={user} session={session} noLink={true}/>
                        ))}
                    </div>
                </div>
            </div>
        </Link>
    )
}