
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

import { auth } from '../../../lib/auth-stub';

import { getPage } from '../../../lib/data';
import PageSections from '../../../ui/pages/page-sections';

export const metadata: Metadata = {
  title: 'browse by page',
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return notFound();

  const session: any = await auth();

  const pagesResult:any = await getPage(id, session);
  const page = pagesResult[0];
  // console.log("fetched page",id,page)
  if (!page || JSON.stringify(page) === '[]') return notFound();

  // const page = await getPages(id);

  return (
    <main>
      <header className="mb-4">
        <h1 className="text-2xl font-bold">{page.title}</h1>
        {page.description && <p className="text-gray-600">{page.description}</p>}
      </header>
      <PageSections editable={false} page={page} session={session} />
    </main>
  );
}
