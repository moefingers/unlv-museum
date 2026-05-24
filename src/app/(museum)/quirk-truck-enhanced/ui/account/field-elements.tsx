'use client';

import React from 'react';
import { useState, useRef } from 'react';

import {FieldProps} from './field';

import {LockOpenIcon, LockClosedIcon, XMarkIcon} from '@heroicons/react/24/outline';


import {Button} from '../button';

type FieldElementProps = FieldProps & {
    isPending: boolean
    message?: string 
}

export default function FieldElements({field, label, type, noteOnEdit, value, placeholder, targetEmail, editable = true, isPending, message, renderIcon}: FieldElementProps) {
    
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState(value);
    return (<>
        <input
            type="hidden"
            name="targetEmail"
            value={targetEmail}
            readOnly
        />
        <label htmlFor={field}>{label}</label>
        <div className="flex flex-row">
            <div className="relative">
                <input 
                    className="peer w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
                    ref={inputRef}
                    id={field}
                    name={field}
                    type={type}
                    defaultValue={value}
                    placeholder={placeholder}
                    onChange={(e) => setInputValue(e.target.value)}
                    readOnly={!editable}
                />
                {renderIcon}
            </div>
            {inputValue != value && <XMarkIcon className="w-6 cursor-pointer text-red-500" onClick={() => {(inputRef as any).current.value = value; setInputValue(value)}}/>}
        </div>
        {inputValue != value && <>
            <div>{noteOnEdit}</div>
            <Button className="mt-4" aria-disabled={isPending}>
                {editable ? "Submit Changes Immediately" : "Submit for Approval"}
            </Button>
        </>}
        <span>{message}</span>
    </>);
}