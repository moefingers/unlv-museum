import Link from 'next/link'

import { dashboardCardOuter, dashboardCardInner } from '../skeletons'
import { clickable } from '../button'
import { getWorkOrdersForRoleOrSelf } from '../../lib/data'
import { WorkOrder } from '../../lib/definitions'
import { BriefcaseIcon } from '@heroicons/react/24/outline'

export default async function WorkOrdersCard({session} : {session: any}) {

    const workOrders = await getWorkOrdersForRoleOrSelf(session)

    return  (
        <Link href='/quirk-truck-enhanced/dashboard/work-orders'>
            <div className={`work-orders-card font-black ${dashboardCardOuter} ${clickable}`}>
                <div className="flex p-2">
                    <div className='text-nowrap'><BriefcaseIcon className="w-6 inline" /> {`You have access to view ${workOrders.length} work orders.`}</div>
                </div>
                <div className={`flex truncate items-start justify-start ${dashboardCardInner}`}>
                    <div className='slider-y work-orders flex flex-col slider-vert w-full'>
                        {workOrders.map((order: WorkOrder, index: number) => (
                            <div key={index} className="truncate">
                                <span>{order.summary}</span>
                                <span className="ml-2 text-xs text-gray-500">
                                    ({(order.signatureList?.length ?? 0)}/{order.requiredSignatureCount} sigs)
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Link>
    )
}