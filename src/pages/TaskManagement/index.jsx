import { useEffect, useState } from "react";
import CommonHeader from "../../components/CommonHeader";
import { RenderAction, DateFormat } from "./RenderCells";
import { TaskManagementModal } from "./Modals/AddEditTaskManagement";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import CustomTable from "../../components/customTable";
import useTaskManagementReducer from "../../store/TaskManagementReducer";

const TaskManagement = () => {
    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "task_name",
        sortOrder: 1,
    });

    const { getTaskManagement, deleteTaskManagement, taskManagement, isLoadingGet, isLoadingDelete, totalCount } = useTaskManagementReducer(
        (state) => state
    );

    const [showTaskManagementModal, setShowTaskManagementModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedTaskManagement, setSelectedTaskManagement] = useState(null);

    useEffect(() => {
        getTaskManagement?.();
    }, [getTaskManagement]);

    const cols = [
        {
            name: "Task Name",
            selector: "task_name",
            sort: true,
            width: "280",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: "Call type",
            selector: "call_type",
            sort: true,
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: "Port",
            selector: "port",
            sort: true,
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: 'Actions',
            selector: 'linksInfo',
            tableClasses: 'table-striped',
            contentClass: 'table-content',
            thclass: 'tb-head',
            onEditClick: (row) => { setShowTaskManagementModal(row) },
            onDeleteClick: (row) => { setSelectedTaskManagement(row); setShowDeleteModal(true); },
            cell: RenderAction,
            width: '200',
        },
    ];

    return (
        <>
            <div className="page-body">
                <div className="prospect employee">
                    <div className="container-fluid">
                        <CommonHeader
                            tableTitle="Task Management"
                            isAddEnabled
                            addModalLabel="Add Task"
                            setSearch={(e) =>
                                setParams({ ...params, searchTerm: e, page: 1 })
                            }
                            onAddModalClick={() => setShowTaskManagementModal(true)}
                            exportTitle="Export"
                            exportLoader={false}
                        />
                    </div>

                    <CustomTable
                        isLoading={isLoadingGet}
                        pagination={{ currentPage: params.page, limit: params.limit }}
                        tableClasses="px-start"
                        count={totalCount ?? 0}
                        columns={cols}
                        data={Array.isArray(taskManagement) ? taskManagement : []}
                        Sl={true}
                        onPageChange={(currentPage) =>
                            setParams({ ...params, page: currentPage })
                        }
                        setLimit={(newLimit) =>
                            setParams({ ...params, limit: newLimit, page: 1 })
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

                    {showTaskManagementModal && (
                        <TaskManagementModal
                            showModal={showTaskManagementModal}
                            closeModal={() => setShowTaskManagementModal(false)}
                            onSuccess={() => getTaskManagement?.()}
                        />
                    )}
                    {!!showDeleteModal && (
                        <DeleteConfirmationModal
                            show={showDeleteModal}
                            onCancel={() => { setShowDeleteModal(false); setSelectedTaskManagement(null); }}
                            onConfirm={() => {
                                const taskId = selectedTaskManagement?.task_id ?? selectedTaskManagement?._id;
                                deleteTaskManagement({
                                    taskId,
                                    cb: () => {
                                        setShowDeleteModal(false);
                                        setSelectedTaskManagement(null);
                                        getTaskManagement?.();
                                    },
                                });
                            }}
                            deleteText="Are you sure you want to delete this task?"
                            isLoading={isLoadingDelete}
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default TaskManagement;
