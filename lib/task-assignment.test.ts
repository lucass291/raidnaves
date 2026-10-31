import { describe, expect, it } from "vitest";
import {
  filterTaskAssignees,
  taskAssignmentAfterAreaChange,
  taskAssignmentAfterTeamChange,
  type TaskOption,
} from "./task-assignment";

const assignees: TaskOption[] = [
  { id: "worker-a", name: "Trabajador A", area_id: "area-a", team_id: "team-a" },
  { id: "worker-b", name: "Trabajador B", area_id: "area-a", team_id: "team-b" },
  { id: "worker-c", name: "Trabajador C", area_id: "area-b", team_id: "team-c" },
];

describe("task assignment selection", () => {
  it("clears the team and assignee when the area changes", () => {
    expect(taskAssignmentAfterAreaChange("area-b")).toEqual({
      areaId: "area-b",
      teamId: "",
      assigneeId: "",
    });
  });

  it("preserves the area but clears the assignee when the team changes", () => {
    expect(
      taskAssignmentAfterTeamChange(
        { areaId: "area-a", teamId: "team-a", assigneeId: "worker-a" },
        { id: "team-b", area_id: "area-a" },
      ),
    ).toEqual({ areaId: "area-a", teamId: "team-b", assigneeId: "" });
  });

  it("selects the team's area when a team is chosen before an area", () => {
    expect(
      taskAssignmentAfterTeamChange(
        { areaId: "", teamId: "", assigneeId: "" },
        { id: "team-c", area_id: "area-b" },
      ),
    ).toEqual({ areaId: "area-b", teamId: "team-c", assigneeId: "" });
  });

  it("clears the team but keeps the selected area when no team is selected", () => {
    expect(
      taskAssignmentAfterTeamChange(
        { areaId: "area-a", teamId: "team-a", assigneeId: "worker-a" },
        null,
      ),
    ).toEqual({ areaId: "area-a", teamId: "", assigneeId: "" });
  });

  it("filters assignees by both selected area and team", () => {
    expect(filterTaskAssignees(assignees, "area-a", "team-b")).toEqual([assignees[1]]);
    expect(filterTaskAssignees(assignees, "area-a", "")).toEqual(assignees.slice(0, 2));
    expect(filterTaskAssignees(assignees, "", "team-c")).toEqual([assignees[2]]);
  });
});
