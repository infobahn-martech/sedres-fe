import StaticBoard from "./StaticBoard";
import { initialData as adminData } from "../../shared/helpers/Admindata";
import { initialData as daData } from "../../shared/helpers/DAdata";
import { initialData as driverData } from "../../shared/helpers/Driverdata";
import { initialData as groData } from "../../shared/helpers/GROdata";
import { initialData as hotelData } from "../../shared/helpers/Hoteldata";
import { initialData as mwpData } from "../../shared/helpers/MWPdata";
import { initialData as tbcData } from "../../shared/helpers/TBCdata";
import { initialData as tboData } from "../../shared/helpers/TBOdata";
import { initialData as jubailData } from "../../shared/helpers/JubailOperationsdata";
import { initialData as rtData } from "../../shared/helpers/RTdata";
import { initialData as rdData } from "../../shared/helpers/RDdata";

const ADMIN_ACCENT_COLUMNS = {
  workflowId: "import-export-rt",
  titles: ["Cleared", "Inward Completed", "MWP Issued"],
};

export const AdminBoard = () => <StaticBoard initialData={adminData} accentColumns={ADMIN_ACCENT_COLUMNS} />;
export const DADeskBoard = () => <StaticBoard initialData={daData} />;
export const DriverBoard = () => <StaticBoard initialData={driverData} cardFormVariant="driver" />;
export const GROBoard = () => <StaticBoard initialData={groData} cardFormVariant="gro" />;
export const HotelBoard = () => <StaticBoard initialData={hotelData} cardFormVariant="hotel" />;
export const MWPBoard = () => <StaticBoard initialData={mwpData} cardFormVariant="mwp" />;
export const TBCBoard = () => <StaticBoard initialData={tbcData} cardFormVariant="taxi-boat" cardVariant="taxi-boat" />;
export const TBOBoard = () => <StaticBoard initialData={tboData} cardFormVariant="taxi-boat" cardVariant="taxi-boat" />;
export const JubailOperations = () => <StaticBoard initialData={jubailData} />;
export const RastanuraOperations = () => <StaticBoard initialData={rtData} showNestedFooterCount />;
export const RastanuraDammamOperations = () => <StaticBoard initialData={rdData} showNestedFooterCount />;
