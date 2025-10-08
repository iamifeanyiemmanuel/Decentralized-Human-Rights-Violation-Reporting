import { describe, it, expect, beforeEach } from "vitest";
import { buffCV, stringUtf8CV, uintCV, listCV, optionalCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_EVIDENCE_HASH = 101;
const ERR_INVALID_DESCRIPTION = 102;
const ERR_INVALID_LOCATION = 103;
const ERR_INVALID_CATEGORY = 104;
const ERR_INVALID_TAGS = 105;
const ERR_REPORT_ALREADY_EXISTS = 106;
const ERR_REPORT_NOT_FOUND = 107;
const ERR_INVALID_PSEUDONYM = 109;
const ERR_INVALID_ENCRYPTION_KEY = 110;
const ERR_INVALID_SEVERITY = 112;
const ERR_INVALID_WITNESSES = 113;
const ERR_INVALID_ANONYMITY_LEVEL = 114;
const ERR_INVALID_LANGUAGE = 115;
const ERR_INVALID_URGENCY = 116;
const ERR_INVALID_VERIFICATION_STATUS = 117;
const ERR_MAX_REPORTS_EXCEEDED = 118;
const ERR_INVALID_UPDATE_PARAM = 119;

interface Report {
  evidenceHash: Uint8Array;
  description: string;
  location: string;
  category: string;
  tags: string[];
  timestamp: number;
  reporter: string;
  pseudonym: string | null;
  encryptionKey: Uint8Array | null;
  status: boolean;
  severity: number;
  witnesses: number;
  anonymityLevel: number;
  language: string;
  urgency: number;
  verificationStatus: number;
}

interface ReportUpdate {
  updateDescription: string;
  updateLocation: string;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class ReportManagerMock {
  state: {
    nextReportId: number;
    maxReports: number;
    submissionFee: number;
    adminPrincipal: string;
    reports: Map<number, Report>;
    reportUpdates: Map<number, ReportUpdate>;
    reportsByHash: Map<string, number>;
  } = {
    nextReportId: 0,
    maxReports: 10000,
    submissionFee: 100,
    adminPrincipal: "ST1TEST",
    reports: new Map(),
    reportUpdates: new Map(),
    reportsByHash: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextReportId: 0,
      maxReports: 10000,
      submissionFee: 100,
      adminPrincipal: "ST1TEST",
      reports: new Map(),
      reportUpdates: new Map(),
      reportsByHash: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
  }

  setMaxReports(newMax: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newMax <= 0) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    this.state.maxReports = newMax;
    return { ok: true, value: true };
  }

  setSubmissionFee(newFee: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newFee < 0) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    this.state.submissionFee = newFee;
    return { ok: true, value: true };
  }

  submitReport(
    evidenceHash: Uint8Array,
    description: string,
    location: string,
    category: string,
    tags: string[],
    pseudonym: string | null,
    encryptionKey: Uint8Array | null,
    severity: number,
    witnesses: number,
    anonymityLevel: number,
    language: string,
    urgency: number,
    verificationStatus: number
  ): Result<number> {
    if (this.state.nextReportId >= this.state.maxReports) return { ok: false, value: ERR_MAX_REPORTS_EXCEEDED };
    if (evidenceHash.length !== 32) return { ok: false, value: ERR_INVALID_EVIDENCE_HASH };
    if (!description || description.length > 500) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["torture", "discrimination", "freedom-of-speech", "other"].includes(category)) return { ok: false, value: ERR_INVALID_CATEGORY };
    if (tags.length > 10) return { ok: false, value: ERR_INVALID_TAGS };
    if (pseudonym && pseudonym.length > 50) return { ok: false, value: ERR_INVALID_PSEUDONYM };
    if (encryptionKey && encryptionKey.length !== 64) return { ok: false, value: ERR_INVALID_ENCRYPTION_KEY };
    if (severity < 1 || severity > 10) return { ok: false, value: ERR_INVALID_SEVERITY };
    if (witnesses > 100) return { ok: false, value: ERR_INVALID_WITNESSES };
    if (anonymityLevel < 0 || anonymityLevel > 3) return { ok: false, value: ERR_INVALID_ANONYMITY_LEVEL };
    if (!["en", "es", "fr", "other"].includes(language)) return { ok: false, value: ERR_INVALID_LANGUAGE };
    if (urgency < 1 || urgency > 5) return { ok: false, value: ERR_INVALID_URGENCY };
    if (verificationStatus < 0 || verificationStatus > 2) return { ok: false, value: ERR_INVALID_VERIFICATION_STATUS };
    const hashKey = evidenceHash.toString();
    if (this.state.reportsByHash.has(hashKey)) return { ok: false, value: ERR_REPORT_ALREADY_EXISTS };
    this.stxTransfers.push({ amount: this.state.submissionFee, from: this.caller, to: this.state.adminPrincipal });
    const id = this.state.nextReportId;
    const report: Report = {
      evidenceHash,
      description,
      location,
      category,
      tags,
      timestamp: this.blockHeight,
      reporter: this.caller,
      pseudonym,
      encryptionKey,
      status: true,
      severity,
      witnesses,
      anonymityLevel,
      language,
      urgency,
      verificationStatus,
    };
    this.state.reports.set(id, report);
    this.state.reportsByHash.set(hashKey, id);
    this.state.nextReportId++;
    return { ok: true, value: id };
  }

  getReport(id: number): Report | null {
    return this.state.reports.get(id) || null;
  }

  updateReport(id: number, updateDescription: string, updateLocation: string): Result<boolean> {
    const report = this.state.reports.get(id);
    if (!report) return { ok: false, value: ERR_REPORT_NOT_FOUND };
    if (report.reporter !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!updateDescription || updateDescription.length > 500) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (!updateLocation || updateLocation.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    const updated: Report = {
      ...report,
      description: updateDescription,
      location: updateLocation,
      timestamp: this.blockHeight,
    };
    this.state.reports.set(id, updated);
    this.state.reportUpdates.set(id, {
      updateDescription,
      updateLocation,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getReportCount(): Result<number> {
    return { ok: true, value: this.state.nextReportId };
  }

  checkReportExistence(hash: Uint8Array): Result<boolean> {
    return { ok: true, value: this.state.reportsByHash.has(hash.toString()) };
  }
}

describe("ReportManager", () => {
  let contract: ReportManagerMock;
  beforeEach(() => {
    contract = new ReportManagerMock();
    contract.reset();
  });

  it("submits a report successfully", () => {
    const evidenceHash = new Uint8Array(32).fill(1);
    const result = contract.submitReport(
      evidenceHash,
      "Test description",
      "Test location",
      "torture",
      ["tag1", "tag2"],
      "pseudo",
      new Uint8Array(64).fill(2),
      5,
      10,
      2,
      "en",
      3,
      1
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const report = contract.getReport(0);
    expect(report?.description).toBe("Test description");
    expect(report?.location).toBe("Test location");
    expect(report?.category).toBe("torture");
    expect(report?.tags).toEqual(["tag1", "tag2"]);
    expect(report?.pseudonym).toBe("pseudo");
    expect(report?.severity).toBe(5);
    expect(report?.witnesses).toBe(10);
    expect(report?.anonymityLevel).toBe(2);
    expect(report?.language).toBe("en");
    expect(report?.urgency).toBe(3);
    expect(report?.verificationStatus).toBe(1);
    expect(contract.stxTransfers).toEqual([{ amount: 100, from: "ST1TEST", to: "ST1TEST" }]);
  });

  it("rejects duplicate report hashes", () => {
    const evidenceHash = new Uint8Array(32).fill(1);
    contract.submitReport(
      evidenceHash,
      "Test description",
      "Test location",
      "torture",
      ["tag1"],
      null,
      null,
      5,
      10,
      2,
      "en",
      3,
      1
    );
    const result = contract.submitReport(
      evidenceHash,
      "Another description",
      "Another location",
      "discrimination",
      ["tag3"],
      "pseudo2",
      new Uint8Array(64).fill(3),
      6,
      20,
      1,
      "es",
      4,
      0
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_REPORT_ALREADY_EXISTS);
  });

  it("rejects non-authorized update", () => {
    const evidenceHash = new Uint8Array(32).fill(1);
    contract.submitReport(
      evidenceHash,
      "Test description",
      "Test location",
      "torture",
      ["tag1"],
      null,
      null,
      5,
      10,
      2,
      "en",
      3,
      1
    );
    contract.caller = "ST2FAKE";
    const result = contract.updateReport(0, "Updated description", "Updated location");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects invalid evidence hash", () => {
    const evidenceHash = new Uint8Array(31).fill(1);
    const result = contract.submitReport(
      evidenceHash,
      "Test description",
      "Test location",
      "torture",
      ["tag1"],
      null,
      null,
      5,
      10,
      2,
      "en",
      3,
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_EVIDENCE_HASH);
  });

  it("rejects invalid description", () => {
    const evidenceHash = new Uint8Array(32).fill(1);
    const result = contract.submitReport(
      evidenceHash,
      "",
      "Test location",
      "torture",
      ["tag1"],
      null,
      null,
      5,
      10,
      2,
      "en",
      3,
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DESCRIPTION);
  });

  it("rejects invalid category", () => {
    const evidenceHash = new Uint8Array(32).fill(1);
    const result = contract.submitReport(
      evidenceHash,
      "Test description",
      "Test location",
      "invalid",
      ["tag1"],
      null,
      null,
      5,
      10,
      2,
      "en",
      3,
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CATEGORY);
  });

  it("updates a report successfully", () => {
    const evidenceHash = new Uint8Array(32).fill(1);
    contract.submitReport(
      evidenceHash,
      "Old description",
      "Old location",
      "torture",
      ["tag1"],
      null,
      null,
      5,
      10,
      2,
      "en",
      3,
      1
    );
    const result = contract.updateReport(0, "New description", "New location");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const report = contract.getReport(0);
    expect(report?.description).toBe("New description");
    expect(report?.location).toBe("New location");
    const update = contract.state.reportUpdates.get(0);
    expect(update?.updateDescription).toBe("New description");
    expect(update?.updateLocation).toBe("New location");
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent report", () => {
    const result = contract.updateReport(99, "New description", "New location");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_REPORT_NOT_FOUND);
  });

  it("sets submission fee successfully", () => {
    const result = contract.setSubmissionFee(200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.submissionFee).toBe(200);
    const evidenceHash = new Uint8Array(32).fill(1);
    contract.submitReport(
      evidenceHash,
      "Test description",
      "Test location",
      "torture",
      ["tag1"],
      null,
      null,
      5,
      10,
      2,
      "en",
      3,
      1
    );
    expect(contract.stxTransfers).toEqual([{ amount: 200, from: "ST1TEST", to: "ST1TEST" }]);
  });

  it("rejects submission fee change by non-admin", () => {
    contract.caller = "ST2FAKE";
    const result = contract.setSubmissionFee(200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("returns correct report count", () => {
    const evidenceHash1 = new Uint8Array(32).fill(1);
    const evidenceHash2 = new Uint8Array(32).fill(2);
    contract.submitReport(
      evidenceHash1,
      "Desc1",
      "Loc1",
      "torture",
      ["tag1"],
      null,
      null,
      5,
      10,
      2,
      "en",
      3,
      1
    );
    contract.submitReport(
      evidenceHash2,
      "Desc2",
      "Loc2",
      "discrimination",
      ["tag2"],
      "pseudo",
      new Uint8Array(64).fill(3),
      6,
      20,
      1,
      "es",
      4,
      0
    );
    const result = contract.getReportCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks report existence correctly", () => {
    const evidenceHash = new Uint8Array(32).fill(1);
    contract.submitReport(
      evidenceHash,
      "Test description",
      "Test location",
      "torture",
      ["tag1"],
      null,
      null,
      5,
      10,
      2,
      "en",
      3,
      1
    );
    const result = contract.checkReportExistence(evidenceHash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const fakeHash = new Uint8Array(32).fill(9);
    const result2 = contract.checkReportExistence(fakeHash);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("rejects report submission with empty description", () => {
    const evidenceHash = new Uint8Array(32).fill(1);
    const result = contract.submitReport(
      evidenceHash,
      "",
      "Test location",
      "torture",
      ["tag1"],
      null,
      null,
      5,
      10,
      2,
      "en",
      3,
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DESCRIPTION);
  });

  it("rejects report submission with max reports exceeded", () => {
    contract.state.maxReports = 1;
    const evidenceHash1 = new Uint8Array(32).fill(1);
    contract.submitReport(
      evidenceHash1,
      "Desc1",
      "Loc1",
      "torture",
      ["tag1"],
      null,
      null,
      5,
      10,
      2,
      "en",
      3,
      1
    );
    const evidenceHash2 = new Uint8Array(32).fill(2);
    const result = contract.submitReport(
      evidenceHash2,
      "Desc2",
      "Loc2",
      "discrimination",
      ["tag2"],
      "pseudo",
      new Uint8Array(64).fill(3),
      6,
      20,
      1,
      "es",
      4,
      0
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_REPORTS_EXCEEDED);
  });

  it("sets max reports successfully", () => {
    const result = contract.setMaxReports(5000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.maxReports).toBe(5000);
  });
});