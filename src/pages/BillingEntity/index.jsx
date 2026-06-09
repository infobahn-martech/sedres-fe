import { useState, useEffect, useCallback } from "react";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import { BillingEntityModal } from "./Modals/AddEditBillingEntity";
import { RenderAction } from "./RenderCells";
import useBillingEntityReducer from "../../store/BillingEntityReducer";

const resolveLogoUrl = (logoValue) => {
  if (!logoValue) return "";
  const logo = String(logoValue).trim();
  if (!logo) return "";
  if (/^(https?:)?\/\//i.test(logo) || /^data:/i.test(logo) || /^blob:/i.test(logo)) {
    return logo;
  }
  const envBase = import.meta.env.VITE_API_ENDPOINT || "";
  if (!envBase) return logo;
  const normalizedBase = envBase.endsWith("/") ? envBase.slice(0, -1) : envBase;
  const rootBase = normalizedBase.endsWith("/api")
    ? normalizedBase.slice(0, -4)
    : normalizedBase;
  return `${rootBase}${logo.startsWith("/") ? "" : "/"}${logo}`;
};

const BillingEntity = () => {
  const [params, setParams] = useState({
    page: 1,
    total: 0,
    limit: 10,
    searchTerm: "",
    sortOrder: -1,
    sortBy: "createdAt",
  });

  const [showBillingEntityModal, setShowBillingEntityModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const {
    getBillingEntities,
    billingEntities,
    totalCount,
    isLoading,
    getEntityDetailById,
    selectedBillingEntity,
  } = useBillingEntityReducer((state) => state);

  const fetchBillingEntities = useCallback(() => {
    const apiParams = {
      page: params.page,
      limit: params.limit,
      ...(params.searchTerm && { searchTerm: params.searchTerm }),
      ...(params.sortBy && { sortBy: params.sortBy }),
      ...(params.sortOrder != null && { sortOrder: params.sortOrder }),
    };
    getBillingEntities({ params: apiParams });
  }, [getBillingEntities, params]);

  useEffect(() => {
    fetchBillingEntities();
  }, [fetchBillingEntities]);

  const renderLogoCell = ({ row }) => {
    const logoUrl = resolveLogoUrl(
      row?.entity_logo ?? row?.logo_path ?? row?.logo ?? row?.entityLogo
    );

    return logoUrl ? (
      <img
        src={logoUrl}
        alt={`${row?.billing_entity || "Billing Entity"} logo`}
        className="table-logo-img"
      />
    ) : (
      <span className="text-muted small">No Logo</span>
    );
  };

  const cols = [
    {
      name: "Logo",
      selector: "entity_logo",
      width: "140",
      cell: renderLogoCell,
      thclass: "tb-head",
      contentClass: "table-content",
      notView: true,
    },
    {
      name: "Billing Entity",
      selector: "billing_entity",
      sort: true,
      width: "200",
      thclass: "tb-head",
      contentClass: "table-content",
    },
    {
      name: "Customer Code",
      selector: "customer_code",
      sort: true,
      width: "200",
      thclass: "tb-head",
      contentClass: "table-content",
    },
    {
      name: "Contact Person",
      selector: "contact_name",
      sort: true,
      width: "220",
      thclass: "tb-head",
      contentClass: "table-content",
    },
    {
      name: "Phone No.",
      selector: "phoneNumber",
      sort: true,
      width: "180",
      thclass: "tb-head",
      contentClass: "table-content",
    },
    {
      name: "Actions",
      selector: "actions",
      width: "120",
      cell: RenderAction,
      thclass: "tb-head",
      hideDelete: true,
      onEditClick: (row) => {
        getEntityDetailById({
          entityId: row.entity_id,
          cb: () => setShowBillingEntityModal(true),
        });
      },
    },
  ];


  return (
    <>
      <div className="page-body">
        <div className="prospect employee">
          <div className="container-fluid">
            <CommonHeader
              tableTitle="Billing Accounts"
              isAddEnabled={false}
              setSearch={(e) =>
                setParams((prev) => ({ ...prev, searchTerm: e, page: 1, limit: 10 }))
              }
              exportTitle="Export"
              exportLoader={false}
            />
          </div>

          <CustomTable
            pagination={{ currentPage: params?.page, limit: params?.limit }}
            tableClasses="px-start"
            count={totalCount}
            columns={cols}
            isLoading={isLoading}
            data={billingEntities ?? []}
            onPageChange={(currentPage) =>
              setParams((prev) => ({ ...prev, page: currentPage }))
            }
            setLimit={(newlimit) => setParams((prev) => ({ ...prev, limit: newlimit }))}
            onSorting={(sortBy) => {
              setParams((prev) => ({
                ...prev,
                sortBy,
                sortOrder: prev?.sortOrder === -1 ? 1 : -1,
                page: 1,
              }));
            }}
          />
          {!!showBillingEntityModal && (
            <BillingEntityModal
              showModal={selectedBillingEntity}
              closeModal={() => setShowBillingEntityModal(false)}
              onSuccess={() => fetchBillingEntities()}
            />
          )}

          {!!showDeleteModal && (
            <DeleteConfirmationModal
              show={showDeleteModal}
              onCancel={() => setShowDeleteModal(false)}
              onConfirm={() => setShowDeleteModal(false)}
              deleteText="Are you sure you want to delete this billing entity?"
            />
          )}


        </div>
      </div>
    </>
  );
};

export default BillingEntity;
