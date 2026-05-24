import { getWorkOrdersForRoleOrSelf } from '../../lib/data';
import { WorkOrder } from '../../lib/definitions';

import { auth } from '../../lib/auth-stub';
import SingleWorkOrder from '../../ui/single-work-order';
export default async function WorkOrders() {
    const session: any = await auth();

    const workOrders: WorkOrder[] = await getWorkOrdersForRoleOrSelf(session)
    // console.log('workOrders',workOrders)
    return (
        <div>
            {workOrders.length == 0 
                ? <div>You don&apos;t have any open work orders, and/or you don&apos;t have access to view any.</div>
                : <div>
                    {workOrders.map((workOrder) => (
                        <div key={workOrder.id}>
                            <SingleWorkOrder workOrder={workOrder}/>
                        </div>
                    ))}
                </div>}
        </div>
    );
}