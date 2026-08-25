import { useEffect, useMemo, useState } from "react";
import { debounce } from "lodash";
import { DateFormat } from "./RenderCells";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import useActivityLogReducer from "../../store/ActivityLogReducer";
import "../../design/scss/pages/activity-log/ActivityLog.scss";

const ActivityLog = () => {
  const { getActivityLogData, activityLogData, isLoading, totalActivityLogCount } =
    useActivityLogReducer((state) => state);

  const [params, setParams] = useState({
    page: 1,
    limit: 10,
    search: '',
  });

  useEffect(() => {
    getActivityLogData?.({
      search: params.searchTerm || "",
      page: params.page,
      limit: params.limit,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    });
  }, [
    params.page,
    params.limit,
    params.searchTerm,
    params.sortBy,
    params.sortOrder,
    getActivityLogData,
  ]);

  const debouncedSearch = useMemo(
    () =>
      debounce((value) => {
        setParams((prev) => ({ ...prev, searchTerm: value, page: 1 }));
      }, 500),
    []
  );

  useEffect(() => {
    return () => debouncedSearch.cancel();
  }, [debouncedSearch]);

  const cols = [
    {
      name: 'Date/Time',
      selector: 'updated_date',
      tableClasses: 'table-striped',
      contentClass: 'table-content',
      sort: true,
      thclass: 'tb-head',
      cell: ({ row }) => DateFormat({ row, selector: 'updated_date' }),
      width: '180',
    },
    {
      name: 'User Name',
      selector: 'user_name',
      tableClasses: 'table-striped',
      sort: true,
      contentClass: 'table-content',
      thclass: 'tb-head',
      width: '150',
    },
    {
      name: 'Field Name',
      selector: 'field_name',
      tableClasses: 'table-striped',
      sort: true,
      contentClass: 'table-content',
      thclass: 'tb-head',
      width: '150',
    },
    {
      name: 'Old Value',
      selector: 'old_value',
      tableClasses: 'table-striped',
      sort: true,
      contentClass: 'table-content',
      thclass: 'tb-head',
      width: '200',
    },
    {
      name: 'New Value',
      selector: 'new_value',
      tableClasses: 'table-striped',
      sort: true,
      contentClass: 'table-content',
      thclass: 'tb-head',
      width: '200',
    },
    {
      name: 'Updated By',
      selector: 'updated_by_name',
      tableClasses: 'table-striped',
      sort: true,
      contentClass: 'table-content',
      thclass: 'tb-head',
      width: '150',
    },
  ];

  return (
    <div className="page-body">
      <div className="prospect employee">
        <div className="container-fluid">
          <CommonHeader
            tableTitle="Activity Log"
            isAddEnabled={false}
            addModalLabel="Add Activity Log"
            setSearch={(value) => debouncedSearch(value)}
            exportTitle="Export"
            exportLoader={false}
          />
        </div>

        <CustomTable
          Sl
          isLoading={isLoading}
          pagination={{ currentPage: params.page, limit: params.limit }}
          tableClasses="px-start"
          count={totalActivityLogCount}
          columns={cols}
          data={activityLogData ?? []}
          onPageChange={(currentPage) =>
            setParams((prev) => ({ ...prev, page: currentPage }))
          }
          setLimit={(newLimit) =>
            setParams((prev) => ({ ...prev, limit: newLimit, page: 1 }))
          }
          onSorting={(sortBy) =>
            setParams((prev) => ({
              ...prev,
              sortBy,
              sortOrder: prev.sortOrder === -1 ? 1 : -1,
              page: 1,
            }))
          }
        />
      </div>
    </div>
  );
};

export default ActivityLog;
