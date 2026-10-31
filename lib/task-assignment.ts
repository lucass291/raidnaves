export type TaskOption = { id: string; name: string; area_id?: string; team_id?: string };

export type TaskAssignmentSelection = {
  areaId: string;
  teamId: string;
  assigneeId: string;
};

export function taskAssignmentAfterAreaChange(areaId: string): TaskAssignmentSelection {
  return { areaId, teamId: "", assigneeId: "" };
}

export function taskAssignmentAfterTeamChange(
  selection: TaskAssignmentSelection,
  teamId: string,
): TaskAssignmentSelection {
  return { ...selection, teamId, assigneeId: "" };
}

export function filterTaskAssignees(
  assignees: TaskOption[],
  areaId: string,
  teamId: string,
): TaskOption[] {
  return assignees.filter(
    (assignee) =>
      (!areaId || assignee.area_id === areaId) &&
      (!teamId || assignee.team_id === teamId),
  );
}
