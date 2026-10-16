import moment from "moment";
import Admin from "@/models/admin";
import { Trash } from "@phosphor-icons/react";
import { userFromStorage } from "@/utils/request";
import System from "@/models/system";
import { useTranslation } from "react-i18next";

export default function ApiKeyRow({ apiKey, removeApiKey }) {
  const { t } = useTranslation();

  const handleDelete = async () => {
    if (!window.confirm(t("api.row.deleteConfirm"))) return false;

    const user = userFromStorage();
    const Model = !!user ? Admin : System;
    const success = await Model.deleteApiKey(apiKey.id);
    if (success) removeApiKey(apiKey.id);
  };

  const statusClass = {
    active: "text-emerald-400",
    expired: "text-amber-400",
    revoked: "text-red-400",
  }[apiKey.status] || "text-theme-text-secondary";

  const scopeLabel =
    apiKey.workspaceSlugs === null || apiKey.workspaceSlugs === undefined
      ? "Legacy unrestricted"
      : apiKey.workspaceSlugs.length
        ? apiKey.workspaceSlugs.join(", ")
        : "No workspace access";

  return (
    <tr className="bg-transparent text-white text-opacity-80 text-xs font-medium border-b border-white/10">
      <td scope="row" className="px-6 py-3 whitespace-nowrap align-middle">
        {apiKey.name || t("api.row.unnamed")}
      </td>
      <td className="px-6 py-3 align-middle">
        <div className="flex flex-col gap-1 min-w-[180px]">
          <span className={`font-semibold capitalize ${statusClass}`}>
            {apiKey.status || "unknown"}
          </span>
          <span className="text-theme-text-secondary break-words">
            Scope: {scopeLabel}
          </span>
          <span className="text-theme-text-secondary">
            {apiKey.expiresAt
              ? `Expires ${moment(apiKey.expiresAt).format("lll")}`
              : "No expiry set"}
          </span>
          <span className="text-theme-text-secondary">Secret hidden after creation</span>
        </div>
      </td>
      <td className="px-6 py-3 text-left align-middle">
        {apiKey.createdBy?.username || "--"}
      </td>
      <td className="px-6 py-3 whitespace-nowrap align-middle">
        {apiKey.createdAt ? moment(apiKey.createdAt).format("lll") : "--"}
      </td>
      <td className="px-6 py-3 align-middle">
        <button
          onClick={handleDelete}
          disabled={apiKey.status === "revoked"}
          aria-label={`Revoke API key ${apiKey.name || apiKey.id}`}
          className="text-xs font-medium text-white/80 light:text-black/80 hover:light:text-red-500 hover:text-red-300 rounded-lg px-2 py-1 hover:bg-white hover:light:bg-red-50 hover:bg-opacity-10 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash className="h-5 w-5" />
        </button>
      </td>
    </tr>
  );
}
