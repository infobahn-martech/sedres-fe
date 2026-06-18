import { useState, useMemo, useEffect } from "react";
import { RenderAction } from "./RenderCells";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import { VesselModal } from "./Modals/AddEditVessel";
import { ViewVesselModal } from "./Modals/ViewVessel";
import useVesselReducer from "../../store/VesselReducer";

export function truncateText(value, limit) {
  const s = value == null ? "" : String(value);
  if (s.length <= limit) return s;
  return `${s.slice(0, limit)}...`;
}

const ellipsisOverflowStyle = {
  whiteSpace: "nowrap",
  // overflow: "hidden",
  textOverflow: "ellipsis",
  display: "inline-block",
  maxWidth: "100%",
};

export function EllipsisText({ value, limit, title }) {
  const full = value == null ? "" : String(value);
  const display = truncateText(full, limit);
  const showTitle = full.length > limit;
  return (
    <span
      title={showTitle ? title ?? full : undefined}
      style={ellipsisOverflowStyle}
    >
      {display}
    </span>
  );
}

/** Truncated column header with native tooltip; use for long labels without changing `selector` / sorting. */
export function EllipsisHeader({ label, limit }) {
  const full = label == null ? "" : String(label);
  const display = truncateText(full, limit);
  const showTitle = full.length > limit;
  return (
    <span title={showTitle ? full : undefined} style={ellipsisOverflowStyle}>
      {display}
    </span>
  );
}

