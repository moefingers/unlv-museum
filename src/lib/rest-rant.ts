import type { InferSelectModel } from "drizzle-orm";
import type { places, comments, users } from "@/lib/schema/rest-rant";

type DbPlace = InferSelectModel<typeof places>;
type DbComment = InferSelectModel<typeof comments>;
type DbUser = InferSelectModel<typeof users>;

export interface PlaceJson {
  placeId: number;
  name: string;
  city: string;
  state: string;
  cuisines: string;
  pic: string | null;
  founded: number | null;
  createdAt: string;
}

export interface UserJson {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
}

export interface CommentJson {
  commentId: number;
  placeId: number;
  authorId: number | null;
  content: string;
  stars: number;
  rant: boolean;
  createdAt: string;
  author: UserJson | { firstName: string; lastName: string } | null;
}

export function serializePlace(row: DbPlace): PlaceJson {
  return {
    placeId: row.id,
    name: row.name,
    city: row.city,
    state: row.state,
    cuisines: row.cuisines,
    pic: row.pic,
    founded: row.founded,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeUser(row: DbUser): UserJson {
  return {
    userId: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeComment(
  row: DbComment,
  author: DbUser | null,
): CommentJson {
  return {
    commentId: row.id,
    placeId: row.placeId,
    authorId: row.authorId,
    content: row.content,
    stars: row.stars,
    rant: row.rant,
    createdAt: row.createdAt.toISOString(),
    author: author
      ? serializeUser(author)
      : row.authorName
        ? {
            firstName: row.authorName.split(" ")[0] ?? row.authorName,
            lastName: row.authorName.split(" ").slice(1).join(" "),
          }
        : null,
  };
}
