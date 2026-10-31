export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isTaskOverdue(
  dueDate: string | null,
  status: string,
  today = formatDateKey(new Date()),
): boolean {
  return Boolean(dueDate && dueDate < today && status !== "completed" && status !== "cancelled");
}
