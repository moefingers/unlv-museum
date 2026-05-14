import Link from "next/link";
import { db } from "@/lib/db";
import { places } from "@/lib/schema/rest-rant";
import { desc } from "drizzle-orm";
import { Default } from "../_components/Default";

export const dynamic = "force-dynamic";

export default async function PlacesIndex() {
  const rows = await db.select().from(places).orderBy(desc(places.createdAt));
  return (
    <Default>
      <main>
        <h1>Places to Rant or Rave About</h1>
        <div className="row">
          {rows.map((place) => (
            <div key={place.id} className="col-sm-6">
              <h2 className="text-center">
                <Link href={`/originals/rest-rant-ssr/places/${place.id}`}>
                  {place.name}
                </Link>
              </h2>
              <p className="text-center">{place.cuisines}</p>
              <img
                className="rounded mx-auto d-block"
                src={place.pic ?? "https://placebear.com/g/350/350"}
                alt={place.name}
              />
              <p className="text-center">
                Located in {place.city}, {place.state}
              </p>
              <p>{place.id}</p>
            </div>
          ))}
        </div>
      </main>
    </Default>
  );
}
