#!/usr/bin/env node
/**
 * Snapshot export: reads every NameReserved event from HoodfiDonations on mainnet,
 * cross-checks each against the live reservedBy mapping, and emits the batched
 * loadReservations() calldata for the L2 registrar.
 *
 * Usage:
 *   DONATIONS_ADDRESS=0x… DEPLOY_BLOCK=123 node scripts/export-reservations.mjs
 * Optional: MAINNET_RPC_URL, BATCH_SIZE (default 500)
 *
 * Anyone can run this against public RPCs to verify the snapshot the owner loads.
 */
import {
  createPublicClient,
  http,
  parseAbi,
  parseAbiItem,
  encodeFunctionData,
  keccak256,
  toBytes,
} from "viem";
import { mainnet } from "viem/chains";
import { writeFileSync } from "node:fs";

const DONATIONS = process.env.DONATIONS_ADDRESS;
const FROM_BLOCK = BigInt(process.env.DEPLOY_BLOCK ?? "0");
const RPC = process.env.MAINNET_RPC_URL ?? "https://ethereum-rpc.publicnode.com";
const BATCH = Number(process.env.BATCH_SIZE ?? 500);

if (!DONATIONS) {
  console.error("DONATIONS_ADDRESS is required");
  process.exit(1);
}

const client = createPublicClient({ chain: mainnet, transport: http(RPC) });

const logs = await client.getLogs({
  address: DONATIONS,
  event: parseAbiItem(
    "event NameReserved(address indexed donor, bytes32 indexed labelhash, string label)"
  ),
  fromBlock: FROM_BLOCK,
  toBlock: "latest",
});

console.log(`Found ${logs.length} NameReserved events`);

const abi = parseAbi([
  "function reservedBy(bytes32 labelhash) view returns (address)",
  "function finalized() view returns (bool)",
  "function loadReservations(bytes32[] labelhashes, address[] owners)",
]);

const finalized = await client.readContract({ address: DONATIONS, abi, functionName: "finalized" });
if (!finalized) {
  console.warn("⚠ finalize() has not been called — snapshot is not frozen yet");
}

// Verify each event against current storage (the mapping is the source of truth;
// events could theoretically be superseded if a design change ever allowed it).
const entries = [];
for (const log of logs) {
  const { labelhash, label, donor } = log.args;
  if (keccak256(toBytes(label)) !== labelhash) {
    console.error(`✗ labelhash mismatch for "${label}" — skipping`);
    continue;
  }
  const current = await client.readContract({
    address: DONATIONS,
    abi,
    functionName: "reservedBy",
    args: [labelhash],
  });
  if (current.toLowerCase() !== donor.toLowerCase()) {
    console.error(`✗ storage mismatch for "${label}": event ${donor}, storage ${current}`);
    continue;
  }
  entries.push({ label, labelhash, owner: current });
}

console.log(`Verified ${entries.length} reservations against storage`);

const batches = [];
for (let i = 0; i < entries.length; i += BATCH) {
  const slice = entries.slice(i, i + BATCH);
  batches.push({
    count: slice.length,
    calldata: encodeFunctionData({
      abi,
      functionName: "loadReservations",
      args: [slice.map((e) => e.labelhash), slice.map((e) => e.owner)],
    }),
  });
}

const out = {
  donations: DONATIONS,
  finalized,
  exportedAt: new Date().toISOString(),
  total: entries.length,
  entries,
  batches,
};
writeFileSync("reservations-snapshot.json", JSON.stringify(out, null, 2));
console.log(
  `Wrote reservations-snapshot.json — ${batches.length} loadReservations batch(es) of ≤${BATCH}`
);
console.log("Send each batch to the HoodfiRegistrar from the owner wallet, then setPhase(Claim).");
