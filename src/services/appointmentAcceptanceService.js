import Gateway from '../gateway/gateway';

const getReportTemplates = ({ params }) =>
  Gateway.get('/report_template/template', { params });

const getReportTypes = () =>
  Gateway.get('/report_template/all_report_types');

const getTemplateByTemplateId = (template_id) =>
  Gateway.get(`/report_template/template_by_templateid/${template_id}`);

const createReportTemplate = (data) =>
  Gateway.post('/report_template/createtemplate', data);

const updateReportTemplate = (payload) =>
  Gateway.post('/report_template/updatetemplate', payload);

const deleteReportTemplate = (template_id) =>
  Gateway.post(`report_template/delete_template/${template_id}`);

const getTemplateByPortCallType = (payload) =>
  Gateway.post('/report_template/get_template_by_port_calltype', payload);

const getArrivalTemplateByPortCallType = (payload) =>
  Gateway.post('/arrival/get_template_by_port_calltype', payload);

export default {
  getReportTemplates,
  getReportTypes,
  getTemplateByTemplateId,
  createReportTemplate,
  updateReportTemplate,
  deleteReportTemplate,
  getTemplateByPortCallType,
  getArrivalTemplateByPortCallType,
};
