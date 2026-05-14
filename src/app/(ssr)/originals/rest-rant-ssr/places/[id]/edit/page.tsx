import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { places } from "@/lib/schema/rest-rant";
import { eq } from "drizzle-orm";
import { Default } from "../../../_components/Default";
import { updatePlace } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditPlace({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const placeId = Number(id);
  if (!Number.isFinite(placeId) || placeId <= 0) notFound();
  const [place] = await db.select().from(places).where(eq(places.id, placeId));
  if (!place) notFound();

  const updateBound = updatePlace.bind(null, placeId);

  return (
    <Default>
      <main>
        <h1>Edit Place</h1>
        <h2>{place.id}</h2>
        <form action={updateBound}>
          <div className="form-group">
            <label htmlFor="name">Place Name</label>
            <input
              className="form-control"
              id="name"
              name="name"
              defaultValue={place.name}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="pic">Place Picture URL</label>
            <input
              className="form-control"
              type="url"
              id="pic"
              name="pic"
              defaultValue={place.pic ?? ""}
            />
          </div>
          <div className="form-group">
            <label htmlFor="city">City</label>
            <input
              className="form-control"
              id="city"
              name="city"
              defaultValue={place.city}
            />
          </div>
          <div className="form-group">
            <label htmlFor="state">State</label>
            <input
              className="form-control"
              id="state"
              name="state"
              defaultValue={place.state}
            />
          </div>
          <div className="form-group">
            <label htmlFor="cuisines">Cuisines</label>
            <input
              className="form-control"
              id="cuisines"
              name="cuisines"
              defaultValue={place.cuisines}
              required
            />
          </div>
          <input
            className="btn btn-primary"
            type="submit"
            value="Submit Edit to Place"
          />
        </form>
      </main>
    </Default>
  );
}
