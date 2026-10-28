import type {
  Priority,
  TicketInput,
} from "../../../packages/contracts/src/index.js";
const HOUR = 3600000;
export function classify(
  input: Pick<
    TicketInput,
    "type" | "affected" | "blocked" | "commitmentToday" | "workaround"
  >,
): Priority {
  if (input.blocked && input.affected !== "individual") return "Crítica";
  if (input.blocked || input.commitmentToday) return "Alta";
  if (input.type === "INC") return "Média";
  return "Baixa";
}
// São Paulo permanece UTC-3. Não há calendário de feriados configurado neste protótipo.
function parts(date: Date) {
  const local = new Date(date.getTime() - 3 * HOUR);
  return { day: local.getUTCDay(), hour: local.getUTCHours(), local };
}
export function dueAt(start: Date, priority: Priority): Date {
  if (priority === "Crítica") return new Date(start.getTime() + HOUR);
  let remaining = { Alta: 4, Média: 30, Baixa: 50 }[priority] * HOUR;
  let cursor = new Date(start);
  while (remaining > 0) {
    const { day, hour, local } = parts(cursor);
    if (day === 0 || day === 6 || hour >= 18) {
      local.setUTCDate(local.getUTCDate() + 1);
      local.setUTCHours(8, 0, 0, 0);
      cursor = new Date(local.getTime() + 3 * HOUR);
      continue;
    }
    if (hour < 8) {
      local.setUTCHours(8, 0, 0, 0);
      cursor = new Date(local.getTime() + 3 * HOUR);
      continue;
    }
    const end = new Date(local);
    end.setUTCHours(18, 0, 0, 0);
    const available = end.getTime() + 3 * HOUR - cursor.getTime();
    const used = Math.min(remaining, available);
    cursor = new Date(cursor.getTime() + used);
    remaining -= used;
  }
  return cursor;
}
export const sessionDate = (now: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    now,
  );
