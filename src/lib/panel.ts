import { getBusinessBySlug, getBusinessBundle, type BusinessRow } from "@/lib/queries";

export type PanelContext = {
  biz: BusinessRow;
  role: "OWNER" | "MANAGER" | "CASHIER";
  actorEmail: string;
  actorName: string;
  slug: string;
};

export const PANEL_ROLES = ["OWNER", "MANAGER", "CASHIER"] as const;

export async function panelContext(
  sp: Record<string, string | string[] | undefined> | undefined
): Promise<PanelContext> {
  const slugRaw = typeof sp?.biz === "string" ? sp.biz : "kadikoy-pizza-atolyesi";
  const roleRaw = typeof sp?.rol === "string" ? sp.rol.toUpperCase() : "OWNER";
  const role = (PANEL_ROLES as readonly string[]).includes(roleRaw)
    ? (roleRaw as PanelContext["role"])
    : "OWNER";

  let biz = await getBusinessBySlug(slugRaw);
  if (!biz) biz = await getBusinessBySlug("kadikoy-pizza-atolyesi");
  if (!biz) throw new Error("Damping Noktası bulunamadı");

  const bundle = await getBusinessBundle(biz);
  const staffRow =
    bundle.staff.find((s) => s.role === (role === "OWNER" ? "OWNER" : role)) ?? bundle.staff[0];

  return {
    biz,
    role,
    actorEmail: staffRow?.email ?? `sahip@${biz.slug}.com`,
    actorName: staffRow?.name ?? biz.name,
    slug: biz.slug,
  };
}

export function panelUrl(slug: string, role: string, path = "/panel") {
  return `${path}?biz=${encodeURIComponent(slug)}&rol=${role}`;
}
