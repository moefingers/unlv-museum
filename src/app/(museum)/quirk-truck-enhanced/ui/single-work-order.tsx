import { WorkOrder, workOrderActionLookUp } from "../lib/definitions";

export default function SingleWorkOrder({workOrder}:{workOrder: WorkOrder}) {
    // Action lookup is best-effort: era source defined a small fixed map
    // (createAdmin / deleteAdmin / createUser / updateUser / deleteUser /
    // changeName), but seeded + user-created work orders may carry
    // arbitrary action strings ("promote-to-admin", "reassign-truck").
    // Fall back to the raw action string so unknown values render
    // legibly instead of crashing on `.description` of undefined.
    const lookup = (workOrderActionLookUp as Record<string, { description?: string }>);
    const actionKey = workOrder.action as string | null | undefined;
    const description = (actionKey && lookup[actionKey]?.description) || actionKey || "Work order";

    return (
        <div>
            <div>{description} requested by {workOrder.requesterName}</div>
            <div>{workOrder.summary}</div>
            <div>{workOrder.signatureList.length} / {workOrder.requiredSignatureCount} required signatures.</div>
            {workOrder.assigneeName && <div>Assigned to: {workOrder.assigneeName}</div>}
        </div>
    )
}