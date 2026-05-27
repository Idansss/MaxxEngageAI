import { redirect } from "next/navigation";

export default async function UserCredentialRedirect({
  params,
}: {
  params: Promise<{ credentialId: string }>;
}) {
  const { credentialId } = await params;
  redirect(`/verify?id=${encodeURIComponent(credentialId)}`);
}