const Vessel = () => {
  const [params, setParams] = useState({
    page: 1,
    total: 0,
    limit: 10,
    search: "",
    sortOrder: -1,
    sortBy: "vessel_name",
  });

  const [filters, setFilters] = useState({
    vesselType: "",
  });

  const [showVesselModal, setShowVesselModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [showViewVesselModal, setShowViewVesselModal] = useState(false);

  const { getVessels, vessels, totalCount, isLoading, archiveVessel, isBeingUpdated } = useVesselReducer(
    (state) => state
  );

  // ✅ Fetch vessels
  useEffect(() => {
    const apiParams = {
      page: params.page,
      limit: params.limit,
      ...(params.search ? { search: params.search } : {}),
      ...(params.sortBy ? { sortBy: params.sortBy } : {}),
    };

    getVessels({ params: apiParams });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.page, params.limit, params.search, params.sortBy, params.sortOrder]);


  // ✅ Extract unique values for filter options
  const vesselTypeOptions = useMemo(() => {
    const standard = ["Bulk", "Container", "Carrier", "Tanker"];
    const fromData = vessels
      .map((v) => v.vessel_type ?? v.vesselType)
      .filter(Boolean);
    return [...new Set([...standard, ...fromData])];
  }, [vessels]);

  // ✅ Filter configuration (type filter is client-side on the current page)
  const filterOptions = useMemo(
    () => [
      {
        key: "vesselType",
        label: "Type",
        placeholder: "Select Type",
        options: vesselTypeOptions,
      },
    ],
    [vesselTypeOptions]
  );

  const filteredVessels = useMemo(() => {
    if (!filters.vesselType) return vessels;
    return vessels.filter(
      (v) => (v.vessel_type ?? v.vesselType) === filters.vesselType
    );
  }, [vessels, filters.vesselType]);

  const handleClearFilter = () => {
    setFilters({ vesselType: "" });
    setParams((prev) => ({ ...prev, page: 1 }));
  };

  const cols = useMemo(
    () => [
      {
        name: "Vessel",
        selector: "vessel_name",
        sort: true,
        thclass: "tb-head",
        width: "220",
      },
      {
        name: "Unique ID",
        selector: "vessel_unique_id",
        sort: true,
        thclass: "tb-head",
        width: "160",
      },
      {
        name: "Type",
        selector: "vessel_type",
        sort: true,
        thclass: "tb-head",
        width: "140",
      },
      {
        name: "Billing Entity",
        selector: "billing_entity",
        sort: true,
        thclass: "tb-head",
        width: "200",
      },
      // {
      //   name: "Owner",
      //   selector: "vessel_owner",
      //   sort: true,
      //   thclass: "tb-head",
      //   width: "180",
      // },
      // {
      //   name: "Manager",
      //   selector: "vessel_manager",
      //   sort: true,
      //   thclass: "tb-head",
      //   width: "180",
      // },
      // {
      //   name: "Principal",
      //   selector: "vessel_principal",
      //   sort: true,
      //   thclass: "tb-head",
      //   width: "180",
      // },
      // {
      //   name: "Flag",
      //   selector: "flag_state",
      //   sort: true,
      //   thclass: "tb-head",
      //   width: "150",
      // },
      {
        name: "Gross Tonnage",
        selector: "gross_tonnage",
        sort: true,
        thclass: "tb-head",
        width: "200",
      },
      // {
      //   name: "Year",
      //   selector: "year_built",
      //   sort: true,
      //   thclass: "tb-head",
      //   width: "100",
      // },
      {
        name: <EllipsisHeader label="Days to MWP expiry" limit={12} />,
        selector: "days_to_expiry",
        sort: true,
        thclass: "tb-head",
        width: "160",
      },
      {
        name: "Status",
        selector: "status",
        thclass: "tb-head",
        width: "130",
        cell: ({ row }) => (
          <span className={row?.status === '2' ? 'status-pending' : 'status-active'}>
            {row?.status === '2' ? 'Archive' : 'Active'}
          </span>
        ),
      },
      {
        name: "Actions",
        selector: "links_info",
        thclass: "tb-head",
        onEditClick: (row) => setShowVesselModal(row),
        onArchiveClick: (row) => { setSelectedVessel(row); setShowArchiveModal(true); },
        onUnarchiveClick: (row) => { setSelectedVessel(row); setShowUnarchiveModal(true); },
        cell: RenderAction,
        width: "180",
      },
    ],
    []
  );

  return (
    <>
      <div className="page-body">
        <div className="prospect employee">
          <div className="container-fluid">
            <CommonHeader
              tableTitle="Vessels"
              isAddEnabled
              addModalLabel="Add Vessel"
              setSearch={(e) =>
                setParams((prev) => ({ ...prev, search: e, page: 1, limit: 10 }))
              }
              onAddModalClick={() => setShowVesselModal(true)}
              exportTitle="Export"
              exportLoader={false}
              filterOptions={filterOptions}
              filterValue={filters}
              setFilterValue={setFilters}
              onClearFilter={handleClearFilter}
            />
          </div>

          <CustomTable
            pagination={{ currentPage: params.page, limit: params.limit }}
            tableClasses="px-start"
            count={totalCount ?? filteredVessels.length}
            columns={cols}
            data={filteredVessels}
            Sl={false}
            loading={isLoading}
            onPageChange={(currentPage) =>
              setParams((prev) => ({ ...prev, page: currentPage }))
            }
            setLimit={(newlimit) =>
              setParams((prev) => ({ ...prev, limit: newlimit }))
            }
            onSorting={(sortBy) => {
              setParams((prev) => ({
                ...prev,
                sortBy,
                sortOrder: prev.sortOrder === -1 ? 1 : -1,
                page: 1,
              }));
            }}
          />

          {!!showVesselModal && (
            <VesselModal
              key={
                showVesselModal === true
                  ? "vessel-add"
                  : String(
                    showVesselModal?.vessel_id ??
                    showVesselModal?._id ??
                    "vessel-edit"
                  )
              }
              showModal={showVesselModal}
              closeModal={() => setShowVesselModal(false)}
              callBack={() =>
                getVessels({
                  params: {
                    page: 1,
                    limit: 10,
                    search: "",
                    sortBy: "vessel_name",
                  },
                })
              }
            />
          )}

          {!!showViewVesselModal && (
            <ViewVesselModal
              showModal={showViewVesselModal}
              closeModal={() => setShowViewVesselModal(false)}
            />
          )}

          {!!showArchiveModal && (
            <DeleteConfirmationModal
              show={showArchiveModal}
              onCancel={() => { setShowArchiveModal(false); setSelectedVessel(null); }}
              onConfirm={() => {
                archiveVessel({
                  vesselId: selectedVessel?.vessel_id,
                  cb: () => {
                    setShowArchiveModal(false);
                    setSelectedVessel(null);
                  },
                });
              }}
              deleteText={`Are you sure you want to archive "${selectedVessel?.vessel_name ?? 'this vessel'}"?`}
              isLoading={isBeingUpdated}
            />
          )}

          {!!showUnarchiveModal && (
            <DeleteConfirmationModal
              show={showUnarchiveModal}
              onCancel={() => { setShowUnarchiveModal(false); setSelectedVessel(null); }}
              onConfirm={() => { setShowUnarchiveModal(false); setSelectedVessel(null); }}
              deleteText={`Are you sure you want to unarchive "${selectedVessel?.vessel_name ?? 'this vessel'}"?`}
              isLoading={isBeingUpdated}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default Vessel;
