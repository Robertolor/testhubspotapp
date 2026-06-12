import { waitUntil } from "@vercel/functions";
import { after } from "next/server";

/** Keep serverless alive until work finishes (Vercel waitUntil, else Next after). */
export function runInBackground(work: Promise<unknown>): void {
  const task = work.catch((error) => {
    console.error("[background]", error);
  });

  if (waitUntil(task) === undefined) {
    after(() => task);
  }
}
