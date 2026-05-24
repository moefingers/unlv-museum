'use client';
import { updateUser } from '../../lib/actions';
import { useActionState, useState, useRef } from 'react'

import {Button} from '../button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { roleLookUp } from '../../lib/definitions';


export default function PrivilegesForm({role, targetEmail}:{role:string[], targetEmail:string}) {
    const [message, formAction, isPending] = useActionState(
        updateUser,
        undefined,
      );
    const [roleState, setRoleState] = useState(role);

    const formRef = useRef(null);

    function handleCheckboxChange() {
        let currentList:string[] = [];
        // [ref1?.current, ref2?.current, ref3?.current].forEach((element: any) => {
        Object.values((formRef as any)?.current.children).filter((e: any) => e.className == 'privilege').map((e: any) => e.children[0]).forEach((element: any) => {
            
            if(element?.checked) currentList.push(element?.id)
        })
        setRoleState(currentList);
    }


    return (
        <div>
            <form  ref={formRef} action={formAction} className="flex flex-col">
                <input type="hidden" name="targetEmail" value={targetEmail} />
                {Object.entries(roleLookUp).map(([key, value]) => (
                    <div key={key} className='privilege'>
                        <input type="checkbox" name={'role-' + key} id={key} defaultChecked={role.includes(key)} onChange={handleCheckboxChange}/>
                        <label htmlFor={key}>{value}</label>
                    </div>
                ))}
                {!(roleState.every((r) => role.includes(r)) && role.every((r) => roleState.includes(r)) && role.length == roleState.length) && (<>
                    <Button className="mt-4" aria-disabled={isPending}>Update Privileges</Button>
                    <div onClick={() => {setRoleState(role); Object.values((formRef as any)?.current.children).filter((e: any) => e.className == 'privilege').map((e: any) => e.children[0]).forEach((element: any) => {element.checked = element.defaultChecked})}}><XMarkIcon className="w-6 text-red-500 cursor-pointer "/>Reset</div>
                </>)}
            </form>
            
            <span>{message}</span>
        </div>
    );
}