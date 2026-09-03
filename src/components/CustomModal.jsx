
import { Modal } from 'react-bootstrap';

export default function CustomModal({
  className,
  dialgName,
  show,
  closeModal,
  body,
  footer,
  header,
  bodyClassname,
  createModal,
  disableCenter,
  backdropClassName,
}) {
  return (
    <Modal
      className={className || ''}
      dialogClassName={dialgName || ''}
      show={show}
      onHide={closeModal}
      backdropClassName={backdropClassName}
      backdrop="static"
      centered={!disableCenter}
      enforceFocus={false}
    >
      <Modal.Header closeButton={false}>{header || null}</Modal.Header>
      {createModal ? (
        <Modal.Body className={bodyClassname || ''}>{body}</Modal.Body>
      ) : (
        body
      )}
      {footer || null}
    </Modal>
  );
}
