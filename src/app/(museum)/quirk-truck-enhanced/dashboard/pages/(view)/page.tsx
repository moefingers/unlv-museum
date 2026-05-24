import PageCard from "../../../ui/pages/page-card";

import { getPages } from "../../../lib/data";

import { auth } from "../../../lib/auth-stub";
import Link from "next/link";

export default async function BrowsePage() {
    
    const session: any = await auth();

    const kvdata = await getPages();
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.values(kvdata as any).map((page: any, index: number) => {
                return (
                    <PageCard key={index} id={page.id} image={page.image} title={page.title} description={page.description}/>
                )})}
            
        </div>
    )
}