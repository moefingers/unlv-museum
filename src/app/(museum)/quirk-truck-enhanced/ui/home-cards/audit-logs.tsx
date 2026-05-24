import { AuditLog } from '../../lib/definitions'
import Link from 'next/link'

import { dashboardCardOuter, dashboardCardInner } from '../skeletons'
import { clickable } from '../button'
import { getAuditLogs } from '../../lib/data'
import { CommandLineIcon } from '@heroicons/react/24/outline'

export default async function AuditLogsCard({session} : {session: any}) {

    const auditLogs = await getAuditLogs(session)
    return  (
        <Link href='/quirk-truck-enhanced/dashboard/audit-logs'>
            <div className={`audit-logs-card font-black ${dashboardCardOuter} ${clickable}`}>
                <div className="flex p-2">
                    <div><CommandLineIcon className="w-6 inline" /> {`View ${auditLogs.length} audit logs.`}</div>
                </div>
                <div className={`flex truncate items-start justify-start ${dashboardCardInner}`}>
                    <div className='slider-y audit-logs flex flex-col slider-vert w-full'>
                        {auditLogs.map((auditLog: AuditLog, index: number) => (
                            <div key={index}>{auditLog.summary}</div>
                        ))}
                    </div>
                </div>
            </div>
        </Link>
    )
}