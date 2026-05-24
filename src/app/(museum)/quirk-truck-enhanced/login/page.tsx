import EpLogo from '../ui/ep-logo';
import LoginForm from '../ui/login-form';

import { Suspense } from 'react';

export default function LoginPage() {

  return (
    <main className="flex items-center justify-center md:h-screen">
      <div className="relative mx-auto flex w-full max-w-[400px] flex-col space-y-2.5 p-4 mt-32">
        <div className="flex flex-col text-white w-full items-center rounded-lg bg-black p-3">
            <EpLogo />
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        
      </div>
    </main>
  );
}
