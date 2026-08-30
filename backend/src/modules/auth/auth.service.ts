import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { Prisma, type User } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { env } from '../../config/env.js'
import { EmailAlreadyExistsError, InvalidCredentialsError } from './auth.errors.js'

const BCRYPT_COST = 12
const TOKEN_EXPIRES_IN = '7d'

export type PublicUser = Pick<User, 'id' | 'name' | 'email'>

function toPublicUser(user: User): PublicUser {
  return { id: user.id, name: user.name, email: user.email }
}

export async function registerUser(params: {
  name: string
  email: string
  password: string
}): Promise<PublicUser> {
  const email = params.email.toLowerCase()
  const passwordHash = await bcrypt.hash(params.password, BCRYPT_COST)

  try {
    const user = await prisma.user.create({
      data: { name: params.name, email, passwordHash },
    })
    return toPublicUser(user)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new EmailAlreadyExistsError()
    }
    /* v8 ignore next -- defensive re-throw for unexpected DB errors, not triggerable in tests */
    throw error
  }
}

export async function loginUser(params: {
  email: string
  password: string
}): Promise<{ token: string }> {
  const email = params.email.toLowerCase()
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    throw new InvalidCredentialsError()
  }

  const passwordMatches = await bcrypt.compare(params.password, user.passwordHash)
  if (!passwordMatches) {
    throw new InvalidCredentialsError()
  }

  const token = jwt.sign({ sub: user.id }, env.jwtSecret, { expiresIn: TOKEN_EXPIRES_IN })
  return { token }
}

export async function getUserById(userId: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  return user ? toPublicUser(user) : null
}
