import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current";

export default async function Home() {
  const actor = await getCurrentActor();
  redirect(actor ? "/kyc" : "/sign-in");
}
