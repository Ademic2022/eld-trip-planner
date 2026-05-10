import { gql } from "@apollo/client";

export const PLAN_TRIP = gql`
  mutation PlanTrip(
    $currentLocation: String!
    $pickupLocation: String!
    $dropoffLocation: String!
    $cycleHoursUsed: Float!
  ) {
    planTrip(
      currentLocation: $currentLocation
      pickupLocation: $pickupLocation
      dropoffLocation: $dropoffLocation
      cycleHoursUsed: $cycleHoursUsed
    ) {
      route {
        totalMiles
        totalDurationHours
        polyline { lat lng }
        waypoints { lat lng label }
      }
      stops {
        stopType
        location
        lat
        lng
        arrivalTime
        durationHours
        notes
      }
      eldLogs {
        date
        totalOffDuty
        totalSleeperBerth
        totalDriving
        totalOnDuty
        totalMiles
        events {
          status
          startTime
          endTime
          location
          notes
        }
      }
    }
  }
`;
