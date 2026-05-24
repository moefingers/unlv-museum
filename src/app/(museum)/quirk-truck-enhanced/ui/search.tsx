'use client';

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';

import { useEffect, useRef, useState } from 'react';

export default function Search({ placeholder }: { placeholder: string }) {
  const searchParams = useSearchParams();
  const { replace } = useRouter();
  const pathname = usePathname();
  const [message, setMessage] = useState('');

  const handleSearch = useDebouncedCallback((target) => {
    if (!/^[a-zA-Z0-9.@]+$/.test(target.value) && target.value.length > 0) {
      setMessage('Only letters, numbers, @, and . are allowed.');
      return;
    }

    setMessage('');
    const term = target.value
    console.log(`Searching... ${term}`);

    const params = new URLSearchParams(searchParams);

    params.set('page', '1');

    if (term) {
      params.set('query', term);
    } else {
      params.delete('query');
    }
    replace(`${pathname}?${params.toString()}`);
  }, 300);

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    handleSearch(inputRef.current);
  },[handleSearch])

  return (
    <div className="flex flex-col">
    <div className="relative flex flex-1 flex-shrink-0">
      <label htmlFor="search" className="sr-only">
        Search
      </label>
      <input
        ref={inputRef}
        className={`peer block w-full rounded-md border ${message ? 'focus:border-red-500 focus:ring-red-500 border-red-500' : 'border-gray-200'} py-[9px] pl-10 text-sm outline-0 border-2 placeholder:text-gray-500`}
        placeholder={placeholder}
        onChange={(e) => {
          handleSearch(e.target);
        }}
        onLoad={(e) => {handleSearch(e.currentTarget)}}
        
        defaultValue={searchParams.get('query')?.toString()}
      />

      <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
    </div>
    {message && <p className="text-sm text-red-500">{message}</p>}
    </div>
  );
}
