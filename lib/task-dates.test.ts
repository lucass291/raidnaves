import { describe, expect, it } from "vitest";
import { formatDateKey, isTaskOverdue } from "./task-dates";

describe("task due dates", () => {
  it("formats calendar keys using the local date", () => {
    expect(formatDateKey(new Date(2026, 9, 30, 23, 30))).toBe("2026-10-30");
  });

  it("does not mark a task due today as overdue", () => {
    expect(isTaskOverdue("2026-10-30", "pending", "2026-10-30")).toBe(false);
  });

  it("marks past-due active tasks as overdue", () => {
    expect(isTaskOverdue("2026-10-29", "in_progress", "2026-10-30")).toBe(true);
  });

  it.each(["completed", "cancelled"])("does not mark %s tasks as overdue", (status) => {
    expect(isTaskOverdue("2026-10-29", status, "2026-10-30")).toBe(false);
  });

  it("does not mark future-due tasks as overdue", () => {
    expect(isTaskOverdue("2026-10-31", "pending", "2026-10-30")).toBe(false);
  });
});
