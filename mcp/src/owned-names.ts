/**
 * Which of a wallet's names `hoodfi_list_names` may hand to a model.
 *
 * Below the second level the registry takes any 1-255 byte label, and `createSubnode`
 * takes an owner, so the holder of any hoodfi name can mint `<free text>.x.hoodfi.eth`
 * into someone else's wallet. That text is a record a stranger wrote. A name is passed
 * on only when every label left of the parent follows the rules a mint does
 * (`checkLabel` in labels.ts); the rest are withheld and counted.
 *
 * No imports, so `owned-names.test.mjs` can load it with plain node; the caller passes
 * `PARENT` and `MAX_LABEL_LENGTH` from labels.ts.
 */

export type ListRule = { parent: string; maxLabelLength: number }

/** True when every label of `name` left of `.<parent>` is a mintable label. */
export function isListableName(name: string, rule: ListRule): boolean {
  const suffix = `.${rule.parent}`
  if (typeof name !== 'string' || !name.endsWith(suffix)) return false
  return name
    .slice(0, -suffix.length)
    .split('.')
    .every(
      (label) =>
        label.length > 0 &&
        label.length <= rule.maxLabelLength &&
        /^[a-z0-9-]+$/.test(label) &&
        !label.startsWith('-') &&
        !label.endsWith('-')
    )
}

/** The listable names, in order, and how many were withheld. */
export function splitListable<T extends { name: string }>(
  rows: T[],
  rule: ListRule
): { listed: T[]; withheld: number } {
  const listed = rows.filter((row) => isListableName(row.name, rule))
  return { listed, withheld: rows.length - listed.length }
}
