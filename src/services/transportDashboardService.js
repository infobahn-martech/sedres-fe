import Gateway from '../gateway/gateway';

// Transport Coordinator dashboard: month summary, today's counts, requests, trip trend and fleet.
const getTransportDashboard = () => Gateway.get('/transport/get_transport_dashboard');

export default { getTransportDashboard };
