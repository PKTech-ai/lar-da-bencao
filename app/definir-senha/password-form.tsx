"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PasswordForm() {
  const router = useRouter(); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form=new FormData(event.currentTarget), password=String(form.get("password")??""), confirmation=String(form.get("confirmation")??"");
    try { if(password!==confirmation) throw new Error("As senhas não conferem."); const result=await createClient().auth.updateUser({password}); if(result.error) throw result.error; await fetch("/api/auth/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:"password_changed"})}); router.replace("/mfa"); router.refresh(); }
    catch(caught){setError(caught instanceof Error?caught.message:"Não foi possível definir a senha.");} finally{setBusy(false);}
  }
  return <form className="form-stack" onSubmit={submit}><label>Nova senha<input name="password" type="password" autoComplete="new-password" minLength={14} required/></label><label>Confirme a senha<input name="confirmation" type="password" autoComplete="new-password" minLength={14} required/></label>{error?<div className="error" role="alert">{error}</div>:null}<button className="button primary" disabled={busy}>{busy?"Salvando…":"Salvar e ativar MFA"}</button></form>;
}
