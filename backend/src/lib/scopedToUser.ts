type WithWhere = { where?: Record<string, unknown> }

/**
 * Merges the authenticated user's id into a Prisma query's `where` clause.
 * The userId always wins over anything present in `args.where.userId` —
 * client input must never be able to override the authenticated user's scope.
 *
 * Constrained to `Record<string, unknown>` rather than `WithWhere` directly: `WithWhere` has
 * only optional properties, which makes TypeScript treat it as a "weak type" — passing an
 * object with none of its properties (e.g. `{ include, orderBy }`, no `where`) would then be
 * rejected as a likely mistake, even though that's exactly the shape Prisma's `include`/
 * `orderBy`-only queries need here.
 */
export function scopedToUser<T extends Record<string, unknown>>(
  userId: string,
  args: T
): T & { where: Record<string, unknown> } {
  const where = (args as WithWhere).where ?? {}
  return {
    ...args,
    where: {
      ...where,
      userId,
    },
  }
}
