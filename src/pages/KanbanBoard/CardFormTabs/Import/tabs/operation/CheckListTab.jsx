import PropTypes from "prop-types";
import Checklist from "../appointment/Checklist";

function CheckListTab({
  card,
  formValues,
  handleChange,
  onOpenReportPreview,
  cardColor,
  isViewOnly = false,
  isDAModule = false,
  cardDetail,
  callDetailLoading = false,
  onDirtyChange,
}) {
  return (
    <Checklist
      card={card}
      formValues={formValues}
      handleChange={handleChange}
      onOpenReportPreview={onOpenReportPreview}
      cardColor={cardColor}
      isViewOnly={isViewOnly}
      isDAModule={isDAModule}
      cardDetail={cardDetail}
      callDetailLoading={callDetailLoading}
      onDirtyChange={onDirtyChange}
    />
  );
}

CheckListTab.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  onOpenReportPreview: PropTypes.func,
  cardColor: PropTypes.string,
  isViewOnly: PropTypes.bool,
  isDAModule: PropTypes.bool,
  cardDetail: PropTypes.object,
  callDetailLoading: PropTypes.bool,
  onDirtyChange: PropTypes.func,
};

export default CheckListTab;
