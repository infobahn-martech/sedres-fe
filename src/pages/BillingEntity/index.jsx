import { useState, useEffect, useCallback } from "react";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import { BillingEntityModal } from "./Modals/AddEditBillingEntity";
import { RenderAction } from "./RenderCells";
import useBillingEntityReducer from "../../store/BillingEntityReducer";
import usePermissions from "../../shared/hooks/usePermissions";
import { PERMISSION_MODULES, PERMISSION_SUBMODULES, PERMISSION_ACTIONS } from "../../shared/constants/permissions";
import "../../design/scss/pages/billing-entity/BillingEntity.scss";

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
  const { hasPermission } = usePermissions();
  const canEditBillingEntity = hasPermission({
    moduleKey: PERMISSION_MODULES.ENTITY_MANAGEMENT,
    submoduleKey: PERMISSION_SUBMODULES.BILLING_ENTITY,
    actionKey: PERMISSION_ACTIONS.EDIT,
  });

  const [params, setParams] = useState({
    page: 1,
    total: 0,
    limit: 10,
    searchTerm: "",
    sortOrder: 1,
    sortBy: "customer_code",
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
      ...(params.searchTerm && { search: params.searchTerm }),
      ...(params.sortBy && { sort_by: params.sortBy }),
      ...(params.sortOrder != null && { sort_order: params.sortOrder }),
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
      width: "300",
      thclass: "tb-head",
      contentClass: "table-content",
      colClassName: "billing-entity-cell",
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
      name: "Balance",
      selector: "balance",
      sort: true,
      width: "200",
      thclass: "tb-head",
      contentClass: "table-content",
    },
    {
      name: "Credit Limit",
      selector: "credit_limit",
      sort: true,
      width: "150",
      thclass: "tb-head",
      contentClass: "table-content",
      cell: ({ row }) => {
        const limit = row?.credit_limit ?? row?.creditLimit ?? null;
        if (limit === null || limit === undefined || limit === "") return "—";
        const num = Number(limit);
        return isNaN(num) ? limit : num.toLocaleString("en-US");
      },
    },
    {
      name: "Actions",
      selector: "actions",
      width: "120",
      cell: RenderAction,
      thclass: "tb-head",
      hideDelete: true,
      canEditBillingEntity,
      onEditClick: (row) => {
        if (!canEditBillingEntity) return;
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
        <div className="prospect employee billing-entity-page">
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
            Sl
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
