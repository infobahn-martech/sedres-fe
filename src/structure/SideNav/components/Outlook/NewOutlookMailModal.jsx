import { useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import PropTypes from 'prop-types';
import { FiX } from 'react-icons/fi';
import useOutlookReducer from '../../../../store/OutlookReducer';

const MODE_TITLES = {
  new: 'New message',
  reply: 'Reply',
  replyAll: 'Reply all',
  forward: 'Forward',
};

const parseRecipients = (value) =>
  value
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);

const NewOutlookMailModal = ({ show, onClose, mode, sourceMessage }) => {
  const isSending = useOutlookReducer((s) => s.isSending);
  const sendMail = useOutlookReducer((s) => s.sendMail);
  const replyToMessage = useOutlookReducer((s) => s.replyToMessage);
  const forwardMessage = useOutlookReducer((s) => s.forwardMessage);

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!show) return;
    if (mode === 'new') {
      setTo('');
      setSubject('');
      setBody('');
    } else if (mode === 'forward') {
      setTo('');
      setSubject(sourceMessage?.subject ? `FW: ${sourceMessage.subject}` : 'FW:');
      setBody('');
    } else {
      // reply / replyAll — Graph threads the quoted body automatically,
      // this form only supplies the new comment text.
      const fromAddress = sourceMessage?.from?.emailAddress?.address || '';
      setTo(fromAddress);
      setSubject(sourceMessage?.subject ? `RE: ${sourceMessage.subject}` : 'RE:');
      setBody('');
    }
  }, [show, mode, sourceMessage]);

  const handleSubmit = () => {
    const onSettled = () => {};
    if (mode === 'new') {
      sendMail(
        { subject, contentHtml: body, toRecipients: parseRecipients(to) },
        { cb: onClose, onSettled }
      );
      return;
    }
    if (mode === 'reply' || mode === 'replyAll') {
      replyToMessage(
        sourceMessage.id,
        { comment: body, replyAll: mode === 'replyAll' },
        { cb: onClose, onSettled }
      );
      return;
    }
    if (mode === 'forward') {
      forwardMessage(
        sourceMessage.id,
        { comment: body, toRecipients: parseRecipients(to) },
        { cb: onClose, onSettled }
      );
    }
  };

  const isReplyMode = mode === 'reply' || mode === 'replyAll';
  const canSend = !isSending && body.trim().length > 0 && (isReplyMode || (to.trim().length > 0 && subject.trim().length > 0));

  return (
    <Modal show={show} onHide={onClose} className="new-outlook-mail-modal" centered size="lg">
      <Modal.Header className="new-outlook-mail-modal-header">
        <Modal.Title className="new-outlook-mail-modal-title">{MODE_TITLES[mode]}</Modal.Title>
        <button type="button" className="new-outlook-mail-modal-close" onClick={onClose} aria-label="Close">
          <FiX size={20} />
        </button>
      </Modal.Header>
      <Modal.Body className="new-outlook-mail-modal-body">
        <div className="new-outlook-mail-field">
          <label htmlFor="outlook-mail-to">To</label>
          <input
            id="outlook-mail-to"
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="name@example.com, name2@example.com"
            disabled={isReplyMode}
          />
        </div>
        {!isReplyMode && (
          <div className="new-outlook-mail-field">
            <label htmlFor="outlook-mail-subject">Subject</label>
            <input
              id="outlook-mail-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
        )}
        <div className="new-outlook-mail-field new-outlook-mail-field-body">
          <label htmlFor="outlook-mail-body">Message</label>
          <textarea
            id="outlook-mail-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
          />
        </div>
      </Modal.Body>
      <Modal.Footer className="new-outlook-mail-modal-footer">
        <button type="button" className="new-outlook-mail-cancel-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="new-outlook-mail-send-btn" onClick={handleSubmit} disabled={!canSend}>
          {isSending ? 'Sending…' : 'Send'}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

NewOutlookMailModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  mode: PropTypes.oneOf(['new', 'reply', 'replyAll', 'forward']).isRequired,
  sourceMessage: PropTypes.object,
};

NewOutlookMailModal.defaultProps = {
  sourceMessage: null,
};

export default NewOutlookMailModal;
