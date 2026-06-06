import { MathText } from "@/shared/MathText";

/** Renders a question's `rows` (string[][]) as a token-styled table. Blank
 * cells are visibly empty (a faint fill), not invisible. */
export function QuestionTable({ rows }: { rows: string[][] }) {
  return (
    <table className="qr-table">
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => {
              const blank = cell.trim().length === 0;
              return (
                <td key={c} className={blank ? "qr-table__cell qr-table__cell--blank" : "qr-table__cell"}>
                  {blank ? null : <MathText>{cell}</MathText>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
