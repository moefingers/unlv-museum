'use client';

import { AtSymbolIcon, UserIcon, LockClosedIcon, LockOpenIcon, XMarkIcon} from "@heroicons/react/24/outline";

import { createUser, updateUser } from '../../../lib/actions';
import { useActionState, useRef, useState, useEffect } from 'react';

import { Button } from '../../../ui/button';

import FieldElements from '../../../ui/account/field-elements';


export default function CreateCredentialsPage() {


    const [message, formAction, isPending] = useActionState(
        createUser, // change other condition to a function that submits for admin approval
        undefined,
      );





    return <form action={formAction} className="flex flex-col">
    
    {[{
        for: 'name', label: 'Name', icon: UserIcon
    }, {for: 'email', label: 'Email', icon: AtSymbolIcon }].map((fieldObject) => {return (<>
        <label htmlFor={fieldObject.for}>{fieldObject.label}:</label>
        <div className="relative">
            <input type={fieldObject.for} name={fieldObject.for} id={fieldObject.for} placeholder={`Enter ${fieldObject.for}..`} 
                className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"/>
            <fieldObject.icon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
        </div>
    </>)})}
    <div>You may specifiy the rest of the details through the &quot;Modify, Delete&quot; tab once you finish creation.</div>

    <Button className="mt-4" aria-disabled={isPending}>{"Submit"}</Button>
        <span>{message}</span>
</form>
}