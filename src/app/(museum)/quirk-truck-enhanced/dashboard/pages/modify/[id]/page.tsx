
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

import { auth } from '../../../../lib/auth-stub';

import { getPage } from '../../../../lib/data';
import CreateOrUpdatePageForm from '../../../../ui/pages/create-update-page-form';
import { section } from '../../../../lib/definitions';
import PageSections from '../../../../ui/pages/page-sections';


export default async function ModifyByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return notFound();

  const session: any = await auth();

  const pageResultArray:any = await getPage(id, session);
  const page = pageResultArray[0];
  // console.log("fetched page",id,page)
  if (!page || JSON.stringify(page) === '[]') return notFound();

  // const page = await getPages(id);



  return (
    <main>
      <h1>Page Information</h1>
      <CreateOrUpdatePageForm session={session} oldData={page} />
      <PageSections editable={true} page={page} session={session} />
    </main>
  );
}
