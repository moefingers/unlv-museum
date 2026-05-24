/**
 * Shared types + lookup tables for the EnterPrize Historical Enhanced
 * port. The original definitions.ts pulled `Session`, `User`, and
 * `AdapterUser` from `next-auth` / `next-auth/adapters`; the museum
 * isn't on next-auth at all (better-auth + a per-project bridge), so
 * those types are defined inline here. The shape matches what the
 * source view layer relied on:
 *   session.user.{id,email,name,image,admin,role}
 *
 * Prisma-compat aliases (`User`, `WorkOrder`, `AuditLog`) are
 * re-exported from the Drizzle inferred types via the shape adapters
 * in ./data, so consumer code that did `import { User } from
 * "@prisma/client"` ports verbatim by changing only the source path.
 */

/**
 * Session shape preserved verbatim from the original. The stub auth()
 * returns this; the eventual museum-OAuth bridge will return the same.
 */
export type CustomSession = {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    emailVerified: Date | null;
    admin: boolean;
    role: string[];
  };
  expires: string;
};

// FROM KV
export type Page = {
  id: string; // normal
  name: string;
  content: any;
};

// nav links

export type NavLink = {
  name: string;
  href: string;
  icon: any;
  index?: boolean;
  requiredRoles?: string[][];
};

// roles
//'page-manager', 'credential-manager', 'change-name', 'audit-logs', 'work-orders'
export const roleLookUp = {
  "page-manager": "Page Manager",
  "credential-manager": "Credential Manager",
  "change-name": "Change Name",
  "audit-logs": "Audit Logs",
  "work-orders": "Work Orders",
};

// work orders
function example() {}

export const workOrderActionLookUp = {
  createAdmin: {
    function: example,
    description: "Create Admin",
  },
  deleteAdmin: {
    function: example,
    description: "Delete Admin",
  },
  createUser: {
    function: example,
    description: "Create User",
  },
  updateUser: {
    function: example,
    description: "Update User",
  },
  deleteUser: {
    function: example,
    description: "Delete User",
  },
  changeName: {
    function: example,
    description: "Change Name",
  },
};

export const auditLogActionLookUp = {
  ...workOrderActionLookUp,
  login: {
    description: "Login",
  },
};

export type section = {
  name: string;
  id?: string;
  order?: number;
  description?: string;
  notes?: string;
  image?: string;
  images?: string[];
  tags?: string[];
  tagDictionary?: any;
  sections?: section[];
  type?: string;
};

/**
 * Prisma-compat type aliases. The original code imported these from
 * `@prisma/client`; in the museum port we synthesize them in `./data`
 * via shape adapters that pull from the Drizzle schema. The shapes
 * match what the view layer reads.
 */
export type User = {
  id: string;
  name: string;
  email: string;
  password: string | null;
  admin: boolean;
  sso: boolean;
  role: string[];
  /** URL to the avatar image, or null. Originally a base64-encoded `bytea`. */
  img: string | null;
  imgFromOAuth: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkOrder = {
  id: string;
  status: string;
  summary: string | null;
  action: string | null;
  data: any;
  requiredRoles: string[][] | null;
  requiredSignatureCount: number;
  signatureList: string[];
  requesterId: string;
  requesterName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AuditLog = {
  id: string;
  action: string | null;
  summary: string | null;
  data: any;
  createdAt: Date;
  updatedAt: Date;
};
