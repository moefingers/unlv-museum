'use client';

import Link from 'next/link';

import { PlusCircleIcon, WrenchScrewdriverIcon, EyeIcon } from '@heroicons/react/24/outline';

import clsx from 'clsx';
import { usePathname } from 'next/navigation';
import { NavLink } from '../../lib/definitions';
import { auth } from '../../lib/auth-stub';

export const experimental_ppr = true;
export const links:NavLink[] = [
  {
    name: 'View',
    href: '/quirk-truck-enhanced/dashboard/pages',
    icon: EyeIcon,
    index: true
  },
  {
    name: 'Create/Build',
    href: '/quirk-truck-enhanced/dashboard/pages/create',
    icon: PlusCircleIcon,
    requiredRoles: [['page-manager']]
  },
  {
    name: 'Edit/Delete',
    href: '/quirk-truck-enhanced/dashboard/pages/modify',
    icon: WrenchScrewdriverIcon,
    requiredRoles: [['page-manager']],
    index: true
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
                            ? links.every(link => pathname != link.href) && !pathname.replace(link.href + '/', '').includes('/')
                            : false
                            
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
