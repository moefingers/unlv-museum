'use client';

import { PowerIcon } from '@heroicons/react/24/outline';


export default function SignOutButtonSmall() {
    return (
        <button className="flex  grow items-center justify-center gap-2 rounded-md bg-gray-50 p-2 text-sm font-medium hover:bg-red-100 hover:text-red-600"
        onClick={(e) => e.stopPropagation()}>
            <PowerIcon className="w-4" />
            <div className="hidden md:block">Sign Out</div>
        </button>
    );
}   