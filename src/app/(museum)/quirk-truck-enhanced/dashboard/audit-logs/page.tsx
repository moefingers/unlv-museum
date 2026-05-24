import { getAuditLogs } from "../../lib/data";
import { auth } from "../../lib/auth-stub";

import AuditLogSingle from "../../ui/audit-log-single";
import Search from "../../ui/search";
import Pagination from "../../ui/pagination";

import { getAuditLogsPaginated } from "../../lib/data";

export default async function AuditLogPage({
    searchParams,
  }: {
    searchParams?: Promise<{
      query?: string;
      page?: string;
      perPage?: string;
      roleFilters?: string;
    }>;
  }) {

    const sp = (await searchParams) ?? {};
    const query = sp.query || '';
    const currentPage = Number(sp.page) || 1;
    const perPage = Number(sp.perPage) || 15;
    const roleFilters = sp.roleFilters || '';

    const session = await auth();

    // const auditLogs = await getAuditLogs(session);
    const {auditLogs, total} = await getAuditLogsPaginated(session, currentPage, query, roleFilters, perPage);

    return (
        <main>
            <h1>Audit Logs (click one to expand)</h1>
            <Search placeholder="Search by name or email..."/>
            {/* <div>{auditLogs.map((log: any, index: number) => <AuditLogSingle key={index} auditLog={log} />)}</div> */}
            <div>{auditLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((log: any, index: number) => <AuditLogSingle key={index} auditLog={log} />)}</div>

            <Pagination totalPages={Math.ceil(total / perPage)}/>
        </main>
    );
}