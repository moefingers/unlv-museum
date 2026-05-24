'use client'

import { section } from "../../lib/definitions"
import { WrenchScrewdriverIcon, TrashIcon, PresentationChartLineIcon, ChatBubbleBottomCenterTextIcon } from "@heroicons/react/24/outline"
import { useActionState, useEffect, useRef, useState } from "react"
import InputWithIcon from "../input-with-icon"
import { Button } from "../button"
import { createSection, updatePageSection } from "../../lib/actions"

import { usePathname } from "next/navigation"
import { PreviewImageWithOptionToRemove } from "./preview-image-with-option-to-remove"
import { uploadImage } from "../../lib/image-upload"


export default function EditPageSectionForm(
    { pageSection, editingState, setEditingState, lineage }: {
        pageSection: section, editingState: boolean, setEditingState: any, lineage: string[]
    }) {
    const [message, formAction, isPending] = useActionState(
        updatePageSection,
        undefined,
    );
    
    const [messageCreate, formActionCreate, isPendingCreate] = useActionState(
        createSection,
        undefined,
    );
    const pathName = usePathname();
    const pageId = pathName.replace('/quirk-truck-enhanced/dashboard/pages/modify/', '')
    

    async function preFormAction(formData: FormData) {
        // NOTE(museum-port): the original fired @vercel/blob `upload()`
        // calls inside forEach without awaiting them, then immediately
        // dispatched the action — a race condition where images
        // sometimes hadn't finished uploading. The museum port awaits
        // each upload sequentially via uploadImage(), so the
        // formData's `images` field is always populated by the time
        // the server action runs.
        const imagesArray: string[] = []
        if(formData.get('image')){
            const images = formData.getAll('image') as File[]
            for (const image of images) {
                if(image.name != ''){
                    const uploaded = await uploadImage(image)
                    imagesArray.push(uploaded.url)
                }
            }
        }
        if(imagesArray.length > 0){
            formData.set('images', imagesArray.join(',,,'))
        }
        formData.delete('image')
        formAction(formData);
    }

    const [note, setNote] = useState('');
    const [filePresent, setFilePresent] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
   
    function handleImageInputChange(event:any){
        const images = event.target.files as File[]
        let tooBig = false
        for ( const image of images ) {
            const fileSize = (image.size / 1024 / 1024)
            if(fileSize > 2.99){
                tooBig = true
            }
        }
        if(!tooBig){
            setFilePresent(true);
            setNote('');
        } else {
            setFilePresent(false);
            setNote('One of the file sizes exceeds 3 MB. Please upload a smaller file.');
            if(fileInputRef.current) fileInputRef.current.value = ''
        }
    }
    
    useEffect(() => {
        setTimeout(() => {
            setNote('')
        }, 5000);
    }, [note])

    return <section className="rounded-lg border border-slate-300 m-2 relative ">
        <div className="flex absolute top-0 right-0">
                    <WrenchScrewdriverIcon className=" cursor-pointer h-10 w-10 text-yellow-500" onClick={() => setEditingState(!editingState)} />
                    <TrashIcon className=" cursor-pointer h-10 w-10 text-red-500" onClick={() => console.log('replace with confirm delete then delete')} />
                </div>
        <p>kv path: {lineage.join('.')}</p>
        {pageSection.image && <PreviewImageWithOptionToRemove src={pageSection.image} width={200} height={200} alt={pageSection.name} path={lineage.join('.')}/>}
        {pageSection.images && pageSection.images.length > 0 && (
            pageSection.images.map((image: string, index: number) => (
            <PreviewImageWithOptionToRemove key={index} src={image} width={200} height={200} alt={pageSection.name}  path={lineage.join('.')} imageIndex ={index}/>
            ))
        )}
        <form action={preFormAction}>
            <input type="hidden" defaultValue={`${pageId}.${lineage.join('.')}`} name="lineage"/>
            <input multiple ref={fileInputRef} type="file" name="image" onChange={(e) => {if(e.target.value != '') handleImageInputChange(e)}}/>
            {filePresent && <button onClick={() => {(fileInputRef.current as unknown as HTMLInputElement).value = ''; setFilePresent(false)}}>Clear</button>}
            <div>{note}</div>
            <span>{message}</span>
            <InputWithIcon defaultValue={pageSection.name} placeholder="Enter section name..." field="name" label="Section Name" type="text" renderIcon={<PresentationChartLineIcon className="w-6 pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900"/>} />
            <InputWithIcon defaultValue={pageSection.description} placeholder="Enter description..." field="description" label="Description" type="text" renderIcon={<ChatBubbleBottomCenterTextIcon className="w-6 pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900"/> } />
            <InputWithIcon defaultValue={pageSection.notes} placeholder="Enter notes..." field="notes" label="Notes" type="text" renderIcon={<ChatBubbleBottomCenterTextIcon className="w-6 pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900"/> } />
            {pageSection.sections && (pageSection.sections as section[])?.length > 0 && <div>Stop editing to see {(pageSection.sections as section[])?.length} more sections. ({(pageSection.sections as section[]).map((section: section) => section.name)?.join(', ')})</div>}
            <Button  aria-disabled={isPendingCreate || isPending} type="submit">Submit</Button>
        </form>
        
        {message}
        <form action={formActionCreate}>
            <input type="hidden" defaultValue={`${pageId}.${lineage.join('.')}`} name="lineage"/>
            <InputWithIcon  placeholder="Enter section name..." field="name" label="Section Name" type="text" renderIcon={<PresentationChartLineIcon className="w-6 pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900"/>} />
            <Button aria-disabled={isPendingCreate || isPending} type="submit">Create Section</Button>
        </form>
    </section>
}