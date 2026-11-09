/** Shared shapes for offline tickets. Safe to import from both the browser and the server. */

export type SignedTicket = {
  id: string;
  serial: number;
  serial_label: string; // "OFF-0007"
  position: number; // 7  ("ticket 7 of 200")
  ticket_type: string;
  price: number;
  status: string; // generated | checked_in | void
  check_code: string; // "K3F9X"
  qr: string; // OFF.<ticket id>.<seal>
};

export type EventInfo = {
  id: string;
  title: string;
  start_date: string | null;
  start_time: string | null;
  venue_name: string | null;
  city: string | null;
};

export type BatchRow = {
  id: string;
  event_id: string;
  batch_number: number;
  ticket_type: string;
  price: number | string;
  quantity: number;
  download_count: number;
  created_at: string;
};

export type BatchData = {
  batch: BatchRow;
  event: EventInfo | null;
  tickets: SignedTicket[];
};

export type StatsBatch = {
  id: string;
  batch_number: number;
  ticket_type: string;
  price: number | string;
  quantity: number;
  created_at: string;
  generated_by: string;
  scanned: number;
  not_scanned: number;
  void: number;
  expected_cash: number | string;
  download_count: number;
  last_downloaded_at: string | null;
};

export type OfflineStats = {
  totals: {
    total: number;
    scanned: number;
    not_scanned: number;
    void: number;
    expected_cash: number | string;
    scanned_value: number | string;
  };
  by_type: Array<{
    ticket_type: string;
    total: number;
    scanned: number;
    not_scanned: number;
    void: number;
    expected_cash: number | string;
  }>;
  by_batch: StatsBatch[];
};

export type ScanKind = "valid" | "already_used" | "void" | "invalid" | "wrong_event";

export type OfflineScanResult = {
  result: ScanKind;
  message: string;
  details?: {
    serial_label: string;
    position: number;
    batch_number: number;
    batch_quantity: number;
    ticket_type: string;
    price: number;
    event_title: string;
    checked_in_at: string | null;
  };
};

export type LookupResult =
  | { found: false; message: string }
  | {
      found: true;
      ticket: {
        serial_label: string;
        position: number;
        batch_number: number;
        batch_quantity: number;
        ticket_type: string;
        price: number;
        status: string;
        event_title: string;
        generated_at: string;
        generated_by: string;
        checked_in_at: string | null;
      };
      checkIn?: OfflineScanResult;
    };

/** An event the signed-in organizer/admin may create offline tickets for. */
export type OfflineEvent = {
  id: string;
  title: string;
  event_number?: number | string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  city: string | null;
  ticket_price?: unknown;
  ticket_types?: Array<{ name?: string | null; price?: number | string | null }> | null;
};

/** Everything the Offline panel needs from the outside world (real one in offlineClient.ts). */
export interface OfflineApi {
  listEvents(): Promise<OfflineEvent[]>;
  stats(eventId: string): Promise<OfflineStats>;
  generate(eventId: string, ticketType: string, quantity: number): Promise<BatchData>;
  getBatch(batchId: string): Promise<BatchData>;
  recordDownload(batchId: string): Promise<{ previous_count: number; new_count: number }>;
  voidBatch(batchId: string): Promise<{ voided: number; already_used: number }>;
  voidTicket(ticketId: string): Promise<{ changed: boolean }>;
  lookup(eventId: string, serial: string, code: string, checkIn: boolean): Promise<LookupResult>;
}
