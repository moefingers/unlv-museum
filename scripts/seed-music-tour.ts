/**
 * Seed music_tour.* from the canonical source-repo seeders verbatim.
 *
 * Mirrors `moefingers/SQL-Music-Tour-API/seeders/`:
 *   - 2 bands (ids 69, 420)
 *   - 6 events (ids 1, 2, 3, 7, 8, 9)
 *   - 2 stages (ids 80, 90)
 *   - 6 meet_greets cross-referencing bands × events
 *   - 6 set_times cross-referencing bands × events × stages
 *   - 4 stage_events (M:M)
 *
 * The source used `new Date()` for every timestamp so all times match the
 * seed run. This script does the same — every "available_start_time",
 * "date", "start_time", "end_time", "meet_start_time", "meet_end_time"
 * is the same wall-clock moment. It's not pretty data; it's faithful data.
 *
 * Idempotent: wipes the 6 tables in dependency order, then inserts. The
 * smallserial sequences are bumped past the inserted ids so subsequent
 * POSTs don't collide.
 *
 * Usage:  pnpm seed:music-tour
 */

import { sql } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  bands,
  events,
  meetGreets,
  setTimes,
  stageEvents,
  stages,
} from "../src/lib/schema/music-tour";

async function main() {
  const now = new Date();

  // Wipe in dependency order: junctions first, then parents.
  await db.delete(stageEvents);
  await db.delete(setTimes);
  await db.delete(meetGreets);
  await db.delete(events);
  await db.delete(stages);
  await db.delete(bands);

  await db.insert(bands).values([
    {
      bandId: 69,
      name: "Jingle Jongle",
      genre: "Jangle",
      availableStartTime: now,
      endTime: now,
    },
    {
      bandId: 420,
      name: "Dingle Dongle",
      genre: "Dangle",
      availableStartTime: now,
      endTime: now,
    },
  ]);

  await db.insert(events).values([
    { eventId: 1, name: "Jinglefest", date: now, startTime: now, endTime: now },
    {
      eventId: 2,
      name: "Jingledongle",
      date: now,
      startTime: now,
      endTime: now,
    },
    { eventId: 3, name: "Event 3", date: now, startTime: now, endTime: now },
    { eventId: 7, name: "Event 7", date: now, startTime: now, endTime: now },
    { eventId: 8, name: "Dingledays", date: now, startTime: now, endTime: now },
    { eventId: 9, name: "Event 9", date: now, startTime: now, endTime: now },
  ]);

  await db.insert(stages).values([
    { stageId: 80, stageName: "Main Stage" },
    { stageId: 90, stageName: "Rear Stage" },
  ]);

  await db.insert(meetGreets).values([
    {
      meetGreetId: 1,
      eventId: 1,
      bandId: 69,
      meetStartTime: now,
      meetEndTime: now,
    },
    {
      meetGreetId: 2,
      eventId: 1,
      bandId: 69,
      meetStartTime: now,
      meetEndTime: now,
    },
    {
      meetGreetId: 3,
      eventId: 2,
      bandId: 69,
      meetStartTime: now,
      meetEndTime: now,
    },
    {
      meetGreetId: 4,
      eventId: 2,
      bandId: 420,
      meetStartTime: now,
      meetEndTime: now,
    },
    {
      meetGreetId: 5,
      eventId: 8,
      bandId: 420,
      meetStartTime: now,
      meetEndTime: now,
    },
    {
      meetGreetId: 6,
      eventId: 8,
      bandId: 420,
      meetStartTime: now,
      meetEndTime: now,
    },
  ]);

  await db.insert(setTimes).values([
    {
      setTimeId: 10,
      eventId: 1,
      stageId: 80,
      bandId: 69,
      startTime: now,
      endTime: now,
    },
    {
      setTimeId: 20,
      eventId: 2,
      stageId: 90,
      bandId: 69,
      startTime: now,
      endTime: now,
    },
    {
      setTimeId: 21,
      eventId: 2,
      stageId: 80,
      bandId: 69,
      startTime: now,
      endTime: now,
    },
    {
      setTimeId: 22,
      eventId: 2,
      stageId: 90,
      bandId: 420,
      startTime: now,
      endTime: now,
    },
    {
      setTimeId: 30,
      eventId: 8,
      stageId: 90,
      bandId: 420,
      startTime: now,
      endTime: now,
    },
    {
      setTimeId: 40,
      eventId: 8,
      stageId: 90,
      bandId: 420,
      startTime: now,
      endTime: now,
    },
  ]);

  await db.insert(stageEvents).values([
    { stageEventsId: 1, stageId: 80, eventId: 1 },
    { stageEventsId: 2, stageId: 90, eventId: 2 },
    { stageEventsId: 3, stageId: 90, eventId: 2 },
    { stageEventsId: 4, stageId: 90, eventId: 8 },
  ]);

  // Bump each smallserial sequence past the explicitly-inserted ids so
  // subsequent POST endpoints get fresh, non-colliding ids.
  await db.execute(
    sql`SELECT setval('music_tour.bands_band_id_seq', 421, true)`,
  );
  await db.execute(
    sql`SELECT setval('music_tour.events_event_id_seq', 10, true)`,
  );
  await db.execute(
    sql`SELECT setval('music_tour.stages_stage_id_seq', 91, true)`,
  );
  await db.execute(
    sql`SELECT setval('music_tour.meet_greets_meet_greet_id_seq', 6, true)`,
  );
  await db.execute(
    sql`SELECT setval('music_tour.set_times_set_time_id_seq', 40, true)`,
  );
  await db.execute(
    sql`SELECT setval('music_tour.stage_events_stage_events_id_seq', 4, true)`,
  );

  console.log("[seed] music-tour: done");
}

main().catch((err) => {
  console.error("[seed] music-tour failed", err);
  process.exit(1);
});
