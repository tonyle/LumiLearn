import { ParentShell } from "@/components/parent-shell";import { requireRole } from "@/lib/auth";import { redirect } from "next/navigation";
export default async function Layout({children}:{children:React.ReactNode}){try{await requireRole("parent");}catch{redirect("/login");}return <ParentShell>{children}</ParentShell>}
