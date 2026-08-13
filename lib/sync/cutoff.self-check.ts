import {
  laterIsoDate,
  parseCutoffDate,
  recordOnOrAfterCutoff,
  windowStartDate,
} from "./cutoff";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(parseCutoffDate("2024-01-15T12:00:00Z") === "2024-01-15", "parse iso");
assert(parseCutoffDate("") === null, "empty");
assert(laterIsoDate("2024-01-01", "2024-06-01") === "2024-06-01", "later");
assert(recordOnOrAfterCutoff(null, "1999-01-01"), "no cutoff includes all");
assert(recordOnOrAfterCutoff("2024-01-01", "2024-01-01"), "inclusive");
assert(!recordOnOrAfterCutoff("2024-01-02", "2024-01-01"), "before cutoff");
assert(recordOnOrAfterCutoff("2024-01-01", null), "missing date included");
assert(
  windowStartDate(30, "2099-01-01") === "2099-01-01",
  "cutoff after lookback wins"
);

console.log("cutoff self-check passed");
