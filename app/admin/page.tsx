import AdminPanel from "@/components/admin/AdminPanel";
import Login from "@/components/admin/Login";
import { adminConfigured, isAdmin } from "@/lib/auth";
import { getState } from "@/lib/storage";
import { defaultState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Painel de Matrículas" };

export default async function AdminPage() {
  if (!(await isAdmin())) return <Login configured={adminConfigured()} />;
  const state = (await getState()) ?? defaultState();
  return <AdminPanel initial={state} />;
}
