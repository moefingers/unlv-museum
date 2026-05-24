'use client';

import {
  HomeIcon,
  EyeIcon,
  WrenchScrewdriverIcon,
  UserCircleIcon,
  KeyIcon,
  CommandLineIcon,
  BriefcaseIcon,
  NewspaperIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
// @ts-ignore
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { NavLink } from '../../lib/definitions';
// @ts-ignore
import { useEffect, useState } from 'react';

export const links:NavLink[] = [
  { 
    name: 'Home', 
    href: '/quirk-truck-enhanced/dashboard', 
    icon: HomeIcon,
    index: true
  },
  {
    name: 'Account',
    href: '/quirk-truck-enhanced/dashboard/account',
    icon: UserCircleIcon,
  },
  {
    name: 'Pages',
    href: '/quirk-truck-enhanced/dashboard/pages',
    icon: NewspaperIcon,
  },
  { 
    name: 'Credentials', 
    href: '/quirk-truck-enhanced/dashboard/credentials', 
    icon: KeyIcon,
    requiredRoles: [['credential-manager']]
  },
  {
    name: 'Audit Logs',
    href: '/quirk-truck-enhanced/dashboard/audit-logs',
    icon: CommandLineIcon,
    requiredRoles: [['audit-logs']]
  },
  {
    name: 'Work Orders',
    href: '/quirk-truck-enhanced/dashboard/work-orders',
    icon: BriefcaseIcon,
  }
];

export default function NavLinks({session}:any) {
  const pathname = usePathname();
  useEffect(() => {
    if(pathname == '/quirk-truck-enhanced/dashboard') {
      // console.log('On dashboard, hiding nav')
      document.querySelector('div.class-to-identify-nav')?.classList.add('hidden')
    } else {
      // console.log('Not on dashboard, showing nav')
      document.querySelector('div.class-to-identify-nav')?.classList.remove('hidden')
    }
  },[pathname])

  return  (
    <>
      {links.filter(
        (link) => !link.requiredRoles || 
        session.user?.admin == true || 
        link.requiredRoles?.some(roleSet => {
          if(roleSet.every(role => session.user?.role?.includes(role))) {
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
              'flex h-[48px] grow items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 md:flex-none md:justify-start md:p-2 md:px-3',
              {
                'bg-sky-100 text-blue-600': 
                 pathname != link.href  // if path doesn't match exactly with link
                    ? pathname.startsWith(link.href) && !link.index
                      // path != link but startswith(link)
                      // ? !link.index // and if link is not index
                      
                    : true // if path matches exactly with link
                    
              },
            )}
          >
            <LinkIcon className="w-6" />
            <p className="hidden md:block">{link.name}</p>
          </Link>
        );
      })}
    </>
  );
}
