import PropTypes from "prop-types";
import GeneralAdd from "./GeneralAdd";
import GeneralView from "./GeneralView";
import DailyTaskTodo from "./DailyTaskTodo";

// Appointment Details tab entry point: the Add Card flow and the existing-call view are separate components.
function General({ isAddMode = false, ...props }) {
  return isAddMode ? <GeneralAdd {...props} /> : <GeneralView {...props} />;
}

General.propTypes = {
  isAddMode: PropTypes.bool,
};

export default General;
export { DailyTaskTodo };
