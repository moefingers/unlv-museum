import { redirect } from "next/navigation";
import MongoClient from "../MongoClient";
import { MONGO_ENHANCED } from "../mongo-data";

export default async function MongoClientEnhancedPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  const known = MONGO_ENHANCED.some((p) => p.id === project);
  if (!known)
    redirect(`/mongo-client/enhanced?project=${MONGO_ENHANCED[0]!.id}`);
  return <MongoClient tier="enhanced" />;
}
