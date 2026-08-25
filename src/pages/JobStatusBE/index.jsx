import { useState } from "react";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { JobStatusBEModal } from "./Modals/AddEditJobStatus";
import { RenderAction } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";

const dummyJobStatusesBE = [
    {
        _id: "1",
        name: "Draft",
        code: "DRAFT",
        description: "Initial status before review.",
        order: 1,
        color: "#BDBDBD",
        isFinal: false,
        isActive: true,
    },
    {
        _id: "2",
        name: "Pending Approval",
        code: "PENDING_APPROVAL",
        description: "Waiting for finance / manager approval.",
        order: 2,
        color: "#F2C94C",
        isFinal: false,
        isActive: true,
    },
    {
        _id: "3",
        name: "Approved",
        code: "APPROVED",
        description: "Approved for billing / invoicing.",
        order: 3,
        color: "#27AE60",
        isFinal: false,
        isActive: true,
    },
    {
        _id: "4",
        name: "Invoiced",
        code: "INVOICED",
        description: "Invoice generated and sent to customer.",
        order: 4,
        color: "#2F80ED",
        isFinal: false,
        isActive: true,
    },
    {
        _id: "5",
        name: "Paid",
        code: "PAID",
        description: "Payment received and closed.",
        order: 5,
        color: "#27AE60",
        isFinal: true,
        isActive: true,
    },
];

const JobStatusBE = () => {
    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "name",
        sortOrder: 1,
    });

    const [showJobStatusModal, setShowJobStatusModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    // const [selectedRow, setSelectedRow] = useState(null); // if you want to track for delete later

    const cols = [
        {
            name: "Name",
            selector: "name",
            sort: true,
            width: "220",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: "Code",
            selector: "code",
            sort: true,
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: "Order",
            selector: "order",
            sort: true,
            width: "100",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: "Active",
            selector: "isActive",
            sort: true,
            width: "120",
            thclass: "tb-head",
            contentClass: "table-content",
            cell: (row) => (row?.isActive ? "Yes" : "No"),
        },
        {
            name: "Final Status",
            selector: "isFinal",
            sort: true,
            width: "140",
            thclass: "tb-head",
            contentClass: "table-content",
            cell: (row) => (row?.isFinal ? "Yes" : "No"),
        },
        {
            name: "Description",
            selector: "description",
            sort: true,
            width: "400",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: "Actions",
            selector: "linksInfo",
            tableClasses: "table-striped",
            contentClass: "table-content",
            thclass: "tb-head",
            onEditClick: (row) => {
                setShowJobStatusModal(row);
            },
            onDeleteClick: () => {
                // setSelectedRow(row);
                setShowDeleteModal(true);
            },
            cell: RenderAction,
            width: "180",
        },
    ];

    return (
        <>
            <div className="page-body">
                <div className="prospect employee">
                    <div className="container-fluid">
                        <CommonHeader
                            tableTitle="Job Status"
                            isAddEnabled
                            addModalLabel="Add Job Status"
                            setSearch={(e) =>
                                setParams({ ...params, searchTerm: e, page: 1 })
                            }
                            onAddModalClick={() => setShowJobStatusModal({})}
                            exportTitle="Export"
                            exportLoader={false}
                        />
                    </div>

                    <CustomTable
                        Sl
                        pagination={{ currentPage: params.page, limit: params.limit }}
                        tableClasses="px-start"
                        count={dummyJobStatusesBE.length}
                        columns={cols}
                        data={dummyJobStatusesBE}
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

                    {!!showJobStatusModal && (
                        <JobStatusBEModal
                            showModal={showJobStatusModal}
                            closeModal={() => setShowJobStatusModal(false)}
                        />
                    )}

                    {!!showDeleteModal && (
                        <DeleteConfirmationModal
                            show={showDeleteModal}
                            onCancel={() => setShowDeleteModal(false)}
                            onConfirm={() => {
                                // handle delete here using selectedRow if you track it
                                setShowDeleteModal(false);
                            }}
                            deleteText="Are you sure you want to delete this job status?"
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default JobStatusBE;
