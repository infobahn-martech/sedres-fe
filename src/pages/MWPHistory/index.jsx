import { useEffect, useMemo, useState } from "react";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import useMWPHistoryReducer from "../../store/MWPHistoryReducer";
import useAlertReducer from "../../store/AlertReducer";
import mwpHistoryService from "../../services/mwpHistoryService";
import { RenderAction, DateFormat, DateTimeFormat, RenderText, RenderStatus } from "./RenderCells";
import SendReminderModal from "./SendReminderModal";
import "../../design/scss/pages/mwp-history/Crew.scss";

const getMwpFileUrl = (fileName) => {
  if (!fileName) return "";
  const base = (import.meta.env.VITE_API_ENDPOINT || "").replace(/\/+$/, "");
  return `${base}/${String(fileName).replace(/^\/+/, "")}`;
};

const MWPHistory = () => {
    const { fetchAllMWPHistory, mwpHistory, isLoadingGet } =
        useMWPHistoryReducer((state) => state);

    const [showReminderModal, setShowReminderModal] = useState(false);
    const [reminderRow, setReminderRow] = useState(null);
    const [reminderDefaultTo, setReminderDefaultTo] = useState("");
    const [isLoadingReminderEmails, setIsLoadingReminderEmails] = useState(false);
    const [isSendingReminder, setIsSendingReminder] = useState(false);

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

    // Fetches the suggested recipients (vessel/mwp_reminder_emails/{mwp_id}) right before
    // opening the modal, same "fetch draft, then open" pattern used by the SO approval email
    // modal — best effort: if it fails, the modal still opens with an empty "To" instead of
    // blocking the reminder from being sent.
    const handleOpenReminderModal = async (row) => {
        setReminderRow(row);
        setReminderDefaultTo("");
        setShowReminderModal(true);
        if (!row?.mwp_id) return;
        setIsLoadingReminderEmails(true);
        try {
            const { data } = await mwpHistoryService.getMWPReminderEmails(row.mwp_id);
            const emails = Array.isArray(data?.data) ? data.data : [];
            setReminderDefaultTo(emails.filter(Boolean).join(", "));
        } catch {
            setReminderDefaultTo("");
        } finally {
            setIsLoadingReminderEmails(false);
        }
    };

    const handleCloseReminderModal = () => {
        if (isSendingReminder) return;
        setShowReminderModal(false);
        setReminderRow(null);
    };

    const handleSendReminder = async (payload) => {
        if (!reminderRow?.mwp_id) return;
        setIsSendingReminder(true);
        try {
            const formData = new FormData();
            formData.append("call_id", reminderRow.mwp_id);
            formData.append("to_emails", payload?.to ?? "");
            formData.append("cc_emails", payload?.cc ?? "");
            formData.append("subject", payload?.subject ?? "");
            formData.append("body", payload?.body ?? "");
            (payload?.attachments || []).forEach((file) => formData.append("attachments[]", file));

            const { data } = await mwpHistoryService.sendMWPReminderEmail(formData);
            if (!data || data.status === "error" || data.status === false) {
                useAlertReducer.getState().error(data?.message || "Failed to send reminder email.");
                return;
            }
            useAlertReducer.getState().success("Reminder email sent.");
            setShowReminderModal(false);
            setReminderRow(null);
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || "Failed to send reminder email.";
            useAlertReducer.getState().error(msg);
        } finally {
            setIsSendingReminder(false);
        }
    };

    const cols = [
        {
            name: "Billing Entity",
            selector: "billing_entity",
            tableClasses: "table-striped",
            contentClass: "table-content",
            sort: false,
            thclass: "tb-head",
            width: "200",
            cell: ({ row, selector }) => <RenderText row={row} selector={selector} />,
        },
        {
            name: "Application Number",
            selector: "application_number",
            tableClasses: "table-striped",
            contentClass: "table-content",
            sort: false,
            thclass: "tb-head",
            width: "160",
            cell: ({ row, selector }) => <RenderText row={row} selector={selector} />,
        },
        {
            name: "SADAD Number",
            selector: "sadad_number",
            tableClasses: "table-striped",
            contentClass: "table-content",
            sort: false,
            thclass: "tb-head",
            width: "150",
            cell: ({ row, selector }) => <RenderText row={row} selector={selector} />,
        },
        {
            name: "Applied Date",
            selector: "applied_date",
            tableClasses: "table-striped",
            contentClass: "table-content",
            sort: false,
            thclass: "tb-head",
            width: "170",
            cell: ({ row, selector }) => <DateTimeFormat row={row} selector={selector} />,
        },
        {
            name: "Approved Date",
            selector: "approved_date",
            tableClasses: "table-striped",
            contentClass: "table-content",
            sort: false,
            thclass: "tb-head",
            width: "170",
            cell: ({ row, selector }) => <DateTimeFormat row={row} selector={selector} />,
        },
        {
            name: "Expiry Date",
            selector: "expiry_date",
            tableClasses: "table-striped",
            contentClass: "table-content",
            sort: false,
            thclass: "tb-head",
            width: "150",
            cell: ({ row, selector }) => <DateFormat row={row} selector={selector} />,
        },
        {
            name: "Status",
            selector: "status",
            tableClasses: "table-striped",
            contentClass: "table-content",
            sort: false,
            thclass: "tb-head",
            width: "130",
            cell: ({ row }) => <RenderStatus row={row} />,
        },
        {
            name: "Action",
            selector: "action",
            tableClasses: "table-striped",
            contentClass: "table-content",
            sort: false,
            thclass: "tb-head",
            width: "100",
            notView: true,
            cell: ({ row }) => (
                <RenderAction row={row} onViewClick={handleViewDocument} onSendClick={handleOpenReminderModal} />
            ),
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

            <SendReminderModal
                show={showReminderModal}
                onClose={handleCloseReminderModal}
                onSend={handleSendReminder}
                isSubmitting={isSendingReminder}
                row={reminderRow}
                defaultTo={reminderDefaultTo}
                isLoadingTo={isLoadingReminderEmails}
            />
        </div>
    );
};

export default MWPHistory;
