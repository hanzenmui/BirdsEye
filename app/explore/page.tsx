import { requireAuthPage } from "@/lib/auth";
import { Explorer } from "@/components/Explorer";

export default async function ExplorePage() {
  await requireAuthPage();
  return <Explorer />;
}
