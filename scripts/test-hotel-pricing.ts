import assert from "node:assert/strict";
import {
  calculateHotelRate,
  hotelNights,
  marketMatches,
  occupancyFits,
  stayHitsBlackout,
} from "../lib/hotels";
import { createDemoHotelSearch } from "../lib/hotels/demo";

const search = { nights: 4, rooms: 2, adults: 3, children: 1, markupPercent: 2 };

const expected: Array<[string, number]> = [
  ["Per Room Per Night", 80_000],
  ["Per Person Per Night", 80_000],
  ["Per Person Sharing Per Night", 80_000],
  ["Per Person Per Stay", 20_000],
  ["Per Room Per Stay", 20_000],
  ["Package Total", 10_000],
  ["Flat Amount", 10_000],
];

for (const [unitBasis, netTotal] of expected) {
  const result = calculateHotelRate({ amount: 10_000, unitBasis, ...search });
  assert.equal(result.netTotal, netTotal, unitBasis);
  assert.equal(result.clientTotal, netTotal * 1.02, `${unitBasis} selling total`);
  assert.equal(result.requiresConfirmation, false, unitBasis);
}

const ambiguous = calculateHotelRate({ amount: 10_000, unitBasis: "Per Child Per Night", ...search });
assert.equal(ambiguous.netTotal, null);
assert.equal(ambiguous.clientTotal, null);
assert.equal(ambiguous.requiresConfirmation, true);

assert.equal(hotelNights("2026-08-10", "2026-08-15"), 5);
assert.equal(hotelNights("2026-08-15", "2026-08-10"), 0);
assert.equal(stayHitsBlackout(["2026-08-12"], "2026-08-10", "2026-08-15"), true);
assert.equal(stayHitsBlackout(["2026-08-20 to 2026-08-25"], "2026-08-10", "2026-08-15"), false);
assert.equal(occupancyFits({ rateAdults: 2, rateChildren: 1, rooms: 2, adults: 3, children: 2 }), true);
assert.equal(occupancyFits({ rateAdults: 2, rateChildren: 0, rooms: 1, adults: 2, children: 1 }), false);
assert.equal(marketMatches("Kenya Resident", "Resident"), true);
assert.equal(marketMatches("International", "Resident"), false);

const demo = createDemoHotelSearch({
  destination: "Diani Beach",
  checkIn: "2026-08-10",
  checkOut: "2026-08-15",
  rooms: 1,
  adults: 2,
  children: 0,
  market: "Resident",
  mealPlan: "Any",
  budget: 120_000,
});
assert.equal(demo.source, "demo");
assert.equal(demo.nights, 5);
assert.equal(demo.results.length, 3);
assert.ok(demo.results.every((result) => result.hotel.id.startsWith("demo-hotel-")));

console.log(`Hotel pricing checks passed (${expected.length} supported bases plus constraints).`);
