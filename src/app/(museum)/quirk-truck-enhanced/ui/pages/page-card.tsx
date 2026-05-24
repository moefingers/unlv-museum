'use client'

import Image from 'next/image'

import Link from 'next/link'
import { Button, clickable } from '../button';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useState, useActionState, useEffect } from 'react';
import { deletePage } from '../../lib/actions';

export default function PageCard({ image, title, description, id, mini, edit, noLink}: any) {

    const [message, formAction, isPending] = useActionState(
        deletePage,
        undefined,
      );
    useEffect(() => {
        if(!isPending){
            setModalActive(false)
        }
    }, [isPending])

    const [modalActive, setModalActive] = useState(false);
    // Outer card class is shared whether or not we render the navigating
    // <Link>. When `noLink` is true the parent owns navigation (the
    // dashboard-home carousel wraps the whole row in a single Link so
    // visitors land on /dashboard/pages); rendering an inner <a> here
    // would nest anchors and trip React's hydration check.
    const cardClass = `page-card  ${clickable} h-full bg-gray-50 hover:bg-sky-100 hover:text-blue-600 rounded-lg p-0.5 flex flex-col justify-end relative ${mini ? 'w-40' : 'w-full'}`;
    const hasUsableImage = image && (image.startsWith('/') || image.startsWith('http'));
    const imageBlock = hasUsableImage ? (
        <Image className={`${mini ? `h-[6.5rem]` : 'h-[9.5rem] w-full'} mb-auto rounded-lg relative object-cover`} src={image} alt={title} width={mini ? 160 : 280} height={mini ? 140 : 320}/>
    ) : (
        // Empty placeholder preserves card geometry so the carousel row
        // doesn't collapse to text-only height when there's no image.
        <div className={`${mini ? `h-[6.5rem] w-40` : 'h-[9.5rem] w-full'} mb-auto rounded-lg bg-gray-200`} aria-hidden="true" />
    );
    const innerContent = (
        <>
            {imageBlock}
            <h3 className="font-bold">{title}</h3>
            <p className="description w-full">{description}</p>
        </>
    );

    return(
        <div className={`relative ${mini ? 'w-40' : 'w-full'} ${mini ? 'h-full' : 'h-64'} mx-auto`}>
            {modalActive && <div className="absolute w-full h-full top-0 left-0 bg-gray-500/50 z-10"
                onMouseLeave={() => setModalActive(false)}>
                <form action={formAction} className="modal-content absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <input type="hidden" name="id" value={id} />
                    <p className="text-red-500 text-center">Are you sure you want to delete this page?</p>
                    <button onClick={(e) => {e.stopPropagation();setModalActive(!modalActive)}}>Cancel</button>
                    <Button className="mt-4 bg-red-500" aria-disabled={isPending}>Confirm Deletion</Button>
                </form>
            </div>}

            {edit && <TrashIcon className="rounded-lg absolute cursor-pointer bg-gray-500/50 z-10 w-10 right-0 top-0 m-1 text-red-800 hover:text-red-500" onClick={() => setModalActive(true)}/>}

            {noLink ? (
                <div className={cardClass}>{innerContent}</div>
            ) : (
                <Link href={!edit ? `/quirk-truck-enhanced/dashboard/pages/${id}` : `/quirk-truck-enhanced/dashboard/pages/modify/${id}`}
                    className={cardClass}>
                    {innerContent}
                </Link>
            )}
        </div>
    );
}