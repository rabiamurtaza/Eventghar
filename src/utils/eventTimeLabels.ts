export interface TimeLabels {
  /** Form input label or card label: "Start Time" vs "Reporting Time" */
  startTime: string;
  /** Full label: "Event Start Time" vs "Reporting Time" */
  eventStartTime: string;
  /** Form input label: "Doors Open Time" vs "Departure Time" */
  doorsOpenTime: string;
  /** Display label: "Doors Open" vs "Departure Time" */
  doorsOpen: string;
  /** Form input label or card label: "End Time" vs "Expected Return Time" */
  endTime: string;
  /** Full label: "Event End Time" vs "Expected Return Time" */
  eventEndTime: string;
  /** Modal label: "Time" vs "Reporting Time" */
  modalTime: string;
}

/**
 * Returns dynamic time labels based on whether an event is a trip.
 * Defaults safely to standard event wording if isTrip is null, undefined, or false.
 */
export function getTimeLabels(isTrip?: boolean | null): TimeLabels {
  const trip = Boolean(isTrip);
  return {
    startTime: trip ? "Reporting Time" : "Start Time",
    eventStartTime: trip ? "Reporting Time" : "Event Start Time",
    doorsOpenTime: trip ? "Departure Time" : "Doors Open Time",
    doorsOpen: trip ? "Departure Time" : "Doors Open",
    endTime: trip ? "Expected Return Time" : "End Time",
    eventEndTime: trip ? "Expected Return Time" : "Event End Time",
    modalTime: trip ? "Reporting Time" : "Time",
  };
}
