import PropTypes from "prop-types";
import { notify } from "@/components/Toaster";
import { CREW_ENTRY_COLUMNS, createEmptyCrewRow as createEmptyRow } from "./Husbandry.constants";

const isRowEmpty = (row) => CREW_ENTRY_COLUMNS.every((column) => !String(row[column.key] ?? "").trim());

// A pasted first row whose first cell reads like a "name" header is a copied header row, not crew data.
const isHeaderRow = (cells) => /name/i.test(cells[0] ?? "") && cells.length > 1;

/**
 * Spreadsheet-style crew entry. Rows can be typed or pasted straight from Excel / Google Sheets
 * (tab-separated cells, one crew per line) — the paste fills the grid from the focused cell onward.
 * Rows are controlled by the parent so they survive toggling views. Rows already saved (`_saved`)
 * stay visible but locked; only new rows are submitted, so the same crew is never saved twice.
 */
const CrewEntryGrid = ({ rows, onRowsChange: setRows, onSubmit, submitting = false }) => {

  const updateCell = (rowIndex, key, value) => {
    setRows((prev) =>
      prev.map((row, index) => (index === rowIndex && !row._saved ? { ...row, [key]: value } : row))
    );
  };

  const handlePaste = (rowIndex, columnIndex) => (e) => {
    const text = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(text)) return;
    e.preventDefault();

    let pastedRows = text
      .replace(/\r/g, "")
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => line.split("\t"));
    if (pastedRows.length > 0 && isHeaderRow(pastedRows[0])) pastedRows = pastedRows.slice(1);
    if (pastedRows.length === 0) return;

    setRows((prev) => {
      const next = [...prev];
      pastedRows.forEach((cells, offset) => {
        let targetIndex = rowIndex + offset;
        if (next[targetIndex]?._saved) targetIndex = next.length; // never overwrite saved crew
        const row = { ...(next[targetIndex] ?? createEmptyRow()) };
        cells.forEach((cell, cellOffset) => {
          const column = CREW_ENTRY_COLUMNS[columnIndex + cellOffset];
          if (column) row[column.key] = cell.trim();
        });
        next[targetIndex] = row;
      });
      return next;
    });
  };

  const handleAddRow = () => setRows((prev) => [...prev, createEmptyRow()]);

  const handleRemoveRow = (rowIndex) => {
    setRows((prev) => {
      const next = prev.filter((_, index) => index !== rowIndex);
      return next.some((row) => !row._saved) ? next : [...next, createEmptyRow()];
    });
  };

  const filledRows = rows.filter((row) => !row._saved && !isRowEmpty(row));

  const handleSubmit = async () => {
    if (filledRows.length === 0) {
      notify("Enter at least one crew member.", "error");
      return;
    }
    if (filledRows.some((row) => !row.crew_name.trim())) {
      notify("Crew name is required for every row.", "error");
      return;
    }
    const submittedRows = filledRows;
    const saved = await onSubmit(submittedRows.map((row) => Object.fromEntries(CREW_ENTRY_COLUMNS.map(({ key }) => [key, row[key]]))));
    if (!saved) return;
    // Keep the saved crew in the grid (locked), drop leftover blank rows, and leave one empty row for more.
    setRows((prev) => [
      ...prev
        .filter((row) => !isRowEmpty(row))
        .map((row) => (submittedRows.includes(row) ? { ...row, _saved: true } : row)),
      createEmptyRow(),
    ]);
  };

  return (
    <div className="husb-crew-grid">
      <div className="husb-crew-grid__scroll">
        <table className="husb-crew-grid__table">
          <thead>
            <tr>
              <th className="husb-crew-grid__index">#</th>
              {CREW_ENTRY_COLUMNS.map((column) => (
                <th key={column.key}>
                  {column.header}
                  {column.required && <span className="text-danger">*</span>}
                </th>
              ))}
              <th className="husb-crew-grid__action" aria-label="Remove row" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className={row._saved ? "husb-crew-grid__row--saved" : undefined}>
                <td className="husb-crew-grid__index">{rowIndex + 1}</td>
                {CREW_ENTRY_COLUMNS.map((column, columnIndex) => (
                  <td key={column.key}>
                    <input
                      type="text"
                      value={row[column.key]}
                      placeholder={column.placeholder}
                      onChange={(e) => updateCell(rowIndex, column.key, e.target.value)}
                      onPaste={handlePaste(rowIndex, columnIndex)}
                      disabled={submitting || row._saved}
                      title={row._saved ? "Saved" : undefined}
                      aria-label={`${column.header} row ${rowIndex + 1}`}
                    />
                  </td>
                ))}
                <td className="husb-crew-grid__action">
                  {row._saved ? (
                    <span className="husb-crew-grid__saved" title="Saved" aria-label="Saved">✓</span>
                  ) : (
                  <button
                    type="button"
                    className="husb-crew-grid__remove"
                    onClick={() => handleRemoveRow(rowIndex)}
                    disabled={submitting}
                    aria-label={`Remove row ${rowIndex + 1}`}
                  >
                    ×
                  </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="husb-crew-grid__footer">
        <span className="husb-crew-grid__hint">Tip: copy rows from Excel and paste into any cell.</span>
        <div className="husb-crew-grid__buttons">
          <button type="button" className="husb-crew-grid__link" onClick={handleAddRow} disabled={submitting}>
            + Add row
          </button>
          <button
            type="button"
            className="husb-crew-grid__submit"
            onClick={handleSubmit}
            disabled={submitting || filledRows.length === 0}
          >
            {submitting ? "Adding..." : `Add ${filledRows.length || ""} crew`.replace(/\s+/g, " ")}
          </button>
        </div>
      </div>
    </div>
  );
};

CrewEntryGrid.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  onRowsChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  submitting: PropTypes.bool,
};

export default CrewEntryGrid;
