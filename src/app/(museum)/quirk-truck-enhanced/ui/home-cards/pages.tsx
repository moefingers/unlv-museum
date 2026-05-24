import { getPageTitleDescriptionAndImageAndId } from '../../lib/data'
import Link from 'next/link'
import PageCard from '../pages/page-card'
import { clickable } from '../button'
import { dashboardCardInner, dashboardCardOuter } from '../skeletons'
import { NewspaperIcon } from '@heroicons/react/24/outline'


export default async function PagesCard({session} : {session: any}) {
    const pageData:any = await getPageTitleDescriptionAndImageAndId()
    // console.log(pageData)
    return (
        <Link href='/quirk-truck-enhanced/dashboard/pages'>
            <div
            className={`dashboard-pages-card font-black ${dashboardCardOuter} ${clickable}`}
            >
                <div className="flex p-2">
                    <div><NewspaperIcon className="w-6 inline" /> {session?.user?.admin || session?.user.role.includes('page-manager') ? "View and manage pages" : "View Pages"}</div>
                </div>
                <div className={`flex items-center justify-start truncate ${dashboardCardInner}`}>
                    <div className='slider-x flex flex-row slider gap-1 h-44'>
                        {pageData.map((page: any, index: number) => (
                            <PageCard key={index} id={page.id} image={page.image} title={page.title} description={page.description} mini={true} noLink={true} />
                        ))}
                    </div>
                    
                </div>
            </div>
        </Link>
    )
}