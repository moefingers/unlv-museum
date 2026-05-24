'use client';

import { LockClosedIcon, LockOpenIcon, XMarkIcon} from "@heroicons/react/24/outline";

import { updateUser } from '../../lib/actions';
import { useActionState, useRef, useState } from 'react';


import FieldElements from './field-elements';

export type FieldProps = {
    field: string
    label?: string
    type?: string
    noteOnEdit?: string
    value?: string
    placeholder?: string
    targetEmail: string
    editable?: boolean | null
    renderIcon: any
}

export default function AccountField({field, label, type, noteOnEdit, value, placeholder, targetEmail, editable = false, renderIcon}: FieldProps) {
    const [message, formAction, isPending] = useActionState(
        editable ? updateUser : updateUser, // change other condition to a function that submits for admin approval
        undefined,
      );
    


    return editable 
    ? <form action={formAction}>
        <FieldElements
            field={field}
            label={label}
            noteOnEdit={noteOnEdit}
            value={value}
            placeholder={placeholder}
            targetEmail={targetEmail}
            editable={editable}
            isPending={isPending}
            message={message}
            renderIcon={renderIcon}
        />
    </form>
    : <>
        <span>{value}</span>
        <LockClosedIcon className="w-6"/>
    </>
}