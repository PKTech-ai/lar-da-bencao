"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export function RecoveryForm(){const[message,setMessage]=useState("");const[busy,setBusy]=useState(false);async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);const email=String(new FormData(event.currentTarget).get("email")??"");await createClient().auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/auth/callback?next=/definir-senha`});setMessage("Se o e-mail estiver cadastrado, o link de recuperação será enviado.");setBusy(false);}return <form className="form-stack" onSubmit={submit}><label>E-mail institucional<input name="email" type="email" autoComplete="email" required/></label>{message?<div className="success" role="status">{message}</div>:null}<button className="button primary" disabled={busy}>{busy?"Enviando…":"Enviar link"}</button><Link className="button" href="/login">Voltar ao login</Link></form>;}
