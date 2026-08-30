import type { Request, Response } from 'express'
import { registerSchema, loginSchema } from './auth.schemas.js'
import { registerUser, loginUser, getUserById } from './auth.service.js'
import { EmailAlreadyExistsError, InvalidCredentialsError } from './auth.errors.js'

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const user = await registerUser(parsed.data)
    res.status(201).json(user)
  } catch (error) {
    if (error instanceof EmailAlreadyExistsError) {
      res.status(409).json({ error: 'Email already exists' })
      return
    }
    /* v8 ignore next -- defensive re-throw for unexpected DB errors, not triggerable in tests */
    throw error
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const result = await loginUser(parsed.data)
    res.status(200).json(result)
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }
    /* v8 ignore next -- defensive re-throw for unexpected DB errors, not triggerable in tests */
    throw error
  }
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await getUserById(req.userId!)
  if (!user) {
    res.status(401).json({ error: 'User not found' })
    return
  }
  res.status(200).json(user)
}
