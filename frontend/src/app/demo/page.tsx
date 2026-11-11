import { redirect } from "next/navigation";

/** /demo → the demo's overview page. */
export default function DemoIndex() {
  redirect("/demo/dashboard");
}
