import { useState, useEffect, useMemo } from 'react';
import { debounce } from 'lodash';
import CommonHeader from '../../components/CommonHeader';
import CustomTable from '../../components/customTable';
import { AddEditAttachmentModal } from './Modals/AddEditAttachment';
import { RenderAction, RenderFile } from './RenderCells';
import useCommonAttachmentReducer from '../../store/CommonAttachmentReducer';
import '../../design/scss/pages/crew-immigration-template/CrewImmigrationTemplate.scss';

const AttachmentManagement = () => {
  const [params, setParams] = useState({
    page: 1,
    searchTerm: '',
    limit: 10,
    sortBy: 'attachment_type',
  });
  const [showModal, setShowModal] = useState(false);

  const { getAttachments, attachments, totalCount, isLoading } = useCommonAttachmentReducer((s) => s);

  const debouncedSearch = useMemo(
    () =>
      debounce((value) => {
        setParams((prev) => ({ ...prev, searchTerm: value, page: 1 }));
      }, 500),
    []
  );

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const buildParams = () => ({
    search: params.searchTerm || '',
    page: params.page,
    limit: params.limit,
    sort_by: params.sortBy,
  });

  const handleRefresh = () => getAttachments?.({ params: buildParams() });

  useEffect(() => {
    handleRefresh();
  }, [params.page, params.limit, params.searchTerm, params.sortBy, getAttachments]);

  const cols = [
    { name: 'Attachment Type', selector: 'attachment_type', sort: true, width: '220', thclass: 'tb-head', contentClass: 'table-content' },
    { name: 'Category', selector: 'category', sort: true, width: '150', thclass: 'tb-head', contentClass: 'table-content' },
    { name: 'Port', selector: 'port', sort: true, width: '160', thclass: 'tb-head', contentClass: 'table-content' },
    { name: 'Call Type', selector: 'call_type', sort: true, width: '180', thclass: 'tb-head', contentClass: 'table-content' },
    {
      name: 'File',
      selector: 'file_name',
      width: '280',
      thclass: 'tb-head',
      contentClass: 'table-content',
      cell: (props) => RenderFile(props),
    },
    {
      name: 'Actions',
      selector: 'linksInfo',
      width: '100',
      thclass: 'tb-head',
      contentClass: 'table-content',
      cell: (props) => RenderAction({ ...props, onEditClick: (row) => setShowModal(row) }),
    },
  ];

  return (
    <div className="page-body crew-immigration-template">
      <div className="prospect employee">
        <div className="container-fluid">
          <CommonHeader
            tableTitle="Attachment Management"
            isAddEnabled
            addModalLabel="Add Attachment"
            setSearch={(value) => debouncedSearch(value)}
            onAddModalClick={() => setShowModal(true)}
            exportTitle="Export"
            exportLoader={false}
          />
        </div>

        <CustomTable
          Sl
          loading={isLoading}
          pagination={{ currentPage: params.page, limit: params.limit }}
          tableClasses="px-start"
          columns={cols}
          data={attachments}
          count={totalCount}
          onPageChange={(currentPage) => setParams((prev) => ({ ...prev, page: currentPage }))}
          setLimit={(newLimit) => setParams((prev) => ({ ...prev, limit: newLimit, page: 1 }))}
          onSorting={(sortBy) => setParams((prev) => ({ ...prev, sortBy, page: 1 }))}
        />

        {!!showModal && (
          <AddEditAttachmentModal
            showModal={showModal}
            closeModal={() => setShowModal(false)}
            onSuccess={() => {
              setShowModal(false);
              handleRefresh();
            }}
          />
        )}
      </div>
    </div>
  );
};

export default AttachmentManagement;
