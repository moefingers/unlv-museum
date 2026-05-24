

import { getUser } from '../../lib/data';
import { auth } from '../../lib/auth-stub';

import Image from 'next/image'
import { LockClosedIcon, UserCircleIcon, KeyIcon, AtSymbolIcon, UserIcon as HeroUserIcon} from '@heroicons/react/24/outline';

import UserIcon from '../../ui/account/user-icon'
import Field from '../../ui/account/field'
import PasswordField from '../../ui/account/password-field'
import PrivilegesForm from '../../ui/account/privileges-form'
import UploadImageForm from '../../ui/account/upload-image-form'
import { toUserTime } from '../../lib/utils';
import { roleLookUp } from '../../lib/definitions';

export default async function AccountPage({isFor = "self"}:{isFor: "self" | string | undefined}) {

    const session: any = await auth();
    const fetchedUser: any =
    isFor == "self"
        ? await getUser(session?.user?.email)
        : await getUser(isFor);

    const fetchedAdmin = (session?.user.email != isFor) ? await getUser(session?.user?.email) : null
    // console.log('fetchedadmin', fetchedAdmin)
    const avatarSource = fetchedUser?.img != null
    ? "Using picture from  upload." 
    : (
        fetchedUser?.sso
        ? "Using picture from single-sign-on (ie google) account." 
        : "No photo.. upload one or enroll in SSO to automatically get one."
    );
    // console.log(fetchedUser)
    // console.log(session)
    return (
        <div>
            <UserIcon fetchedUser={fetchedUser as any} isFor={isFor}/>
            <UploadImageForm session={session} fetchedUser={fetchedUser as any}/>
            <div>{avatarSource}</div>
            <div>Email: {fetchedUser?.email}</div>
            <Field
                field="name"
                label="Name:"
                type='text'
                value={fetchedUser?.name} 
                placeholder="Enter your name." 
                targetEmail={(fetchedUser as any)?.email}
                editable={session?.user.admin || session?.user.role?.includes("change-name")}
                renderIcon={<HeroUserIcon  className="w-6 pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900"/>}
            />

            <Field
                field="email"
                label="Email:"
                type='email'
                value={fetchedUser?.email} 
                placeholder="Enter your email."
                noteOnEdit={fetchedUser?.sso ? "DANGER: Changing your email while SSO is enabled will cause you will need access to the login of that authentication method (Example: Google) to access your account again." : undefined}
                targetEmail={(fetchedUser as any)?.email}
                editable={true}
                renderIcon={<AtSymbolIcon  className="w-6 pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900"/>}
            />
            <PasswordField ssoValue={(fetchedUser as any)?.sso} passwordValue={fetchedUser?.password} targetEmail={(fetchedUser as any)?.email} isFor={isFor} fetchedAdmin={fetchedAdmin}/>
            
            {isFor == "self"  ? (fetchedUser.role.length > 0 && 
                <div>
                    Privileges: {
                    fetchedUser.role.map((role:string) => { return (
                        (roleLookUp as any)[role]
                    )}).join(", ")}
                </div>
            ):
                <PrivilegesForm role={(fetchedUser as any)?.role} targetEmail={(fetchedUser as any)?.email}/>
            }


            {fetchedUser?.admin && <div>Administrator with the highest privileges.</div>}
            {isFor == "self" && <div>Changes to any fields with <LockClosedIcon className="w-6 inline"/> will submit to an admin for approval.</div>}
            <div>Last Update: {toUserTime((fetchedUser as any)?.updatedAt)}</div>
            {isFor != "self" && <>
                <div>Created At: {toUserTime((fetchedUser as any)?.createdAt)}</div>
            </>}
        </div>
    )
}