"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { checkLabel } from "@/lib/labels";
import { track } from "@/lib/analytics";
import { useMintQuery } from "./MintQuery";

/**
 * Hero CTA: connect a wallet, then land on /mint ready to go. Anyone already
 * connected skips straight there. Whatever is typed in the card beside it comes
 * along, so the trip doesn't lose their name.
 */
export function ConnectMintButton({ className = "btn btn-primary" }: { className?: string }) {
  const { isConnected } = useAccount();
  const { open } = useAppKit();
  const router = useRouter();
  const shared = useMintQuery();

  const check = checkLabel(shared?.query ?? "");
  const label = check.ok ? check.label : "";
  const target = label ? `/mint/?q=${encodeURIComponent(label)}` : "/mint/";

  const awaiting = useRef(false);
  useEffect(() => {
    if (!awaiting.current || !isConnected) return;
    awaiting.current = false;
    router.push(target);
  }, [isConnected, router, target]);

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (isConnected) {
          router.push(target);
          return;
        }
        track("connect_opened");
        awaiting.current = true;
        open();
      }}
    >
      Mint your name
    </button>
  );
}
