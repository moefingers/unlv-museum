import { redirect } from "next/navigation";
import MongoClient from "./MongoClient";
import { MONGO_ORIGINAL } from "./mongo-data";

export default async function MongoClientOriginalPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  const known = MONGO_ORIGINAL.some((p) => p.id === project);
  if (!known) redirect(`/mongo-client?project=${MONGO_ORIGINAL[0]!.id}`);
  return <MongoClient tier="original" />;
}
