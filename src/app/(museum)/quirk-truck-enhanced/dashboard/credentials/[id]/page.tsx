import AccountPage from "../../account/page";


import Link from 'next/link';

import { notFound, redirect} from 'next/navigation';
import NotFound from "./not-found";
import { Metadata } from 'next';

import { auth } from '../../../lib/auth-stub';

import { getUser, getUserById } from '../../../lib/data';

export const metadata: Metadata = {
  title: 'account',
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {

  const { id } = await params;
  // console.log('id',id)
 
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!id) return notFound();
  if (!regex.test(id)) return <NotFound message="May be an Invalid UUID"/>

  const session: any = await auth();
  const account = await getUserById(id, session);
  const fetchedUser = await getUser(session?.user?.email);

  if(account?.admin && !session?.user.admin) {
    return redirect('/quirk-truck-enhanced/dashboard/credentials')
  }

  if (!account) return notFound();
  // console.log('account,',account)
  // console.log('fetchedUser',fetchedUser)


  return (
    <main>
      <Link href="/quirk-truck-enhanced/dashboard/credentials">Back</Link>
      <h1>Credentials Page</h1>
      <div>You are managing someone else&apos;s account.</div>
      <div>{account?.email}</div>
      <AccountPage isFor={account?.email}/>
      <div>You are {fetchedUser?.email}</div>
      <div>They are {account?.email}</div>
    </main>
  );
}
