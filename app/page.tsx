import Presenter from "@/components/tv/Presenter";
import { getState } from "@/lib/storage";
import { defaultState } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TvPage() {
  const state = (await getState()) ?? defaultState();
  return <Presenter initial={state} />;
}
