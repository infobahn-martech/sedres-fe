import { CARD_SCOPE, CARD_SCOPE_OPTIONS } from "../../utils/cardScopeFilter";
import "@/design/scss/pages/kanban-board/cardScopeToggle.scss";

/**
 * Compact "All Cards | My Cards" segmented control for a workflow header. Clicks don't
 * bubble, so switching scope never toggles the accordion it sits in.
 */
export default function CardScopeToggle({ value = CARD_SCOPE.ALL, onChange }) {
  return (
    <div
      className="card-scope-toggle"
      role="radiogroup"
      aria-label="Card view filter"
      onClick={(event) => event.stopPropagation()}
    >
      {CARD_SCOPE_OPTIONS.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={`card-scope-toggle__option ${isActive ? "card-scope-toggle__option--active" : ""}`}
            onClick={() => {
              if (!isActive) onChange?.(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
