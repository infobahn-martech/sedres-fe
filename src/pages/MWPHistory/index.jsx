import { useEffect, useMemo } from "react";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import useMWPHistoryReducer from "../../store/MWPHistoryReducer";
import "../../design/scss/pages/mwp-history/Crew.scss";

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
            selector: "document",
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
        },
        {
            name: "Status",
            selector: "status",
            tableClasses: "table-striped",
            contentClass: "table-content",
            sort: false,
            thclass: "tb-head",
            width: "150",
        },
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