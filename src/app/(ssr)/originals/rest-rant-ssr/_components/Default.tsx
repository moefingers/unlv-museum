import Link from "next/link";
import type { ReactNode } from "react";

export function Default({ children }: { children: ReactNode }) {
  return (
    <>
      <nav>
        <ul>
          <li>
            <Link href="/originals/rest-rant-ssr">Home</Link>
          </li>
          <li>
            <Link href="/originals/rest-rant-ssr/places">Places</Link>
          </li>
          <li>
            <Link href="/originals/rest-rant-ssr/places/new">Add Place</Link>
          </li>
        </ul>
      </nav>
      {children}
    </>
  );
}
