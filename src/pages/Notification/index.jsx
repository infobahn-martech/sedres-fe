import { useState } from "react";
import { DateFormat, RenderAction } from "./RenderCells";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { ViewNotificationModal } from "./Modals/ViewNotification";
import "../../design/scss/pages/notification/Notification.scss";

const initialNotifications = [
  {
    _id: "1",
    dateTime: "2024-11-15T10:30:00Z",
    notificationType: "Info",
    title: "New Crew Member Added",
    message: "A new crew member has been added to the system",
    status: "Unread",
    priority: "High",
    recipient: "John Smith",
    module: "Crew Management",
    action: "View Details",
  },
  {
    _id: "2",
    dateTime: "2024-11-15T09:15:00Z",
    notificationType: "Warning",
    title: "Inspection Due Soon",
    message: "Vessel inspection is due in 2 days",
    status: "Read",
    priority: "Medium",
    recipient: "Ahmed Al-Rashid",
    module: "Custom Inspection",
    action: "View Details",
  },
  {
    _id: "3",
    dateTime: "2024-11-15T08:45:00Z",
    notificationType: "Success",
    title: "Report Generated",
    message: "Monthly operations report has been generated successfully",
    status: "Read",
    priority: "Low",
    recipient: "Maria Garcia",
    module: "Report Management",
    action: "View Details",
  },
  {
    _id: "4",
    dateTime: "2024-11-14T16:20:00Z",
    notificationType: "Error",
    title: "System Error",
    message: "Failed to process billing entity update",
    status: "Unread",
    priority: "High",
    recipient: "David Chen",
    module: "Billing Entity",
    action: "View Details",
  },
  {
    _id: "5",
    dateTime: "2024-11-14T14:10:00Z",
    notificationType: "Info",
    title: "Port Update",
    message: "Port information has been updated",
    status: "Read",
    priority: "Low",
    recipient: "James Wilson",
    module: "Port Management",
    action: "View Details",
  },
  {
    _id: "6",
    dateTime: "2024-11-14T11:30:00Z",
    notificationType: "Warning",
    title: "Maintenance Reminder",
    message: "Scheduled maintenance is due for vessel V-001",
    status: "Unread",
    priority: "Medium",
    recipient: "Fatima Hassan",
    module: "Vessel Management",
    action: "View Details",
  },
  {
    _id: "7",
    dateTime: "2024-11-14T10:00:00Z",
    notificationType: "Success",
    title: "Export Completed",
    message: "Data export has been completed successfully",
    status: "Read",
    priority: "Low",
    recipient: "Roberto Silva",
    module: "Reports",
    action: "View Details",
  },
  {
    _id: "8",
    dateTime: "2024-11-13T15:45:00Z",
    notificationType: "Info",
    title: "New Document Uploaded",
    message: "A new document has been uploaded to the system",
    status: "Read",
    priority: "Medium",
    recipient: "Yuki Tanaka",
    module: "Documents",
    action: "View Details",
  },
];

const Notification = () => {
  const [notifications] = useState(initialNotifications);
  const [viewModal, setViewModal] = useState(null);

  const [params, setParams] = useState({
    page: 1,
    total: 0,
    limit: 10,
    searchTerm: '',
    sortOrder: -1,
    sortBy: 'dateTime',
  });

  const cols = [
    {
      name: 'Date/Time',
      selector: 'dateTime',
      tableClasses: 'table-striped',
      contentClass: 'table-content',
      sort: true,
      thclass: 'tb-head',
      cell: DateFormat,
      width: '180',
    },
    {
      name: 'Notification Type',
      selector: 'notificationType',
      tableClasses: 'table-striped',
      sort: true,
      contentClass: 'table-content',
      thclass: 'tb-head',
      width: '160',
    },
    {
      name: 'Title',
      selector: 'title',
      tableClasses: 'table-striped',
      sort: true,
      contentClass: 'table-content',
      thclass: 'tb-head',
      width: '200',
    },
    {
      name: 'Message',
      selector: 'message',
      tableClasses: 'table-striped',
      sort: true,
      contentClass: 'table-content',
      thclass: 'tb-head',
      width: '250',
    },
    {
      name: 'Status',
      selector: 'status',
      tableClasses: 'table-striped',
      sort: true,
      contentClass: 'table-content',
      thclass: 'tb-head',
      width: '120',
    },
    {
      name: 'Priority',
      selector: 'priority',
      tableClasses: 'table-striped',
      sort: true,
      contentClass: 'table-content',
      thclass: 'tb-head',
      width: '120',
    },
    {
      name: 'Recipient',
      selector: 'recipient',
      tableClasses: 'table-striped',
      sort: true,
      contentClass: 'table-content',
      thclass: 'tb-head',
      width: '150',
    },
    {
      name: 'Module',
      selector: 'module',
      tableClasses: 'table-striped',
      sort: true,
      contentClass: 'table-content',
      thclass: 'tb-head',
      width: '150',
    },
    {
      name: 'Action',
      selector: 'action',
      tableClasses: 'table-striped',
      contentClass: 'table-content',
      thclass: 'tb-head',
      cell: (props) => <RenderAction {...props} onViewClick={handleViewClick} />,
      width: '100',
      notView: true,
    },
  ];

  const handleViewClick = (row) => {
    setViewModal(row);
  };

  return (
    <>
      <div className="page-body">
        <div className="prospect employee">
          <div className="container-fluid">
            <CommonHeader
              tableTitle="Notification"
              isAddEnabled={false}
              addModalLabel="Add Notification"
              setSearch={(e) =>
                setParams({ ...params, searchTerm: e, page: 1, limit: 10 })
              }
              exportTitle="Export"
              exportLoader={false}
            />
          </div>

          <CustomTable
            pagination={{ currentPage: params?.page, limit: params?.limit }}
            tableClasses="px-start"
            count={notifications.length}
            columns={cols}
            data={notifications ?? []}
            onPageChange={(currentPage) =>
              setParams({ ...params, page: currentPage })
            }
            setLimit={(newlimit) => setParams({ ...params, limit: newlimit })}
            onSorting={(sortBy) => {
              setParams({
                ...params,
                sortBy,
                sortOrder: params?.sortOrder === -1 ? 1 : -1,
                page: 1,
              });
            }}
            onView={handleViewClick}
          />
        </div>
      </div>

      {!!viewModal && (
        <ViewNotificationModal
          showModal={viewModal}
          closeModal={() => setViewModal(null)}
        />
      )}
    </>
  );
};

export default Notification;

