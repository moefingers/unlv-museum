'use client'

import { createPage, updatePage, updateUser } from "../../lib/actions";
import { useActionState, useEffect, useRef, useState } from 'react'
import { Button } from '../button';

import UserIcon from '../account/user-icon';

import Image from 'next/image';
import { User } from "../../lib/definitions";
import { uploadImage } from "../../lib/image-upload";
import { ChatBubbleBottomCenterTextIcon, PresentationChartLineIcon } from "@heroicons/react/24/outline";


export default function CreateOrUpdatePageForm({session, oldData}:any) {
    const [message, formAction, isPending] = useActionState(
        oldData ? updatePage : createPage, // PAY ATTENTION. This form does something else depending on if old data is present.
        undefined,
      );
    const [filePresent, setFilePresent] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [note, setNote] = useState('');

    async function preFormAction(formData: FormData) {
        const image = formData.get('image') as File
        const title = formData.get('title') as string
        const description = formData.get('description') as string
        const id = title
        console.log('safe-id'   , id)

        
        const fileSize = (image.size / 1024 / 1024)
        console.log('File Size in MB,', fileSize)
        if(fileSize > .99){
            setFilePresent(false);
            setNote('File size exceeds 1 MB. Please upload a smaller file.');
            return
        }
        setFilePresent(false);

        if(image.name != ''){
            // NOTE(museum-port): the original used Vercel Blob client
            // upload. The museum stores images inline in the
            // quirk_truck_enhanced.images table (bytea) after a
            // client-side webp compression pass. uploadImage() does
            // that and returns the GET URL we then forward server-side
            // under the original "image-url" field name.
            const uploaded = await uploadImage(image);
            formData.append('image-url', uploaded.url);
        }
        formData.append('id', oldData?.id || id);
        formAction(formData);
    }

    useEffect(() => {
        setTimeout(() => {
            setNote('')
        }, 5000);
    }, [note])

    // useEffect(() => {
    //     setFilePresent(false);
    // }, [fileInputRef])


    return (<>
        
        <form action={preFormAction} className="flex flex-col">
            {((fileInputRef.current !=null && (fileInputRef as any).current.files[0]) || oldData?.image) && <Image alt="image preview" src={(fileInputRef as any).current?.files[0] ? URL.createObjectURL((fileInputRef as any).current.files[0]) : oldData?.image} width={200} height={200}/> }
            <input ref={fileInputRef} type="file" name="image" onChange={(e) => {if(e.target.value != '') setFilePresent(true); else setFilePresent(false)}}/>
            {filePresent && <button onClick={() => {(fileInputRef.current as unknown as HTMLInputElement).value = ''; setFilePresent(false)}}>Clear</button>}
            <div>{note}</div>
            <span>{message}</span>
            {[{
                for: 'title', label: 'Title', required: true, icon: PresentationChartLineIcon, defaultValue: oldData?.title
            }, {
                for: 'description', label: 'Description', icon: ChatBubbleBottomCenterTextIcon, defaultValue: oldData?.description
             }].map((fieldObject) => {return (<>
                <label htmlFor={fieldObject.for}>{fieldObject.label}:</label>
                <div className="relative">
                    <input defaultValue={fieldObject.defaultValue} required={fieldObject.required} type={fieldObject.for} name={fieldObject.for} id={fieldObject.for} placeholder={`Enter ${fieldObject.for}..`} 
                        className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"/>
                    <fieldObject.icon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
                </div>
            </>)})}
            <Button className="mt-4" aria-disabled={isPending}>{oldData ? "Update Page" : "Create Page"}</Button>
        </form>
    </>)
}