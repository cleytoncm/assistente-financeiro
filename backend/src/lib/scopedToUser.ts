type WithWhere = { where?: Record<string, unknown> }

/**
 * Merges the authenticated user's id into a Prisma query's `where` clause.
 * The userId always wins over anything present in `args.where.userId` —
 * client input must never be able to override the authenticated user's scope.
 */
export function scopedToUser<T extends WithWhere>(userId: string, args: T): T {
  return {
    ...args,
    where: {
      ...(args.where ?? {}),
      userId,
    },
  }
}
