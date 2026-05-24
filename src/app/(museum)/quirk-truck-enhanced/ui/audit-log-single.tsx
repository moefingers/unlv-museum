'use client';

import { AuditLog } from "../lib/definitions";

import { toUserTime } from "../lib/utils";

import { useState } from "react";
import { clickable } from "./button";
import { MinusCircleIcon, PlusCircleIcon } from "@heroicons/react/24/outline";

export default function AuditLogSingle({auditLog}: {auditLog: AuditLog}) {

    const [expanded, setExpanded] = useState(false);
    return (
        <div className={`border border-slate-300 mb-1 p-1 rounded-lg audit-log ${expanded ? 'expanded' : 'collapsed'} ${clickable}`} onClick={() => setExpanded(!expanded)}>
            <div>{auditLog.summary}</div>
            <div className="content bg-slate-100 cursor-text" onClick={(e) => e.stopPropagation()}>
                
                {JSON.stringify(auditLog, null, 2)}
            </div>
            <div>{toUserTime(auditLog.createdAt)}{ expanded 
                ? <MinusCircleIcon className="w-8 inline"/> 
                : <PlusCircleIcon className="w-8 inline"/>}
            </div>
        </div>
    )
}