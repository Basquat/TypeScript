import type { Status } from "../types";
import { statusLabel } from "../utils";
import { Pill } from "./Ui";

export default function StatusPill({ status }: { status: Status }) {
  return <Pill kind={status}>{statusLabel[status]}</Pill>;
}
