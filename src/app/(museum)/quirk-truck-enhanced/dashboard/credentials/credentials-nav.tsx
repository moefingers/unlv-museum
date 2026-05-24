'use client';

import Link from 'next/link';

import { ShieldExclamationIcon, PlusCircleIcon } from '@heroicons/react/24/outline';

import clsx from 'clsx';
import { usePathname } from 'next/navigation';
import { NavLink } from '../../lib/definitions';
import { auth } from '../../lib/auth-stub';

export const experimental_ppr = true;
export const links:NavLink[] = [
  {
    name: 'Modify, Delete',
    href: '/quirk-truck-enhanced/dashboard/credentials',
    icon: ShieldExclamationIcon,
    index: true
  },
  {
    name: 'Create',
    href: '/quirk-truck-enhanced/dashboard/credentials/create',
    icon: PlusCircleIcon,
  },
]
export default function CredentialsNav( {session}:any) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col px-3 py-0 md:py-3">
      <div className="flex grow flex-row justify-between space-x-2">
          {links.filter(
            (link) => !link.requiredRoles || 
            session?.user?.admin == true || 
            link.requiredRoles?.some(roleSet => {
              if(roleSet.every(role => session?.user?.role?.includes(role))) {
                return true
              }
            })
          ).map((link) => {
              const LinkIcon = link.icon;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={clsx(
                    'flex h-[48px] grow items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600',
                    {
                      'bg-sky-100 text-blue-600': 
                       pathname != link.href  // if path doesn't match exactly with link
                          ? (pathname.startsWith(link.href) && link.index)
                            ? links.every(link => pathname != link.href)
                            : false
                            // path != link but startswith(link)
                            // ? !link.index // and if link is not index
                            
                          : true // if path matches exactly with link
                          
                    },
                  )}
                >
                  <LinkIcon className="w-6" />
                  <p className="hidden md:block">{link.name}</p>
                </Link>
              )
          })}
      </div>
    </div>);
}
