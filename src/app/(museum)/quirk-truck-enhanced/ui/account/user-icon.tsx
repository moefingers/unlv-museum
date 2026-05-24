import { auth } from '../../lib/auth-stub';
import Image from 'next/image'

import { UserCircleIcon } from '@heroicons/react/24/outline';

/**
 * NOTE(museum-port): the original component fired an `updateUser()`
 * server action during render whenever `session.user.image !==
 * fetchedUser.imgFromOAuth` — an EnterPrize-era trick to keep the
 * Google OAuth avatar URL synced into the project user row. The
 * museum port drops it for three reasons:
 *
 *   1. Next.js 16 disallows server-action invocation during render
 *      (it would force a revalidatePath call mid-render, which
 *      throws).
 *   2. Museum identity is GitHub-only; we deliberately don't store
 *      the OAuth avatar URL on the project user row
 *      (`imgFromOAuth` is always null per `shapeUser`).
 *   3. Visible behavior is identical: when the project user has no
 *      uploaded avatar, we fall back to the museum session's
 *      `user.image` (the GitHub avatar) at render time.
 */
export default async function UserIcon({fetchedUser, isFor, className}: {fetchedUser: any, isFor: 'self' | string | undefined, className?: string}) {
    const session: any = await auth();

    // `fetchedUser.img` (project-uploaded) takes priority; otherwise
    // fall back to the museum session's avatar for the signed-in
    // visitor's own card. Other people's cards without an upload
    // show the placeholder icon.
    const imgSrc = fetchedUser?.img != null
        ? fetchedUser.img
        : (isFor === 'self' ? (session?.user?.image ?? null) : null);

    return (
        imgSrc
            ? <Image src={imgSrc} alt="Profile picture" width={128} height={128} className={className || 'rounded-lg w-32'}/>
            : <UserCircleIcon className={className || 'w-32'}/>
    )
}