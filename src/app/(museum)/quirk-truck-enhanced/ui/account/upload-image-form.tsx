'use client'

import { updateUser } from "../../lib/actions";
import { useActionState, useEffect, useRef, useState } from 'react'
import { Button } from '../button';

import UserIcon from './user-icon';

import Image from 'next/image';
import { User } from "../../lib/definitions";

export default function UploadImageForm({session, fetchedUser}: {session: any, fetchedUser: User}) {
    const [message, formAction, isPending] = useActionState(
        updateUser,
        undefined,
      );
    const [filePresent, setFilePresent] = useState(false);

    const fileInputRef = useRef(null);

    const [note, setNote] = useState('');

    function deleteImageFromDB() {
        const formData = new FormData();
        formData.append('targetEmail', fetchedUser.email);
        formData.append('img', '');
        setFilePresent(false);
        formAction(formData);
    }
    function submitImageToDB(formData: FormData) {
        const img = formData.get('img') as File
        const fileSize = (img.size / 1024 / 1024)
        console.log('File Size in MB,', fileSize)
        if(fileSize > .99){
            setFilePresent(false);
            setNote('File size exceeds 1 MB. Please upload a smaller file.');
            return
        }
        setFilePresent(false);
        formAction(formData);
    }

    useEffect(() => {
        setTimeout(() => {
            setNote('')
        }, 5000);
    }, [note])

    const [deleteConfirmed, setDeleteConfirmed] = useState(false);

    return (<>
        {/* <UserIcon fetchedUser={fetchedUser as any}/> */}
        <form action={deleteImageFromDB} className="flex flex-col">
            {fetchedUser.img && <Button aria-disabled={isPending} onClick={(e) => {if(!deleteConfirmed){e.preventDefault(); setDeleteConfirmed(true)}}} onMouseLeave={() => setDeleteConfirmed(false)}>{deleteConfirmed ? "Are you sure?" : "Delete Image"}</Button>}
        </form>
        <form action={submitImageToDB} className="flex flex-col">
            <input type="hidden" name="targetEmail" value={fetchedUser?.email} />
            <input ref={fileInputRef} type="file" name="img" onChange={(e) => {if(e.target.value != '') setFilePresent(true); else setFilePresent(false)}}/>
            {filePresent && <button onClick={() => {(fileInputRef.current as unknown as HTMLInputElement).value = ''; setFilePresent(false)}}>Clear</button>}
            <div>{note}</div>
            {  filePresent && <Button className="mt-4" aria-disabled={isPending}>{fetchedUser.img ? "Upload New Image" : "Upload Image"}</Button>
            }
                <span>{message}</span>
        </form>
        {fetchedUser.sso && <div>Since you&apos;re using Single-Sign-On, we will use your image from there if you don&apos;t upload one.</div>}
    </>)
}