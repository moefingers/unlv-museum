'use client';

import { KeyIcon, LockClosedIcon, LockOpenIcon, XMarkIcon} from "@heroicons/react/24/outline";

import { updateUser } from '../../lib/actions';
import { useActionState, useRef, useState } from 'react';

import {Button} from '../button';


export type PasswordFieldProps = {
    ssoValue: boolean
    passwordValue?: string | null
    targetEmail: string
    isFor: "self" | string
    fetchedAdmin: any
}

export default function PasswordField({ssoValue, targetEmail, isFor: any, fetchedAdmin }: PasswordFieldProps) {
    

    const [message, formAction, isPending] = useActionState(
        updateUser,
        undefined,
      );
    const [ssoChecked, setSsoChecked] = useState(ssoValue);
    const [passwordInput1, setPasswordInput1] = useState('');
    const [passwordInput2, setPasswordInput2] = useState('');

    const [inputsValid, setInputsValid] = useState(true);

    function checkPasswordValidity(event:any) {
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (regex.test(event.target.value) == false) {
            console.log('invalid')
            event.target.classList.add('border-red-500');
            setInputsValid(false);
        } else {
            console.log('valid')
            event.target.classList.remove('border-red-500');
            setInputsValid(true);
        }
    }

    return <form action={formAction}>
        <input
            type="hidden"
            name="targetEmail"
            value={targetEmail}
            readOnly
        />
        <div>
            <label htmlFor="sso">Single-Sign-On:</label>
            <input type="checkbox" name="sso" id="sso" defaultChecked={ssoValue} onChange={(e) => setSsoChecked(e.target.checked)}/>
        </div>
        {!ssoChecked && <div>
            <label htmlFor="newPassword">New Password:</label>
            <div className="relative">
                <input id="newPassword"
                    className="peer rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
                    type="password" autoComplete="new-password" placeholder="Enter new password..." onChange={(e) => {setPasswordInput1(e.target.value); checkPasswordValidity(e)}}
                    required={!ssoChecked}
                />
                <KeyIcon className="w-6 pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900"/>
            </div>
            <label htmlFor="confirmNewPassword">Confirm New Password:</label>
            <div className="relative">
                <input id="confirmNewPassword"
                    className="peer rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
                    type="password" name="password" autoComplete="new-password" placeholder="Confirm new password..." onChange={(e) => {setPasswordInput2(e.target.value); checkPasswordValidity(e)}}
                    required={!ssoChecked}
                    
                />
                <KeyIcon className="w-6 pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900"/>
            </div>
            {passwordInput1 != passwordInput2 && <span className="text-red-500">Passwords do not match.</span>}
        </div>}
        {(
            (
                (
                    ssoChecked && (ssoChecked != ssoValue) // sso has changed to enabled
                ) || (
                    !ssoChecked && (ssoChecked == ssoValue) // sso not changed as disabled
                )
            ) && //
            !fetchedAdmin?.sso &&
            inputsValid // and no invalid inputs
        ) && (
        <div>
            <label className="mb-3 mt-5 block text-xs font-medium text-gray-900" htmlFor="password">
              Current Password:
            </label>
            <div className="relative">
              <input
                className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
                id="password"
                type="password"
                name="currentPassword"
                placeholder="Enter password..."
                required
                minLength={6}
                autoComplete="current-password"
              />
              <KeyIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
            </div>
        </div>
        )}    
        {(
           (!ssoChecked && inputsValid && passwordInput1 == passwordInput2 && passwordInput1 != '') || // sso disabled and password inputs valid
           (ssoChecked && ssoChecked != ssoValue) // sso enabled and sso value changed
        ) && (
        <Button className="mt-4" aria-disabled={isPending}>
            {ssoChecked ? "Disable Password, Enroll SSO" : "Enable Password, disable SSO"}
        </Button>
        )}
        {!inputsValid && <p className="text-red-500">Passwords must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.</p>}
        {message && <p className="text-red-500">{message}</p>}
    </form>
}
/*
Aa12345678$

*/