import Link from "next/link";
import { LockClosedIcon, LockOpenIcon } from '@heroicons/react/24/outline'
import UserIcon from './account/user-icon'

export default function UserCredentialSingle({user, session, noLink} : any) {

    // When `noLink` is true the parent owns navigation (the dashboard
    // home wraps the entire CredentialsCard in a single Link to
    // /dashboard/credentials). Rendering an inner <a> would nest
    // anchors and trip React's hydration check.
    const itemClass = `flex flex-row h-[48px] grow items-center justify-center gap-2 rounded-md bg-gray-50 p-3 my-3 text-sm font-medium ${session?.user.admin ? `hover:bg-sky-100 hover:text-blue-600` : (!user?.admin ? `hover:bg-sky-100 hover:text-blue-600` : "cursor-default")}`;
    const inner = (
        <>
            <UserIcon fetchedUser={user} isFor={user.email} className='inline w-12'/>
            <div className='flex flex-col'>
                <div>{user.name}</div>
                <div>{user.email} ({ user.admin ? "admin" : "user"}) {
                    user.admin  // target user admin
                        ? session?.user.admin // and session is admin
                            ? <LockOpenIcon className='inline w-6'/>
                            : <LockClosedIcon className='inline w-6'/>
                        : null
                }</div>
            </div>
        </>
    );

    if (noLink) {
        return <div className={itemClass}>{inner}</div>;
    }
    return (
        <Link
            className={itemClass}
            href={(user.admin && !session?.user.admin) ? "" : `/quirk-truck-enhanced/dashboard/credentials/${user.id}`}
        >
            {inner}
        </Link>
    )
}