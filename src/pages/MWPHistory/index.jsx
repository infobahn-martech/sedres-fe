import { useEffect, useMemo } from "react";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import useMWPHistoryReducer from "../../store/MWPHistoryReducer";
import { RenderAction, DateFormat, RenderStatus } from "./RenderCells";
import "../../design/scss/pages/mwp-history/Crew.scss";

const getMwpFileUrl = (fileName) => {
  if (!fileName) return "";
  const base = (import.meta.env.VITE_API_ENDPOINT || "").replace(/\/+$/, "");
  return `${base}/${String(fileName).replace(/^\/+/, "")}`;
};

const MWPHistory = () => {
    const { fetchAllMWPHistory, mwpHistory, isLoadingGet } =
        useMWPHistoryReducer((state) => state);

    useEffect(() => {
        fetchAllMWPHistory();
    }, [fetchAllMWPHistory]);

    const tableData = useMemo(() => {
        const rows = Array.isArray(mwpHistory) ? mwpHistory : [];
        return { rows, total: rows.length };
    }, [mwpHistory]);

    const limit = tableData.total || 10;

    const handleViewDocument = (row) => {
        const url = getMwpFileUrl(row?.mwp_document);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
    };

    const cols = [
        {
            name: "MWP ID",
            selector: "mwp_id",
            tableClasses: "table-striped",
            contentClass: "table-content",
            sort: false,
            thclass: "tb-head",
            width: "150",
        },
        {
            name: "Document",
            selector: "mwp_document",
            tableClasses: "table-striped",
            contentClass: "table-content",
            sort: false,
            thclass: "tb-head",
            width: "250",
        },
        {
            name: "Expiry Date",
            selector: "expiry_date",
            tableClasses: "table-striped",
            contentClass: "table-content",
            sort: false,
            thclass: "tb-head",
            width: "170",
            cell: ({ row, selector }) => <DateFormat row={row} selector={selector} />,
        },
        {
            name: "Status",
            selector: "status",
            tableClasses: "table-striped",
            contentClass: "table-content",
            sort: false,
            thclass: "tb-head",
            width: "150",
            cell: ({ row }) => <RenderStatus row={row} />,
        },
        // {
        //     name: "Action",
        //     selector: "action",
        //     tableClasses: "table-striped",
        //     contentClass: "table-content",
        //     sort: false,
        //     thclass: "tb-head",
        //     width: "100",
        //     notView: true,
        //     cell: ({ row }) =>
        //         row?.mwp_document ? (
        //             <RenderAction row={row} onViewClick={handleViewDocument} />
        //         ) : (
        //             "—"
        //         ),
        // },
    ];

    return (
        <div className="page-body">
            <div className="prospect employee">
                <div className="container-fluid">
                    <CommonHeader
                        tableTitle="MWP History"
                        isAddEnabled={false}
                        addModalLabel="Add MWP"
                        hideSearch
                        setSearch={() => { }}
                        exportTitle="Export"
                        exportLoader={false}
                    />
                </div>

                <CustomTable
                    Sl
                    isLoading={isLoadingGet}
                    pagination={{ currentPage: 1, limit }}
                    tableClasses="px-start"
                    count={tableData.total}
                    columns={cols}
                    data={tableData.rows}
                />
            </div>
        </div>
    );
};

export default MWPHistory;