import Gateway from '../gateway/gateway';

const getAllMWPHistory = ({ params } = {}) =>
  Gateway.get('/vessel/all_mwp_documents', { params });

const getMWPReminderEmails = (mwpId) =>
  Gateway.get(`/vessel/mwp_reminder_emails/${mwpId}`);

const sendMWPReminderEmail = (formData) =>
  Gateway.post('/vessel/send_mwp_reminder_email', formData);

export default {
  getAllMWPHistory,
  getMWPReminderEmails,
  sendMWPReminderEmail,
};
