import { FiActivity, FiCalendar, FiClock, FiAlertCircle, FiFileText } from 'react-icons/fi';
import PortalDashboard from '../../../components/PortalDashboard';

const summaryCards = [
    { title: 'Medical Requests', value: '32', icon: <FiActivity />, color: '#00368c' },
    { title: 'Appointments Today', value: '8', icon: <FiCalendar />, color: '#3b82f6' },
    { title: 'Pending Reports', value: '5', icon: <FiClock />, color: '#f59e0b' },
    { title: 'Emergency Cases', value: '2', icon: <FiAlertCircle />, color: '#ef4444' },
];

const statusCards = [
    { label: 'Pending', value: 10, statusClass: 'status-pending' },
    { label: 'Approved', value: 14, statusClass: 'status-approved' },
    { label: 'Completed', value: 6, statusClass: 'status-completed' },
    { label: 'Cancelled', value: 2, statusClass: 'status-rejected' },
];

const quickActions = [
    { label: 'View Appointments', icon: <FiCalendar />, onClick: () => {} },
    { label: 'View Reports', icon: <FiFileText />, onClick: () => {} },
];

const tableColumns = [
    { label: 'Request No', key: 'requestNo' },
    { label: 'Patient', key: 'patient' },
    { label: 'Date', key: 'date' },
    { label: 'Doctor', key: 'doctor' },
    { label: 'Type', key: 'type' },
    { label: 'Status', key: 'status', isStatus: true },
];

const tableRows = [
    { requestNo: 'MR-2025-001', patient: 'Ali Hassan', date: '05 Jun 2025', doctor: 'Dr. Ahmed', type: 'General', status: 'Approved' },
    { requestNo: 'MR-2025-002', patient: 'Sara Ahmed', date: '06 Jun 2025', doctor: 'Dr. Noor', type: 'Specialist', status: 'Pending' },
    { requestNo: 'MR-2025-003', patient: 'Omar Khalid', date: '07 Jun 2025', doctor: 'Dr. Fatima', type: 'Emergency', status: 'Completed' },
    { requestNo: 'MR-2025-004', patient: 'Nora Abdulla', date: '08 Jun 2025', doctor: 'Dr. Yousif', type: 'General', status: 'Pending' },
    { requestNo: 'MR-2025-005', patient: 'Fahad Al-Rashid', date: '09 Jun 2025', doctor: 'Dr. Ahmed', type: 'Specialist', status: 'Cancelled' },
];

function MedicalDashboard() {
    return (
        <PortalDashboard
            title="Medical Dashboard"
            subtitle="Overview of medical requests, appointments, and reports."
            summaryCards={summaryCards}
            statusTitle="Request Status Overview"
            statusCards={statusCards}
            quickActions={quickActions}
            tableTitle="Recent Medical Requests"
            tableColumns={tableColumns}
            tableRows={tableRows}
        />
    );
}

export default MedicalDashboard;
