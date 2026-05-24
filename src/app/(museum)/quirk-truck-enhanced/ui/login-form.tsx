'use client';

import { authenticate } from '../lib/actions';
import { lusitana } from './fonts';
import {
  AtSymbolIcon,
  KeyIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { ArrowRightIcon } from '@heroicons/react/20/solid';
import { Button } from './button';
import { useActionState, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { MuseumMark } from '@/components/ui/MuseumMark';

export default function LoginForm() {
  const [errorMessage, formAction, isPending] = useActionState(
    authenticate,
    undefined,
  );

  const params = useSearchParams();
  const paramError = params.get('error');

  const [museumSigningIn, setMuseumSigningIn] = useState(false);

  return (
    <>
      <form action={formAction} className="space-y-3">
        <div className="flex-1 rounded-lg bg-gray-50 px-6 pb-4 pt-8">
          <h1 className={`${lusitana.className} mb-3 text-2xl`}>
            Please log in to continue.
          </h1>
          <div className="w-full">
            <div>
              <label
                className="mb-3 mt-5 block text-xs font-medium text-gray-900"
                htmlFor="email"
              >
                Email
              </label>
              <div className="relative">
                <input
                  className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
                  id="email"
                  type="email"
                  name="email"
                  placeholder="Enter your email address"
                  required
                  autoComplete="email"
                />
                <AtSymbolIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
              </div>
            </div>
            <div className="mt-4">
              <label
                className="mb-3 mt-5 block text-xs font-medium text-gray-900"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative">
                <input
                  className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
                  id="password"
                  type="password"
                  name="password"
                  placeholder="Enter password"
                  required
                  minLength={6}
                  autoComplete="current-password"
                />
                <KeyIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
              </div>
            </div>
          </div>
          <Button className="mt-4 w-full" aria-disabled={isPending}>
            Log in <ArrowRightIcon className="ml-auto h-5 w-5 text-gray-50" />
          </Button>
          <div
            className="flex h-10 items-end space-x-1"
            aria-live="polite"
            aria-atomic="true"
          >
            {errorMessage || paramError && (
              <>
                <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
                <p className="text-sm text-red-500">{errorMessage || (paramError == 'no-access' ? 'Contact admin to get an account or try again.' : '')}</p>
              </>
            )}
          </div>
        </div>
      </form>
      {/*
        Museum-OAuth button — replaces the source's "Sign in with Google"
        path. The button triggers the museum-side Better Auth GitHub
        flow; on callback the museum session cookie is set and the
        three-factor login predicate (museum_user_id) becomes satisfiable
        for any project-level user that's been bridged to this GitHub
        identity. See CONTEXT/internal_docs/identity-and-signup.md §The
        login-button UI pattern.
      */}
      <button
        type="button"
        disabled={museumSigningIn}
        onClick={async () => {
          setMuseumSigningIn(true);
          await authClient.signIn.social({
            provider: 'github',
            callbackURL: window.location.href,
          });
        }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
      >
        <MuseumMark gradientId="enterprize-login-mark" size={20} />
        <span>{museumSigningIn ? 'Signing in…' : 'Login with UNLV Museum'}</span>
      </button>
    </>
  );
}
