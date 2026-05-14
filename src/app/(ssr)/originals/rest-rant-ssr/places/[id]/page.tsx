import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { places, comments } from "@/lib/schema/rest-rant";
import { eq, asc } from "drizzle-orm";
import { Default } from "../../_components/Default";
import { addComment, deleteComment, deletePlace } from "../actions";

export const dynamic = "force-dynamic";

export default async function PlaceShow({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const placeId = Number(id);
  if (!Number.isFinite(placeId) || placeId <= 0) notFound();

  const [place] = await db.select().from(places).where(eq(places.id, placeId));
  if (!place) notFound();

  const commentRows = await db
    .select()
    .from(comments)
    .where(eq(comments.placeId, placeId))
    .orderBy(asc(comments.createdAt));

  const deletePlaceBound = deletePlace.bind(null, placeId);
  const addCommentBound = addComment.bind(null, placeId);

  return (
    <Default>
      <main>
        <div className="col-sm-6">
          <h1 className="text-center">{place.name}</h1>
          <p className="text-center">{place.cuisines}</p>
          <img
            className="rounded mx-auto d-block"
            src={place.pic ?? "https://placebear.com/g/350/350"}
            alt={place.name}
          />
          <p className="text-center">
            Located in {place.city}, {place.state}
          </p>
          {place.founded ? (
            <p>
              {place.name} has been serving {place.city}, {place.state} since{" "}
              {place.founded}.
            </p>
          ) : null}
          <p>serving {place.cuisines}</p>
          <p>{place.id}</p>
        </div>

        <div className="row align-items-center">
          <div className="col">
            <Link
              href={`/originals/rest-rant-ssr/places/${place.id}/edit`}
              className="btn btn-warning"
            >
              Edit
            </Link>
            <form action={deletePlaceBound} style={{ display: "inline" }}>
              <button type="submit" className="btn btn-danger">
                Delete
              </button>
            </form>
          </div>
        </div>

        <h3 className="mt-4">Comments</h3>
        {commentRows.length === 0 ? (
          <h3 className="inactive">No comments yet!</h3>
        ) : (
          commentRows.map((c) => {
            const deleteCommentBound = deleteComment.bind(null, placeId, c.id);
            return (
              <div className="border" key={c.id}>
                <h2 className="rant">{c.rant ? "Rant! " : "Rave! "}</h2>
                <h4>{c.content}</h4>
                <h3>- {c.authorName ?? "Anonymous"}</h3>
                <h4>Rating: {c.stars}</h4>
                <form action={deleteCommentBound} style={{ display: "inline" }}>
                  <button
                    type="submit"
                    className="btn btn-sm btn-outline-danger"
                  >
                    Delete
                  </button>
                </form>
              </div>
            );
          })
        )}

        <h3 className="mt-4">Leave a Comment</h3>
        <form action={addCommentBound}>
          <div className="form-group">
            <label htmlFor="author">Your Name</label>
            <input className="form-control" id="author" name="author" />
          </div>
          <div className="form-group">
            <label htmlFor="content">Comment</label>
            <textarea
              className="form-control"
              id="content"
              name="content"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="stars">Stars (1-5)</label>
            <input
              className="form-control"
              type="number"
              id="stars"
              name="stars"
              min={1}
              max={5}
              defaultValue={5}
              required
            />
          </div>
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id="rant"
              name="rant"
            />
            <label className="form-check-label" htmlFor="rant">
              This is a rant
            </label>
          </div>
          <input
            className="btn btn-primary mt-2"
            type="submit"
            value="Post Comment"
          />
        </form>
      </main>
    </Default>
  );
}
