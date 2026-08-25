import { useState } from "react";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { CustomFieldModal } from "./Modals/AddEditCustomFeild";
import { RenderAction } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import { CUSTOM_FIELDS, getCustomFieldDescription, CUSTOM_FIELD_TYPES } from "../../shared/constants/customFields";


const dummyCustomFields = CUSTOM_FIELDS.map((customField, index) => ({
    _id: `${index + 1}`,
    name: customField,
    description: getCustomFieldDescription(customField),
    type: CUSTOM_FIELD_TYPES[index % CUSTOM_FIELD_TYPES.length],
    order: index + 1,
    isRequired: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    updatedAt: new Date(),
}));

const CustomFields = () => {
    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "name",
        sortOrder: 1,
    });

    const [showCustomFieldModal, setShowCustomFieldModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

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
            name: "Type",
            selector: "type",
            sort: true,
            width: "150",
            thclass: "tb-head",
            contentClass: "table-content",
            cell: (row) => row?.type || "-",
        },
        {
            name: "Required",
            selector: "isRequired",
            sort: true,
            width: "120",
            thclass: "tb-head",
            contentClass: "table-content",
            cell: (row) => (row?.isRequired ? "Yes" : "No"),
        },
        {
            name: "Status",
            selector: "isActive",
            sort: true,
            width: "140",
            thclass: "tb-head",
            contentClass: "table-content",
            cell: (row) => (row?.isActive ? "Active" : "Inactive"),
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
                setShowCustomFieldModal(row);
            },
            onDeleteClick: () => {
                // you can store row in state if needed
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
                            tableTitle="Custom Fields"
                            isAddEnabled
                            addModalLabel="Add Custom Field"
                            setSearch={(val) =>
                                setParams({ ...params, searchTerm: val, page: 1 })
                            }
                            onAddModalClick={() => setShowCustomFieldModal({})}
                            exportTitle="Export"
                            exportLoader={false}
                        />
                    </div>

                    <CustomTable
                        Sl
                        pagination={{ currentPage: params.page, limit: params.limit }}
                        tableClasses="px-start"
                        count={dummyCustomFields.length}
                        columns={cols}
                        data={dummyCustomFields}
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

                    {!!showCustomFieldModal && (
                        <CustomFieldModal
                            showModal={showCustomFieldModal}
                            closeModal={() => setShowCustomFieldModal(false)}
                        />
                    )}

                    {!!showDeleteModal && (
                        <DeleteConfirmationModal
                            show={showDeleteModal}
                            onCancel={() => setShowDeleteModal(false)}
                            onConfirm={() => {
                                // handle delete here
                                setShowDeleteModal(false);
                            }}
                            deleteText="Are you sure you want to delete this custom field?"
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default CustomFields;
