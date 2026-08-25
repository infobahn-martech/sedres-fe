import { useState, useEffect } from "react";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { PreArrivalInformationModal } from "./Modals/AddEditPreArrivalInformation";
import { RenderAction } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import usePreArrivalInfoReducer from "../../store/PreArrivalInfoReducer";

const PreArrivalInformation = () => {
  const [params, setParams] = useState({
    page: 1,
    searchTerm: "",
    limit: 10,
    sortBy: "port",
    sortOrder: 1,
  });

  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [, setSelectedRow] = useState(null);

  const { getTemplates, preArrivalTemplates, templateCount } =
    usePreArrivalInfoReducer((state) => state);

  useEffect(() => {
    getTemplates({
      params: {
        page: params.page,
        limit: params.limit,
        ...(params.searchTerm && { search: params.searchTerm }),
        ...(params.sortBy && { sortBy: params.sortBy }),
        ...(params.sortOrder && { sortOrder: params.sortOrder }),
      },
    });
  }, [params.page, params.limit, params.searchTerm, params.sortBy, params.sortOrder]);

  // get_all_template response: template_id, template_name, port, call_type, usertype_name, subject_line, description_content, agent_full_details, important_contacts
  const tableData = (preArrivalTemplates ?? []).map((row) => ({
    ...row,
    _id: row.template_id ?? row._id ?? row.id,
  }));

  const cols = [
    {
      name: "Name",
      selector: "template_name",
      sort: true,
      width: "180",
      thclass: "tb-head",
      contentClass: "table-content",
    },
    {
      name: "Port",
      selector: "port",
      sort: true,
      width: "150",
      thclass: "tb-head",
      contentClass: "table-content",
    },
    {
      name: "Call Type",
      selector: "call_type",
      sort: true,
      width: "120",
      thclass: "tb-head",
      contentClass: "table-content",
    },
    {
      name: "User Type",
      selector: "usertype_name",
      sort: true,
      width: "120",
      thclass: "tb-head",
      contentClass: "table-content",
    },
    // {
    //   name: "Subject",
    //   selector: "subject_line",
    //   sort: true,
    //   width: "200",
    //   thclass: "tb-head",
    //   contentClass: "table-content",
    //   cell: (row) => (
    //     <div
    //       style={{
    //         maxWidth: "200px",
    //         overflow: "hidden",
    //         textOverflow: "ellipsis",
    //         whiteSpace: "nowrap",
    //       }}
    //       title={row.subject_line}
    //     >
    //       {row.subject_line || "-"}
    //     </div>
    //   ),
    // },
    // {
    //   name: "Description",
    //   selector: "description_content",
    //   sort: true,
    //   width: "200",
    //   thclass: "tb-head",
    //   contentClass: "table-content",
    //   cell: (row) => (
    //     <div
    //       style={{
    //         maxWidth: "200px",
    //         overflow: "hidden",
    //         textOverflow: "ellipsis",
    //         whiteSpace: "nowrap",
    //       }}
    //       title={stripHtml(row.description_content)}
    //     >
    //       {stripHtml(row.description_content) || "-"}
    //     </div>
    //   ),
    // },
    // {
    //   name: "Agent Full Details",
    //   selector: "agent_full_details",
    //   sort: true,
    //   width: "180",
    //   thclass: "tb-head",
    //   contentClass: "table-content",
    //   cell: (row) => (
    //     <div
    //       style={{
    //         maxWidth: "180px",
    //         overflow: "hidden",
    //         textOverflow: "ellipsis",
    //         whiteSpace: "nowrap",
    //       }}
    //       title={stripHtml(row.agent_full_details)}
    //     >
    //       {stripHtml(row.agent_full_details) || "-"}
    //     </div>
    //   ),
    // },
    // {
    //   name: "Important Contacts",
    //   selector: "important_contacts",
    //   sort: true,
    //   width: "180",
    //   thclass: "tb-head",
    //   contentClass: "table-content",
    //   cell: (row) => (
    //     <div
    //       style={{
    //         maxWidth: "180px",
    //         overflow: "hidden",
    //         textOverflow: "ellipsis",
    //         whiteSpace: "nowrap",
    //       }}
    //       title={stripHtml(row.important_contacts)}
    //     >
    //       {stripHtml(row.important_contacts) || "-"}
    //     </div>
    //   ),
    // },
    {
      name: "Actions",
      selector: "linksInfo",
      tableClasses: "table-striped",
      contentClass: "table-content",
      thclass: "tb-head",
      onEditClick: (row) => {
        setSelectedRow(row);
        setShowModal(row);
      },
      onDeleteClick: (row) => {
        setSelectedRow(row);
        setShowDeleteModal(true);
      },
      cell: RenderAction,
      width: "200",
    },
  ];

  return (
    <>
      <div className="page-body">
        <div className="prospect employee">
          <div className="container-fluid">
            <CommonHeader
              tableTitle="Pre-Arrival Information"
              isAddEnabled
              addModalLabel="Add Pre-Arrival Information"
              setSearch={(e) =>
                setParams({ ...params, searchTerm: e, page: 1 })
              }
              onAddModalClick={() => {
                setSelectedRow(null);
                setShowModal(true);
              }}
              exportTitle="Export"
              exportLoader={false}
            />
          </div>

          <CustomTable
            Sl
            pagination={{ currentPage: params.page, limit: params.limit }}
            tableClasses="px-start"
            count={templateCount}
            columns={cols}
            data={tableData}
            onPageChange={(currentPage) =>
              setParams({ ...params, page: currentPage })
            }
            setLimit={(newLimit) =>
              setParams({ ...params, limit: newLimit })
            }
            onSorting={(sortBy) =>
              setParams({
                ...params,
                sortBy,
                sortOrder: params.sortOrder === 1 ? -1 : 1,
                page: 1,
              })
            }
          />

          {!!showModal && (
            <PreArrivalInformationModal
              showModal={showModal}
              closeModal={() => {
                setShowModal(false);
                setSelectedRow(null);
              }}
              onSuccess={() => {
                getTemplates({
                  params: {
                    page: params.page,
                    limit: params.limit,
                    ...(params.searchTerm && { search: params.searchTerm }),
                    ...(params.sortBy && { sortBy: params.sortBy }),
                    ...(params.sortOrder && { sortOrder: params.sortOrder }),
                  },
                });
              }}
            />
          )}

          {!!showDeleteModal && (
            <DeleteConfirmationModal
              show={showDeleteModal}
              onCancel={() => {
                setShowDeleteModal(false);
                setSelectedRow(null);
              }}
              onConfirm={() => {
                setShowDeleteModal(false);
                setSelectedRow(null);
              }}
              deleteText="Are you sure you want to delete this pre-arrival information?"
            />
          )}
        </div>
      </div>
    </>
  );
};

export default PreArrivalInformation;

