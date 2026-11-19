import { useState, useEffect, useMemo } from 'react';
import { debounce } from 'lodash';
import CommonHeader from '../../components/CommonHeader';
import CustomTable from '../../components/customTable';
import { AddEditCrewImmigrationTemplateModal } from './Modals/AddEditCrewImmigrationTemplate';
import { RenderAction } from './RenderCells';
import { resolveTemplateId } from './templateId';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import useCrewImmigrationTemplateReducer from '../../store/CrewImmigrationTemplateReducer';
import '../../design/scss/pages/crew-immigration-template/CrewImmigrationTemplate.scss';

const CrewImmigrationTemplate = () => {
  const [params, setParams] = useState({
    page: 1,
    searchTerm: '',
    limit: 10,
    sortBy: 'template_name',
    sortOrder: 1,
  });

  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  const { getTemplates, templates, totalCount, deleteTemplate, isLoading, isBeingUpdated } =
    useCrewImmigrationTemplateReducer((s) => s);

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

  const buildParams = () => ({
    search: params.searchTerm || '',
    page: params.page,
    limit: params.limit,
    sort_by: params.sortBy,
  });

  const handleRefresh = () => {
    getTemplates?.({ params: buildParams() });
  };

  useEffect(() => {
    getTemplates?.({ params: buildParams() });
  }, [params.page, params.limit, params.searchTerm, params.sortBy, getTemplates]);

  const cols = [
    {
      name: 'Template Name',
      selector: 'template_name',
      sort: true,
      width: '250',
      thclass: 'tb-head',
      contentClass: 'table-content',
    },
    {
      name: 'Port',
      selector: 'port_name',
      sort: true,
      width: '200',
      thclass: 'tb-head',
      contentClass: 'table-content',
    },
    {
      name: 'Actions',
      selector: 'linksInfo',
      width: '100',
      thclass: 'tb-head',
      contentClass: 'table-content',
      cell: (props) =>
        RenderAction({
          ...props,
          onEditClick: (row) => setShowModal(row),
          onDeleteClick: (row) => {
            setSelectedRow(row);
            setShowDeleteModal(true);
          },
        }),
    },
  ];

  return (
    <div className="page-body crew-immigration-template">
      <div className="prospect employee">
        <div className="container-fluid">
          <CommonHeader
            tableTitle="Crew Immigration Template"
            isAddEnabled
            addModalLabel="Add Crew Immigration Template"
            setSearch={(value) => debouncedSearch(value)}
            onAddModalClick={() => {
              setSelectedRow(null);
              setShowModal(true);
            }}
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
          data={templates}
          count={totalCount}
          onPageChange={(currentPage) => setParams((prev) => ({ ...prev, page: currentPage }))}
          setLimit={(newLimit) => setParams((prev) => ({ ...prev, limit: newLimit, page: 1 }))}
          onSorting={(sortBy) =>
            setParams((prev) => ({
              ...prev,
              sortBy,
              page: 1,
            }))
          }
        />

        {!!showModal && (
          <AddEditCrewImmigrationTemplateModal
            showModal={showModal}
            closeModal={() => {
              setShowModal(false);
              setSelectedRow(null);
            }}
            onSuccess={() => {
              setShowModal(false);
              setSelectedRow(null);
              handleRefresh();
            }}
          />
        )}

        {!!showDeleteModal && (
          <DeleteConfirmationModal
            show={showDeleteModal}
            onCancel={() => {
              setShowDeleteModal(false);
              setSelectedRow(null);
            }}
            onConfirm={() => {
              deleteTemplate({
                templateId: resolveTemplateId(selectedRow),
                cb: () => {
                  setShowDeleteModal(false);
                  setSelectedRow(null);
                  handleRefresh();
                },
              });
            }}
            deleteText={`Are you sure you want to delete "${selectedRow?.template_name ?? 'this template'}"?`}
            isLoading={isBeingUpdated}
          />
        )}
      </div>
    </div>
  );
};

export default CrewImmigrationTemplate;
