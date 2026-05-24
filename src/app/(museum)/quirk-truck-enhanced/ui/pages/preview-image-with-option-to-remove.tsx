'use client'

import { deleteSectionImage } from "../../lib/actions";
import { useActionState } from "react"
import { useState } from "react"
import { Button } from "../button"
import Image from 'next/image'
import { usePathname } from "next/navigation";

export function PreviewImageWithOptionToRemove({src, path, imageIndex, width, height, alt}:{src: string, path: string, imageIndex?: number, width?: number, height?: number, alt?: string}) {
    const [message, formAction, isPending] = useActionState(
        deleteSectionImage,
        undefined,
      );
    const windowPathName = usePathname()
    const pageId = windowPathName.replace('/quirk-truck-enhanced/dashboard/pages/modify/', '')

    const [deleteConfirmed, setDeleteConfirmed] = useState(false);
    return (
        <form action={formAction} className="flex flex-col">
            <input type="hidden" name="lineage" defaultValue={`${pageId}.${path}`} />
            {imageIndex && <input type="hidden" name="image-index" value={imageIndex} />}
            <Image src={src} alt={alt || `image for ${path}`} width={width} height={height} />
            <Button aria-disabled={isPending} onClick={(e) => {if(!deleteConfirmed){e.preventDefault(); setDeleteConfirmed(true)}}} onMouseLeave={() => setDeleteConfirmed(false)}>{deleteConfirmed ? "Are you sure?" : "Delete Image"}</Button>
        </form>
    );
}