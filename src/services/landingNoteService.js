import Gateway from '../gateway/gateway';

const getAllLandingNotes = (params) => Gateway.get('/material_management/get_all_landing_notes', { params });

export default { getAllLandingNotes };
