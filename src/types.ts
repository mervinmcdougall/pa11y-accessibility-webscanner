export interface ScanIssue {
  type: string;
  code: string;
  message: string;
  context: string;
  selector: string;
  runner: string;
}

export interface ScanOccurrence {
  url: string;
  selector: string;
  context: string;
}

export interface Finding {
  id: string;
  type: string;
  code: string;
  message: string;
  count: number;
  occurrences: ScanOccurrence[];
  explanation?: string;
  recommendation?: string;
}

export interface ScanResults {
  total: number;
  passes: number;
  errors: number;
  results: Record<string, ScanIssue[]>;
  failures: Array<{ url: string; message: string }>;
}

export interface ScanReport {
  createdAt: string;
  scannedUrls: string[];
  results: ScanResults;
  findings: Finding[];
}
