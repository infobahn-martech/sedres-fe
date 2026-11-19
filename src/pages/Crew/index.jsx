import { useCallback, useEffect, useMemo, useState } from "react";
import moment from "moment";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { ViewCrewModal } from "./Modals/ViewCrew";
import "../../design/scss/pages/crew/Crew.scss";

import useCrewReducer from "../../store/CrewReducer";

const formatShortDate = (value) => {
    if (value == null || value === "") return "—";
    const m = moment(value);
    return m.isValid() ? m.format("DD/MM/YYYY") : String(value);
};

function DocLink({ href, children }) {
    if (!href) return "—";
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="crew-doc-link"
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </a>
    );
}

const Crew = () => {
    const { fetchAllCrews, crews, isLoading } = useCrewReducer((state) => state);

    const [viewModal, setViewModal] = useState(null);
    const [expandedKeys, setExpandedKeys] = useState(() => new Set());

    const [params, setParams] = useState({
        page: 1,
        limit: 10,
        search: "",
    });

    useEffect(() => {
        fetchAllCrews({
            params: {
                page: params.page,
                limit: params.limit,
                search: params.search,
                sort_by: params.sortBy,
                sort_order: params.sortOrder,
            },
        });
    }, [params.page, params.limit, params.search, params.sortBy, params.sortOrder]);

    const tableData = useMemo(() => {
        if (!crews) return { rows: [], total: 0 };

        const rows = Array.isArray(crews)
            ? crews
            : crews?.data || crews?.crews || crews?.docs || crews?.results || [];
        const total =
            crews?.pagination?.total ||
            crews?.total ||
            crews?.count ||
            crews?.totalDocs ||
            rows.length;

        return { rows, total };
    }, [crews]);

    const getRowKey = useCallback((row, idx) => row?.crew_id ?? row?.id ?? row?._id ?? idx, []);

    const isRowExpanded = useCallback(
        (_row, rowKey) => expandedKeys.has(rowKey),
        [expandedKeys]
    );

    const onExpandToggle = useCallback((_row, rowKey) => {
        setExpandedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(rowKey)) next.delete(rowKey);
            else next.add(rowKey);
            return next;
        });
    }, []);

    const cols = useMemo(
        () => [
            {
                name: "Crew ID",
                selector: "crew_id",
                tableClasses: "table-striped",
                contentClass: "table-content",
                sort: true,
                thclass: "tb-head",
                width: "100",
            },
            {
                name: "Crew Name",
                selector: "crew_name",
                tableClasses: "table-striped",
                contentClass: "table-content",
                sort: true,
                thclass: "tb-head",
                width: "180",
            },
            {
                name: "Rank",
                selector: "rank",
                tableClasses: "table-striped",
                contentClass: "table-content",
                sort: true,
                thclass: "tb-head",
                width: "140",
            },
            {
                name: "Date of Birth",
                selector: "date_of_birth",
                tableClasses: "table-striped",
                contentClass: "table-content",
                sort: true,
                thclass: "tb-head",
                width: "130",
                cell: ({ row }) => formatShortDate(row.date_of_birth),
            },
            {
                name: "Nationality",
                selector: "nationality",
                tableClasses: "table-striped",
                contentClass: "table-content",
                sort: true,
                thclass: "tb-head",
                width: "130",
                cell: ({ row }) => row.nationality ?? row.country ?? "—",
            },
            {
                name: "Passport No",
                selector: "passport_no",
                tableClasses: "table-striped",
                contentClass: "table-content",
                sort: true,
                thclass: "tb-head",
                width: "160",
                notView: true,
                cell: ({ row }) => (
                    <div className="crew-cell-with-doc">
                        <span>{row.passport_no ?? "—"}</span>
                        {row.passport_doc_url ? (
                            <DocLink href={row.passport_doc_url}>Doc</DocLink>
                        ) : null}
                    </div>
                ),
            },
            {
                name: "Visa No",
                selector: "visa_no",
                tableClasses: "table-striped",
                contentClass: "table-content",
                sort: true,
                thclass: "tb-head",
                width: "160",
                notView: true,
                cell: ({ row }) => (
                    <div className="crew-cell-with-doc">
                        <span>{row.visa_no ?? "—"}</span>
                        {row.visa_doc_url ? <DocLink href={row.visa_doc_url}>Doc</DocLink> : null}
                    </div>
                ),
            },
        ],
        []
    );

    const renderExpandedRow = useCallback(
        (row) => {
            const history = Array.isArray(row.history) ? row.history : [];
            return (
                <div className="crew-history-panel">
                    <div className="crew-history-title">Movement history</div>
                    <div className="table-responsive crew-history-table-wrap">
                        <table className="table table-sm table-bordered crew-history-table mb-0">
                            <thead>
                                <tr>
                                    <th>SignOn/SignOff</th>
                                    <th>Vessel name</th>
                                    <th>Billing entity</th>
                                    <th>CG pass no</th>
                                    <th>Zawil pass no</th>
                                    <th>CG pass doc</th>
                                    <th>Zawil pass doc</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="crew-history-empty">
                                            No movement history
                                        </td>
                                    </tr>
                                ) : (
                                    history.map((h, i) => (
                                        <tr key={h.id ?? `${row.crew_id ?? "c"}-h-${i}`}>
                                            <td>{h.movement_type ?? "—"}</td>
                                            <td>{h.vessel_name ?? "—"}</td>
                                            <td>{h.billing_entity ?? "—"}</td>
                                            <td>{h.cg_pass_no ?? "—"}</td>
                                            <td>{h.zawil_pass_no ?? "—"}</td>
                                            <td>
                                                <DocLink href={h.cg_pass_doc_url}>View</DocLink>
                                            </td>
                                            <td>
                                                <DocLink href={h.zawil_pass_doc_url}>View</DocLink>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        },
        []
    );

    const handleViewClick = (row) => {
        setViewModal({
            ...row,
            crewName: row.crew_name ?? row.crewName,
            nationality: row.nationality ?? row.country,
            passport: row.passport_no ?? row.passport,
            visa: row.visa_no ?? row.visa,
            cgPass: row.cg_pass_no ?? row.cgPass,
            zawilPass: row.zawil_pass_no ?? row.zawilPass,
        });
    };

    return (
        <>
            <div className="page-body">
                <div className="prospect employee">
                    <div className="container-fluid">
                        <CommonHeader
                            tableTitle="Crew Management"
                            isAddEnabled={false}
                            addModalLabel="Add Crew"
                            setSearch={(e) =>
                                setParams({ ...params, search: e, page: 1, limit: 10 })
                            }
                            exportTitle="Export"
                            exportLoader={false}
                        />
                    </div>

                    <CustomTable
                        Sl
                        isLoading={isLoading}
                        pagination={{ currentPage: params.page, limit: params.limit }}
                        tableClasses="px-start"
                        count={tableData.total}
                        columns={cols}
                        data={tableData.rows}
                        expandable
                        getRowKey={getRowKey}
                        isRowExpanded={isRowExpanded}
                        onExpandToggle={onExpandToggle}
                        renderExpandedRow={renderExpandedRow}
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
                                sortOrder: params.sortOrder === -1 ? 1 : -1,
                                page: 1,
                            })
                        }
                        onView={handleViewClick}
                    />
                </div>
            </div>

            {!!viewModal && (
                <ViewCrewModal showModal={viewModal} closeModal={() => setViewModal(null)} />
            )}
        </>
    );
};

export default Crew;
