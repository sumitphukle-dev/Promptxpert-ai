"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyText } from "@/lib/util";

export default function CopyButton({ text, label = "Copy", className = "btn btn-ghost !py-1.5 !px-3 text-xs" }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className={className} onClick={async () => { if (await copyText(text)) { setOk(true); setTimeout(() => setOk(false), 1500); } }}>
      {ok ? <><Check size={13} /> Copied</> : <><Copy size={13} /> {label}</>}
    </button>
  );
}
