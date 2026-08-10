"use client";

import { useRef, useState } from "react";
import { useSignMessage } from "wagmi";
import { prepareAvatar, stashAvatar, uploadAvatar } from "@/lib/avatar";
import { track } from "@/lib/analytics";
import { walletErrorMessage } from "@/lib/errors";
import { AVATAR_UPLOAD_URL } from "@/lib/site";

type Stage = "idle" | "preparing" | "signing" | "uploading";

const STAGE_LABEL: Record<Exclude<Stage, "idle">, string> = {
  preparing: "Preparing image…",
  signing: "Confirm in your wallet…",
  uploading: "Uploading…",
};

/**
 * "Upload an image" for the avatar record.
 *
 * The record itself is a URL, so the field alone silently assumes everyone has
 * somewhere to host a picture. Most people don't, and the visible result is names that
 * carry every other record but no avatar — which is exactly what the first name
 * registered here looked like.
 *
 * The upload costs no gas and writes nothing: it hands back an `ipfs://` URI which
 * lands in the draft like anything typed, so the picture is previewed on the card and
 * only committed by the same Save button as the rest of the form. Signing is a plain
 * message signature, not a transaction — wallets show it as such.
 */
export function AvatarUpload({
  label,
  onUploaded,
}: {
  label: string;
  onUploaded: (uri: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { signMessageAsync } = useSignMessage();
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const busy = stage !== "idle";

  async function handleFile(file: File) {
    setError(null);
    setDone(false);
    try {
      setStage("preparing");
      const dataUrl = await prepareAvatar(file);

      setStage("signing");
      const uri = await uploadAvatar({
        endpoint: AVATAR_UPLOAD_URL,
        label,
        dataUrl,
        signMessage: async (message) => {
          const signature = await signMessageAsync({ message });
          // Everything after the signature is network work, and the wallet prompt is
          // already gone by then — move the label on so the button isn't still asking
          // for a confirmation that has happened.
          setStage("uploading");
          return signature;
        },
      });

      // Stash before handing it up: if anything below this line throws, the CID is
      // still recoverable rather than pinned and lost.
      stashAvatar(label, uri);
      onUploaded(uri);
      setDone(true);
      track("avatar_uploaded", { method: "manage" });
    } catch (err) {
      setError(walletErrorMessage(err));
    } finally {
      setStage("idle");
      // Let the same file be picked again after a failure — without this the input
      // holds the old value and re-selecting it fires no change event.
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        className="btn btn-ghost h-8 px-3 text-xs"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? STAGE_LABEL[stage] : "Upload an image"}
      </button>
      {error ? (
        <span className="data text-xs bad">{error}</span>
      ) : done ? (
        // The upload is half the job, and the half that costs nothing. Saying so here
        // is the whole point of this state: the previous copy ended on "you sign a
        // message, not a transaction", which reads as "finished" — so an image could be
        // pinned, the record never written, and nothing on screen disagreed.
        <span className="text-xs ok">
          Uploaded ✓ — now press <strong className="font-semibold">Save changes</strong>{" "}
          to put it on your name.
        </span>
      ) : (
        <span className="text-xs text-[var(--faint)]">
          Square-cropped to 512px and pinned to IPFS. Free to upload; writing it to your
          name is the Save below.
        </span>
      )}
    </div>
  );
}
