import { redirect } from "next/navigation";
import { DEFAULT_MODULE_HREF } from "@/lib/modules";

export default function HomePage() {
  redirect(DEFAULT_MODULE_HREF);
}
