type ReportesTableRowPaddingProps = {
  colSpan: number;
  count: number;
};

export function ReportesTableRowPadding({ colSpan, count }: ReportesTableRowPaddingProps) {
  if (count <= 0) return null;

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <tr
          key={`pad-${i}`}
          className="reportes-table__row-pad gastos-table__row gastos-tr"
          aria-hidden
        >
          <td colSpan={colSpan} className="gastos-table__cell" />
        </tr>
      ))}
    </>
  );
}
