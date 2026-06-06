import { useEffect, useMemo, useState } from "react";
import CommonHeader from "../../components/CommonHeader";
import { RenderAction, TimeObjectsSummary } from "./RenderCells";
import { StageTimeMappingModal } from "./Modals/AddStageTimeMapping";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import CustomTable from "../../components/customTable";
import useStageTimeMappingReducer from "../../store/StageTimeMappingReducer";

const StageTimeMappings = () => {
    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "stage_name",
        sortOrder: 1,
    });

    const {
        getStageTimeMappings,
        mapTimeObjectsToStage,
        stageTimeMappings,
        isLoadingGet,
        totalCount,
        isBeingUpdated,
    } = useStageTimeMappingReducer((state) => state);

    const [showStageTimeMappingModal, setShowStageTimeMappingModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteRow, setDeleteRow] = useState(null);

    const apiParams = useMemo(
        () => ({
            searchTerm: params.searchTerm || "",
            page: params.page,
            limit: params.limit,
            sortBy: params.sortBy,
        }),
        [params.page, params.limit, params.searchTerm, params.sortBy]
    );

    useEffect(() => {
        getStageTimeMappings?.(apiParams);
    }, [getStageTimeMappings, apiParams]);

    const cols = [
        {
            name: "Call stage",
            selector: "stage_name",
            sort: true,
            width: "220",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: "Port",
            selector: "port",
            sort: true,
            width: "120",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: "Call type",
            selector: "call_type",
            sort: true,
            width: "160",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        // {
        //     name: "Time objects",
        //     selector: "time_objects",
        //     sort: false,
        //     width: "360",
        //     thclass: "tb-head",
        //     contentClass: "table-content",
        //     cell: TimeObjectsSummary,
        // },
        {
            name: "Actions",
            selector: "linksInfo",
            tableClasses: "table-striped",
            contentClass: "table-content",
            thclass: "tb-head",
            onEditClick: (row) => {
                setShowStageTimeMappingModal(row);
            },
            onDeleteClick: (row) => {
                setDeleteRow(row);
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
                            tableTitle="Stage Time Mappings"
                            isAddEnabled
                            addModalLabel="Add Stage Time Mapping"
                            setSearch={(e) =>
                                setParams({ ...params, searchTerm: e, page: 1 })
                            }
                            onAddModalClick={() => setShowStageTimeMappingModal(true)}
                            exportTitle="Export"
                            exportLoader={false}
                        />
                    </div>

                    <CustomTable
                        isLoading={isLoadingGet}
                        pagination={{ currentPage: params.page, limit: params.limit }}
                        tableClasses="px-start"
                        count={Number(totalCount) || 0}
                        columns={cols}
                        data={Array.isArray(stageTimeMappings) ? stageTimeMappings : []}
                        getRowKey={(row) =>
                            `${row?.stage_id ?? ""}-${row?.port_id ?? ""}-${row?.call_type_id ?? ""}`
                        }
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

                    {showStageTimeMappingModal && (
                        <StageTimeMappingModal
                            showModal={showStageTimeMappingModal}
                            closeModal={() => setShowStageTimeMappingModal(false)}
                            onSuccess={() => getStageTimeMappings?.(apiParams)}
                        />
                    )}
                    {!!showDeleteModal && (
                        <DeleteConfirmationModal
                            show={showDeleteModal}
                            onCancel={() => {
                                setShowDeleteModal(false);
                                setDeleteRow(null);
                            }}
                            onConfirm={() => {
                                if (!deleteRow) {
                                    setShowDeleteModal(false);
                                    return;
                                }
                                mapTimeObjectsToStage({
                                    payload: {
                                        stage_id: Number(deleteRow.stage_id),
                                        port_id: Number(deleteRow.port_id),
                                        call_type_id: Number(deleteRow.call_type_id),
                                        time_objects: [],
                                    },
                                    cb: () => {
                                        setShowDeleteModal(false);
                                        setDeleteRow(null);
                                        getStageTimeMappings?.(apiParams);
                                    },
                                });
                            }}
                            deleteText="Remove all time objects for this stage, port, and call type?"
                            isLoading={isBeingUpdated}
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default StageTimeMappings;
