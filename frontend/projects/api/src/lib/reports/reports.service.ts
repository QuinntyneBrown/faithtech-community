import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/** The four periods and their URL keys (L2-124 AC3). */
export type ReportPeriod = 'last-30-days' | 'last-90-days' | 'this-year' | 'all-time';

/** The report's filters, as the URL carries them; `city` is null for All cities. */
export interface ReportFilters {
  city: string | null;
  period: ReportPeriod;
}

/** A chart bar. */
export interface ReportChartRowDto {
  label: string;
  value: number;
}

/** A month of New members by month; `month` is "yyyy-MM" and `soFar` marks the current month. */
export interface ReportMonthRowDto {
  month: string;
  label: string;
  value: number;
  soFar: boolean;
}

export interface PartnerPipelineRowDto {
  city: string;
  lead: number;
  inFunnel: number;
  confirmed: number;
}

/**
 * A row of Events and attendance. `going`, `checkedIn` and `checkedInPercent` are null for a cancelled event;
 * `checkedIn` and `checkedInPercent` for an upcoming one; `checkedInPercent` when `going` is 0. Walk-ins are left out.
 */
export interface ReportEventRowDto {
  id: string;
  title: string;
  startsAt: string;
  city: string;
  status: 'Held' | 'Upcoming' | 'Cancelled';
  going: number | null;
  checkedIn: number | null;
  checkedInPercent: number | null;
}

/** The whole report (docs/detailed-designs/reports/reports-dashboard, ADR 0030). */
export interface ReportDto {
  city: string | null;
  period: ReportPeriod;
  from: string | null;
  to: string;
  cities: string[];
  isEmpty: boolean;
  figures: {
    /** `newInPeriod` is null for All time. */
    members: { value: number; newInPeriod: number | null };
    eventsHeld: { value: number; cancelled: number };
    /** `checkedInPercent` is null when there are no RSVPs. */
    rsvps: { value: number; checkedIn: number; checkedInPercent: number | null };
    partnersConfirmed: { value: number; inPipeline: number };
    announcements: { value: number };
  };
  membersByCity: ReportChartRowDto[];
  newMembersByMonth: ReportMonthRowDto[];
  partnerPipeline: PartnerPipelineRowDto[];
  events: ReportEventRowDto[];
}

/**
 * Contract for Reports (L2-123 to L2-128). Pages depend on REPORTS_SERVICE, never on HttpReportsService.
 */
export interface ReportsService {
  /** Staff and System Admins; 403 for everyone else; 400 for an unknown city or period. */
  getReport(filters: ReportFilters): Observable<ReportDto>;
  /** The same report as CSV, one section after another, for Staff and System Admins (L2-128). */
  exportCsv(filters: ReportFilters): Observable<Blob>;
}

export const REPORTS_SERVICE = new InjectionToken<ReportsService>('REPORTS_SERVICE');
