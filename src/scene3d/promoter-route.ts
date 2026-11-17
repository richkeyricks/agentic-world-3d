// Ricky the promoter's route around the grounds: pure geometry, kept apart from
// the scene so it can be tested. He walks a loop around ALL the buildings —
// the office and Ricky Market, including the back of the office — and he crosses
// the road to the far side and back. Every leg runs on open ground (sidewalk,
// road, gang lane, the strip behind the building), never through a wall, a
// stall, the guard post, the market glass or the checkout.
//
// The loop (clockwise from the office entrance):
//   sidewalk in front of the office → sidewalk in front of the market → east
//   end of the sidewalk → across the road to the far side → west along the far
//   side → back across the road → up the gang lane to the back of the office →
//   east along the back → around the east side to the sidewalk → back west.
// The market visit itself is not in the loop: like the pedestrians, he
// sometimes pops into Ricky Market while passing its frontage, using walkPath.

import { MARKET_ENTRY_X, MARKET, SIDEWALK_Z, type OfficeLayout } from '../office3d-layout.ts'

/** Eastbound lane on the sidewalk in front of the buildings. */
export const PROMOTER_LANE_EAST = 5.9
/** Westbound lane on the sidewalk. */
export const PROMOTER_LANE_WEST = 7.0
/** Lane on the far side of the road (z 9.6..14.6). */
export const PROMOTER_FAR_LANE_Z = 16.5
/** Lane behind the office (back wall at z -5.2; AC units sit at z -5.65). */
export const PROMOTER_BACK_LANE_Z = -6.3
/** How fast he walks, same as the pedestrians. */
export const PROMOTER_WALK_SPEED = 1.2
/** Market frontage on the sidewalk: passing it, he sometimes pops in to browse. */
export const PROMOTER_MARKET_FRONTAGE = { fromX: MARKET.minX, toX: 26 }
export const PROMOTER_DIVERT_CHANCE = 0.35
export const PROMOTER_BROWSE_MIN_S = 10
export const PROMOTER_BROWSE_MAX_S = 20

/** The closed loop he walks, in order, for a given crew size (the gang lane moves with the building). */
export function promoterLoop(layout: OfficeLayout): [number, number][] {
  const gangX = layout.sideLaneX
  return [
    [2, PROMOTER_LANE_EAST],
    [17.5, PROMOTER_LANE_EAST],
    [27, PROMOTER_LANE_EAST],
    [27, PROMOTER_FAR_LANE_Z],
    [-13, PROMOTER_FAR_LANE_Z],
    [-13, PROMOTER_LANE_WEST],
    [gangX, PROMOTER_LANE_WEST],
    [gangX, PROMOTER_BACK_LANE_Z],
    [12, PROMOTER_BACK_LANE_Z],
    [17.5, PROMOTER_BACK_LANE_Z],
    [17.5, PROMOTER_LANE_EAST],
  ]
}

/** Where he steps when leaving the market: back out the entry column to the sidewalk. */
export const PROMOTER_MARKET_EXIT: [number, number] = [MARKET_ENTRY_X, SIDEWALK_Z]
